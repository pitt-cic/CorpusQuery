import asyncio
import json
import boto3
import logging
from pathlib import Path
from paperqa.readers import read_doc
from paperqa.types import Doc
from paperqa_pypdf import parse_pdf_to_pages

logger = logging.getLogger(__name__)


def _extract_chunks_with_pdfminer(path: Path, chunk_chars: int = 3000, overlap: int = 100) -> list:
    """Fallback PDF text extractor using pdfminer.six.

    Returns a list of objects with a .text attribute, matching what paperqa's
    read_doc returns, so the rest of the indexing pipeline is unchanged.
    """
    from pdfminer.high_level import extract_text

    class _Chunk:
        def __init__(self, text: str):
            self.text = text

    full_text = extract_text(str(path)) or ""
    chunks = []
    start = 0
    while start < len(full_text):
        end = min(start + chunk_chars, len(full_text))
        chunk = full_text[start:end].strip()
        if chunk:
            chunks.append(_Chunk(chunk))
        start += chunk_chars - overlap
    return chunks


async def index_document_from_s3(
    s3_client,
    s3vectors_client,
    bedrock_client,
    bucket_name: str,
    s3_key: str,  # e.g., "fetched-papers/0000-1234/PMC123.pdf"
    orcid: str,
    vector_bucket: str,
    index_name: str,
    max_chunks: int | None = None,
) -> int:
    """Download from S3, chunk, embed, write vectors with ORCID."""

    # Download to /tmp
    local_path = Path(f"/tmp/{Path(s3_key).name}")
    logger.info(f"Downloading {s3_key} to {local_path}")
    s3_client.download_file(bucket_name, s3_key, str(local_path))

    # Parse and chunk
    doc = Doc(docname=local_path.stem, dockey=local_path.stem, citation=f"{local_path.stem}.")

    if local_path.suffix.lower() == '.pdf':
        try:
            texts = await read_doc(path=local_path, doc=doc, parse_pdf=parse_pdf_to_pages)
        except Exception as pypdf_err:
            logger.warning(f"pypdf failed on {local_path.name} ({pypdf_err}), retrying with pdfminer")
            texts = _extract_chunks_with_pdfminer(local_path)
    else:
        texts = await read_doc(path=local_path, doc=doc)

    logger.info(f"Extracted {len(texts)} chunks from {local_path.name}")

    if max_chunks:
        texts = texts[:max_chunks]

    # Embed
    embeddings = []
    for text in texts:
        response = bedrock_client.invoke_model(
            modelId="amazon.titan-embed-text-v2:0",
            body=json.dumps({"inputText": text.text[:8000], "dimensions": 1024, "normalize": True}),
        )
        embeddings.append(json.loads(response["body"].read())["embedding"])

    logger.info(f"Generated {len(embeddings)} embeddings")

    # Write vectors with ORCID metadata
    vectors = [
        {
            "key": f"{local_path.stem}_{i:04d}",
            "data": {"float32": emb},
            "metadata": {
                "text": texts[i].text[:1500],
                "docname": local_path.stem,
                "chunk_index": str(i),
                "orcid": orcid,  # ← KEY METADATA
            },
        }
        for i, emb in enumerate(embeddings)
    ]

    logger.info(f"Writing {len(vectors)} vectors to {vector_bucket}/{index_name} with orcid={orcid}")
    for i in range(0, len(vectors), 500):
        batch = vectors[i:i+500]
        s3vectors_client.put_vectors(
            vectorBucketName=vector_bucket,
            indexName=index_name,
            vectors=batch,
        )
        logger.info(f"Wrote batch of {len(batch)} vectors")

    logger.info(f"Successfully indexed {len(vectors)} vectors with orcid metadata")
    return len(vectors)