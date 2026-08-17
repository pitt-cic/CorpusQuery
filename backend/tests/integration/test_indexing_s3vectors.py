"""Integration test: PDF -> embed -> S3 Vectors."""
import json

import pytest

from shared.key_normalization import normalize_filename, vector_key
from tests.integration.conftest import (
    AURORA_PDF,
    VECTOR_BUCKET,
    VECTOR_INDEX,
)


@pytest.fixture(autouse=True)
def cleanup_test_vectors(s3vectors_client, request):
    """Clean up vectors after test."""
    yield
    # Cleanup after test
    normalized = normalize_filename("AURORA.pdf")
    keys = [vector_key(normalized, i) for i in range(10)]
    try:
        s3vectors_client.delete_vectors(
            vectorBucketName=VECTOR_BUCKET,
            indexName=VECTOR_INDEX,
            keys=keys,
        )
        print(f"Cleaned up {len(keys)} test vectors")
    except Exception as e:
        print(f"Cleanup failed (may be OK if vectors didn't exist): {e}")


def embed_via_boto3(client, texts: list[str]) -> list[list[float]]:
    """Embed texts using Bedrock Titan Embed V2."""
    embeddings = []
    for text in texts:
        response = client.invoke_model(
            modelId="amazon.titan-embed-text-v2:0",
            body=json.dumps({
                "inputText": text[:8000],
                "dimensions": 1024,
                "normalize": True,
            }),
            contentType="application/json",
        )
        body = json.loads(response["body"].read())
        embeddings.append(body["embedding"])
    return embeddings


@pytest.mark.integration
async def test_index_aurora_pdf(s3vectors_client, bedrock_runtime_client):
    """Parse AURORA.pdf, embed chunks, write to S3 Vectors."""
    from paperqa.readers import read_doc
    from paperqa.types import Doc
    from paperqa_pypdf import parse_pdf_to_pages

    assert AURORA_PDF.exists(), f"Test PDF not found: {AURORA_PDF}"

    filename = AURORA_PDF.name
    normalized = normalize_filename(filename)

    doc = Doc(
        docname=normalized,
        dockey=normalized,
        citation="AURORA Study Group. 2023.",
    )

    # Parse PDF using paperqa_pypdf parser
    texts = await read_doc(path=AURORA_PDF, doc=doc, parse_pdf=parse_pdf_to_pages)
    assert len(texts) > 0, "read_doc returned no chunks"
    print(f"Parsed {len(texts)} chunks from {filename}")

    # Embed chunks (limit for test)
    chunk_texts = [t.text for t in texts]
    embeddings = embed_via_boto3(bedrock_runtime_client, chunk_texts[:10])
    assert len(embeddings[0]) == 1024
    print(f"Embedded {len(embeddings)} chunks")

    # Write to S3 Vectors
    vectors = [
        {
            "key": vector_key(normalized, i),
            "data": {"float32": emb},
            "metadata": {
                "text": texts[i].text[:1500],
                "docname": normalized,
                "original_filename": filename,
                "chunk_index": str(i),
                "doc_citation": doc.citation,
            },
        }
        for i, emb in enumerate(embeddings)
    ]

    s3vectors_client.put_vectors(
        vectorBucketName=VECTOR_BUCKET,
        indexName=VECTOR_INDEX,
        vectors=vectors,
    )
    print(f"Wrote {len(vectors)} vectors to S3 Vectors")

    # Verify first chunk exists
    result = s3vectors_client.get_vectors(
        vectorBucketName=VECTOR_BUCKET,
        indexName=VECTOR_INDEX,
        keys=[vector_key(normalized, 0)],
        returnMetadata=True,
    )

    assert len(result["vectors"]) == 1
    meta = result["vectors"][0]["metadata"]
    assert meta["docname"] == normalized
    assert meta["original_filename"] == filename
    print("Verification passed: vector exists with correct metadata")
