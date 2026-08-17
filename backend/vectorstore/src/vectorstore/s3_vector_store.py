"""S3 Vectors implementation of paper-qa VectorStore.

.. deprecated::
    Use BedrockKBVectorStore instead. This class handles both ingestion and
    querying, but we've migrated to Bedrock KB for managed document ingestion.
    TODO: Remove this class once all deployments use Bedrock KB managed indexing.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Iterable, Sequence

import boto3
from pydantic import model_validator

from lmi import EmbeddingModel, EmbeddingModes
from paperqa.llms import VectorStore
from paperqa.types import Doc, Text

from shared.key_normalization import normalize_filename, vector_key


if TYPE_CHECKING:
    from mypy_boto3_s3vectors import S3VectorsClient


def _chunked(iterable: Iterable, n: int):
    """Yield successive n-sized chunks from iterable."""
    lst = list(iterable)
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


class S3VectorStore(VectorStore):
    """VectorStore backed by Amazon S3 Vectors.

    .. deprecated::
        Use BedrockKBVectorStore instead for new deployments.
    """

    bucket_name: str
    index_name: str
    region: str = "us-east-1"
    client: Any = None

    @model_validator(mode="after")
    def _init_client(self) -> "S3VectorStore":
        if self.client is None:
            self.client = boto3.client("s3vectors", region_name=self.region)
        return self

    def __len__(self) -> int:
        """Return count of vectors in the S3 Vectors index.

        This enables paper-qa's Docs to detect that vectors exist for retrieval.
        Falls back to texts_hashes count if S3 Vectors query fails.
        """
        # First check if we have local texts_hashes (from add_texts_and_embeddings)
        if self.texts_hashes:
            return len(self.texts_hashes)

        # Otherwise, count vectors in S3 Vectors
        try:
            count = 0
            kwargs: dict[str, Any] = {
                "vectorBucketName": self.bucket_name,
                "indexName": self.index_name,
            }
            while True:
                response = self.client.list_vectors(**kwargs)
                count += len(response.get("vectors", []))
                next_token = response.get("nextToken")
                if not next_token:
                    break
                kwargs["nextToken"] = next_token
            return count
        except Exception:
            return len(self.texts_hashes)

    async def add_texts_and_embeddings(self, texts: Iterable[Text]) -> None:
        """Add texts to the vector store."""
        texts_list = list(texts)
        await super().add_texts_and_embeddings(texts_list)

        vectors = []
        for idx, t in enumerate(texts_list):
            if t.embedding is None:
                continue

            docname = t.doc.docname if hasattr(t.doc, "docname") else str(t.doc)
            normalized = normalize_filename(docname)
            key = vector_key(normalized, idx)

            vectors.append({
                "key": key,
                "data": {"float32": t.embedding},
                "metadata": {
                    "text": t.text[:1500],
                    "docname": normalized,
                    "original_filename": docname,
                    "chunk_index": str(idx),
                    "doc_citation": getattr(t.doc, "citation", ""),
                    "indexed_at": datetime.now(timezone.utc).isoformat(),
                },
            })

        for batch in _chunked(vectors, 500):
            self.client.put_vectors(
                vectorBucketName=self.bucket_name,
                indexName=self.index_name,
                vectors=batch,
            )

    async def similarity_search(
        self,
        query: str,
        k: int,
        embedding_model: EmbeddingModel,
    ) -> tuple[Sequence[Text], list[float]]:
        """Search for similar texts.

        Uses query_vectors for ANN search, then get_vectors to fetch
        the actual vector data (required for MMR in paper-qa).
        """
        embedding_model.set_mode(EmbeddingModes.QUERY)
        query_embeddings = await embedding_model.embed_documents([query])
        embedding_model.set_mode(EmbeddingModes.DOCUMENT)

        # Step 1: Query for nearest neighbors (returns keys, metadata, distances)
        query_response = self.client.query_vectors(
            vectorBucketName=self.bucket_name,
            indexName=self.index_name,
            queryVector={"float32": query_embeddings[0]},
            topK=k,
            returnMetadata=True,
            returnDistance=True,
        )

        query_results = query_response.get("vectors", [])
        if not query_results:
            return [], []

        # Step 2: Fetch vector data using get_vectors
        # (query_vectors doesn't return the actual vector data)
        keys = [r["key"] for r in query_results]
        get_response = self.client.get_vectors(
            vectorBucketName=self.bucket_name,
            indexName=self.index_name,
            keys=keys,
            returnData=True,
            returnMetadata=True,
        )

        # Build a lookup dict for vector data
        vector_data_lookup = {
            v["key"]: v
            for v in get_response.get("vectors", [])
        }

        texts = []
        scores = []

        for result in query_results:
            key = result["key"]
            metadata = result.get("metadata", {})
            distance = result.get("distance", 0.0)

            # Get the vector data from the get_vectors response
            vector_info = vector_data_lookup.get(key, {})
            embedding = vector_info.get("data", {}).get("float32")

            doc = Doc(
                docname=metadata.get("docname", "unknown"),
                dockey=metadata.get("docname", "unknown"),
                citation=metadata.get("doc_citation", ""),
            )

            t = Text(
                text=metadata.get("text", ""),
                name=f"{metadata.get('docname', 'unknown')} chunk {metadata.get('chunk_index', '?')}",
                doc=doc,
            )

            if embedding:
                t.embedding = embedding

            texts.append(t)
            scores.append(1.0 - distance)

        return texts, scores

    def clear(self) -> None:
        """Delete all vectors from the index."""
        super().clear()

        all_keys = []
        kwargs: dict[str, Any] = {
            "vectorBucketName": self.bucket_name,
            "indexName": self.index_name,
        }

        while True:
            response = self.client.list_vectors(**kwargs)
            all_keys.extend(v["key"] for v in response.get("vectors", []))

            next_token = response.get("nextToken")
            if not next_token:
                break
            kwargs["nextToken"] = next_token

        for batch in _chunked(all_keys, 500):
            self.client.delete_vectors(
                vectorBucketName=self.bucket_name,
                indexName=self.index_name,
                keys=batch,
            )
