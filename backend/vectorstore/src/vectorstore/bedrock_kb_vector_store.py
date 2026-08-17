"""Query-only VectorStore for Bedrock KB-managed S3 Vectors indexes."""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any, Iterable, Sequence

import boto3
from pydantic import model_validator

from lmi import EmbeddingModel, EmbeddingModes
from paperqa.llms import VectorStore
from paperqa.types import Doc, Text

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from mypy_boto3_s3vectors import S3VectorsClient


class BedrockKBVectorStore(VectorStore):
    """Query-only VectorStore for Bedrock KB-managed S3 Vectors.

    Bedrock KB handles ingestion (parse -> chunk -> embed -> store). 
    This class queries the resulting S3 Vectors index directly to
    support paper-qa's MMR algorithm (requires embeddings).

    Also works for the fetched workflow except the ingestion is via Indexer Lambda --
    both workflows (manual/fetched) write to the same index
    """

    bucket_name: str
    index_name: str
    region: str = "us-east-1"
    client: Any = None
    orcid: str | None = None

    @model_validator(mode="after")
    def _init_client(self) -> "BedrockKBVectorStore":
        if self.client is None:
            self.client = boto3.client("s3vectors", region_name=self.region)
        return self

    async def add_texts_and_embeddings(self, texts: Iterable[Text]) -> None:
        """No-op: index is managed externally by Bedrock KB."""
        pass

    async def similarity_search(
        self,
        query: str,
        k: int,
        embedding_model: EmbeddingModel,
    ) -> tuple[Sequence[Text], list[float]]:
        """Search Bedrock KB-managed S3 Vectors index."""

        embedding_model.set_mode(EmbeddingModes.QUERY)
        query_embeddings = await embedding_model.embed_documents([query])
        embedding_model.set_mode(EmbeddingModes.DOCUMENT)

        query_params = {
            "vectorBucketName": self.bucket_name,
            "indexName": self.index_name,
            "queryVector": {"float32": query_embeddings[0]},
            "topK": k,
            "returnMetadata": True,
            "returnDistance": True,
        }

        if self.orcid:
            query_params["filter"] = {"orcid": {"$eq": self.orcid}}
            logger.info(f"Querying with ORCID filter: {self.orcid}")
        else:
            logger.info("Querying WITHOUT ORCID filter (searching all papers)")

        logger.info(f"S3 Vectors query params: bucket={self.bucket_name}, index={self.index_name}, topK={k}, has_filter={self.orcid is not None}")
        response = self.client.query_vectors(**query_params) 

        results = response.get("vectors", [])
        logger.info(f"S3 Vectors query returned {len(results)} results (orcid={self.orcid})")
        if not results:
            return [], []

        keys = [r["key"] for r in results]
        vectors = self.client.get_vectors(
            vectorBucketName=self.bucket_name,
            indexName=self.index_name,
            keys=keys,
            returnData=True,
            returnMetadata=True,
        )
        lookup = {v["key"]: v for v in vectors.get("vectors", [])}

        texts_out: list[Text] = []
        scores: list[float] = []

        for r in results:
            meta = r.get("metadata", {})
            vec = lookup.get(r["key"], {})

            # Support both Bedrock KB format (AMAZON_BEDROCK_TEXT) and custom format (text)
            chunk_text = meta.get("AMAZON_BEDROCK_TEXT") or meta.get("text", "")

            # For custom indexed papers (with orcid), use docname from metadata
            docname = meta.get("docname")
            if not docname:
                # Fall back to extracting from source_uri for Bedrock KB papers
                source_uri = self._extract_source_uri(meta)
                docname = self._extract_docname(source_uri)

            # Use docname as citation for custom indexed papers
            citation = meta.get("doc_citation", docname)

            doc = Doc(docname=docname, dockey=docname, citation=citation) # paper-qa Docs
            t = Text(
                text=chunk_text,
                name=f"{docname} chunk",
                doc=doc,
            )
            if emb := vec.get("data", {}).get("float32"):
                t.embedding = emb

            texts_out.append(t)
            scores.append(1.0 - r.get("distance", 0.0))

        # Log sample to verify text extraction
        if texts_out:
            sample_text = texts_out[0].text[:100] if texts_out[0].text else "<EMPTY>"
            logger.info(f"Sample text from first result: {sample_text}...")

        logger.info(f"Returning {len(texts_out)} texts with scores: {scores[:5]}")
        return texts_out, scores

    def _extract_source_uri(self, meta: dict) -> str:
        """Extract source URI from Bedrock KB metadata."""
        if uri := meta.get("x-amz-bedrock-kb-source-uri"):
            return uri
        if bedrock_meta := meta.get("AMAZON_BEDROCK_METADATA"):
            try:
                parsed = json.loads(bedrock_meta)
                if source := parsed.get("source", {}):
                    return source.get("sourceLocation", "")
            except (json.JSONDecodeError, TypeError):
                pass
        return ""

    def _extract_docname(self, source_uri: str) -> str:
        """Extract document name from S3 URI."""
        if not source_uri:
            return "unknown"
        filename = source_uri.rstrip("/").split("/")[-1]
        if "." in filename:
            filename = filename.rsplit(".", 1)[0]
        return filename or "unknown"

    def __len__(self) -> int:
        """Check if index has vectors via lightweight paginated API call."""
        response = self.client.list_vectors(
            vectorBucketName=self.bucket_name,
            indexName=self.index_name,
            maxResults=1,
        )
        return 1 if response.get("vectors") else 0

    def clear(self) -> None:
        """Not supported: index is managed by Bedrock KB."""
        raise NotImplementedError("Index managed by Bedrock KB")
