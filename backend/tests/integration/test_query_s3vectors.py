"""Integration test: Query S3 Vectors via S3VectorStore."""
import json

import pytest

from shared.key_normalization import normalize_filename, vector_key
from tests.integration.conftest import (
    AURORA_PDF,
    AWS_REGION,
    VECTOR_BUCKET,
    VECTOR_INDEX,
)


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


@pytest.fixture(scope="module")
def indexed_aurora_vectors(s3vectors_client, bedrock_runtime_client):
    """Index AURORA document vectors before running query tests.

    This fixture ensures vectors exist in S3 Vectors before querying.
    Vectors are cleaned up after all tests in this module complete.
    """
    import asyncio

    from paperqa.readers import read_doc
    from paperqa.types import Doc
    from paperqa_pypdf import parse_pdf_to_pages

    assert AURORA_PDF.exists(), f"Test PDF not found: {AURORA_PDF}"

    filename = AURORA_PDF.name
    normalized = normalize_filename(filename)

    doc = Doc(
        docname=normalized,
        dockey=normalized,
        citation="AURORA Study Group. Functional Neuroimaging of the AURORA Study. 2023.",
    )

    # Parse PDF using paperqa_pypdf parser
    texts = asyncio.run(
        read_doc(path=AURORA_PDF, doc=doc, parse_pdf=parse_pdf_to_pages)
    )
    assert len(texts) > 0, "read_doc returned no chunks"
    print(f"\nParsed {len(texts)} chunks from {filename}")

    # Embed chunks (limit to first 15 for test speed)
    num_chunks = min(15, len(texts))
    chunk_texts = [t.text for t in texts[:num_chunks]]
    embeddings = embed_via_boto3(bedrock_runtime_client, chunk_texts)
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

    # Return info about what was indexed
    yield {
        "normalized_name": normalized,
        "original_filename": filename,
        "num_vectors": len(vectors),
        "doc": doc,
    }

    # Cleanup after tests
    keys = [vector_key(normalized, i) for i in range(num_chunks)]
    try:
        s3vectors_client.delete_vectors(
            vectorBucketName=VECTOR_BUCKET,
            indexName=VECTOR_INDEX,
            keys=keys,
        )
        print(f"\nCleaned up {len(keys)} test vectors")
    except Exception as e:
        print(f"\nCleanup failed (may be OK if vectors didn't exist): {e}")


@pytest.mark.integration
async def test_query_aurora_via_s3vectorstore(indexed_aurora_vectors):
    """Query pre-indexed AURORA vectors via S3VectorStore using paper-qa Docs.aquery."""
    from paperqa import Docs, Settings
    from vectorstore.s3_vector_store import S3VectorStore

    # Verify vectors were indexed
    assert indexed_aurora_vectors["num_vectors"] > 0, "No vectors were indexed"
    print(f"\nQuerying against {indexed_aurora_vectors['num_vectors']} indexed vectors")

    # Create S3VectorStore instance
    store = S3VectorStore(
        bucket_name=VECTOR_BUCKET,
        index_name=VECTOR_INDEX,
        region=AWS_REGION,
    )

    # Create Docs with the S3VectorStore
    # Note: texts_index is the vector store for retrieval
    docs = Docs(texts_index=store)

    # Configure settings for Bedrock
    settings = Settings(
        llm="bedrock/us.anthropic.claude-sonnet-4-6",
        summary_llm="bedrock/us.anthropic.claude-sonnet-4-6",
        embedding="bedrock/amazon.titan-embed-text-v2:0",
        texts_index_mmr_lambda=1.0,  # Disable MMR (embeddings come from S3 Vectors)
    )

    # Run query using Docs.aquery (direct query, no agent/directory index needed)
    print("\nRunning docs.aquery (this may take 30-60 seconds)...")
    session = await docs.aquery(
        query="What are the main findings of the AURORA study?",
        settings=settings,
    )

    # Verify we got an answer
    assert session.answer, "Answer is empty"
    assert len(session.answer) > 50, f"Answer too short: {session.answer}"
    print(f"\nAnswer (first 500 chars): {session.answer[:500]}...")

    # Check for contexts/citations
    if session.contexts:
        docnames = [
            c.text.doc.docname
            for c in session.contexts
            if hasattr(c.text, 'doc') and hasattr(c.text.doc, 'docname')
        ]
        print(f"Cited documents: {docnames}")
        assert any("aurora" in d.lower() for d in docnames), (
            f"No aurora citation found in docnames: {docnames}"
        )
    else:
        print("Warning: No contexts returned (may indicate retrieval issue)")


@pytest.mark.integration
async def test_similarity_search_returns_aurora_chunks(indexed_aurora_vectors, bedrock_runtime_client):
    """Test that similarity_search directly retrieves AURORA chunks."""
    from paperqa import Settings
    from vectorstore.s3_vector_store import S3VectorStore

    store = S3VectorStore(
        bucket_name=VECTOR_BUCKET,
        index_name=VECTOR_INDEX,
        region=AWS_REGION,
    )

    # Create embedding model from Settings (proper way to instantiate)
    settings = Settings(embedding="bedrock/amazon.titan-embed-text-v2:0")
    embedding_model = settings.get_embedding_model()

    # Run similarity search
    texts, scores = await store.similarity_search(
        query="AURORA study neuroimaging findings",
        k=5,
        embedding_model=embedding_model,
    )

    # Verify we got results
    assert len(texts) > 0, "No texts returned from similarity search"
    print(f"\nRetrieved {len(texts)} chunks with scores: {scores}")

    # Check that AURORA document was retrieved
    docnames = [t.doc.docname for t in texts]
    assert any("aurora" in d.lower() for d in docnames), (
        f"AURORA document not in results: {docnames}"
    )

    # Verify embeddings are returned (required for MMR)
    for t in texts:
        assert t.embedding is not None, "Text embedding is None"
        assert len(t.embedding) == 1024, f"Embedding dimension mismatch: {len(t.embedding)}"

    # Print first result details
    first = texts[0]
    print(f"\nTop result: {first.doc.docname}")
    print(f"Score: {scores[0]:.4f}")
    print(f"Text preview: {first.text[:200]}...")
