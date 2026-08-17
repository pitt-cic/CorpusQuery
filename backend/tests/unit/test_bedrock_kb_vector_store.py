"""Unit tests for BedrockKBVectorStore with mocked boto3 client."""
import pytest
from unittest.mock import MagicMock, AsyncMock

from lmi import EmbeddingModes


@pytest.fixture
def fake_client():
    """Mock boto3 s3vectors client with Bedrock KB metadata schema."""
    client = MagicMock()

    client.query_vectors.return_value = {
        "vectors": [
            {
                "key": "bedrock-kb-chunk-001",
                "metadata": {
                    "AMAZON_BEDROCK_TEXT": "The AURORA study found significant results...",
                    "x-amz-bedrock-kb-source-uri": "s3://papers-bucket/papers/aurora.pdf",
                    "x-amz-bedrock-kb-data-source-id": "DS123456",
                },
                "distance": 0.15,
            },
            {
                "key": "bedrock-kb-chunk-002",
                "metadata": {
                    "AMAZON_BEDROCK_TEXT": "Further analysis revealed patterns...",
                    "x-amz-bedrock-kb-source-uri": "s3://papers-bucket/papers/aurora.pdf",
                    "x-amz-bedrock-kb-data-source-id": "DS123456",
                },
                "distance": 0.25,
            },
        ]
    }

    client.get_vectors.return_value = {
        "vectors": [
            {
                "key": "bedrock-kb-chunk-001",
                "data": {"float32": [0.1] * 1024},
                "metadata": {
                    "AMAZON_BEDROCK_TEXT": "The AURORA study found significant results...",
                    "x-amz-bedrock-kb-source-uri": "s3://papers-bucket/papers/aurora.pdf",
                },
            },
            {
                "key": "bedrock-kb-chunk-002",
                "data": {"float32": [0.2] * 1024},
                "metadata": {
                    "AMAZON_BEDROCK_TEXT": "Further analysis revealed patterns...",
                    "x-amz-bedrock-kb-source-uri": "s3://papers-bucket/papers/aurora.pdf",
                },
            },
        ]
    }

    return client


@pytest.fixture
def mock_embedding_model():
    """Mock embedding model."""
    model = MagicMock()
    model.embed_documents = AsyncMock(return_value=[[0.5] * 1024])
    model.set_mode = MagicMock()
    return model


@pytest.fixture
def store(fake_client):
    """Create BedrockKBVectorStore with mocked client."""
    from vectorstore.bedrock_kb_vector_store import BedrockKBVectorStore
    return BedrockKBVectorStore(
        bucket_name="test-bucket",
        index_name="test-index",
        client=fake_client,
    )


@pytest.mark.asyncio
async def test_similarity_search_returns_texts_with_embeddings(store, fake_client, mock_embedding_model):
    """similarity_search must return Text objects with embeddings for MMR."""
    texts, scores = await store.similarity_search(
        query="test query",
        k=5,
        embedding_model=mock_embedding_model,
    )

    assert len(texts) == 2
    assert texts[0].embedding is not None
    assert len(texts[0].embedding) == 1024
    assert texts[0].text == "The AURORA study found significant results..."
    assert texts[0].doc.docname == "aurora"


@pytest.mark.asyncio
async def test_similarity_search_sets_embedding_modes(store, fake_client, mock_embedding_model):
    """similarity_search must set QUERY mode for embedding, then reset to DOCUMENT."""
    await store.similarity_search("test", k=5, embedding_model=mock_embedding_model)

    calls = mock_embedding_model.set_mode.call_args_list
    assert len(calls) == 2
    assert calls[0][0][0] == EmbeddingModes.QUERY
    assert calls[1][0][0] == EmbeddingModes.DOCUMENT


@pytest.mark.asyncio
async def test_similarity_search_converts_distance_to_similarity(store, fake_client, mock_embedding_model):
    """Distance 0.15 should become similarity 0.85."""
    _, scores = await store.similarity_search("test", k=5, embedding_model=mock_embedding_model)

    assert abs(scores[0] - 0.85) < 1e-6
    assert abs(scores[1] - 0.75) < 1e-6


@pytest.mark.asyncio
async def test_similarity_search_handles_empty_results(mock_embedding_model):
    """similarity_search should return empty lists when no results found."""
    from vectorstore.bedrock_kb_vector_store import BedrockKBVectorStore
    client = MagicMock()
    client.query_vectors.return_value = {"vectors": []}
    store = BedrockKBVectorStore(bucket_name="b", index_name="i", client=client)

    texts, scores = await store.similarity_search("query", k=5, embedding_model=mock_embedding_model)

    assert texts == []
    assert scores == []
    client.get_vectors.assert_not_called()


@pytest.mark.asyncio
async def test_extracts_docname_from_s3_uri(store, fake_client, mock_embedding_model):
    """Docname should be extracted from x-amz-bedrock-kb-source-uri."""
    texts, _ = await store.similarity_search("test", k=5, embedding_model=mock_embedding_model)

    assert texts[0].doc.docname == "aurora"
    assert texts[0].doc.citation == "s3://papers-bucket/papers/aurora.pdf"


@pytest.mark.asyncio
async def test_add_texts_and_embeddings_is_noop(fake_client):
    """add_texts_and_embeddings should do nothing - Bedrock KB manages ingestion."""
    from vectorstore.bedrock_kb_vector_store import BedrockKBVectorStore
    from paperqa.types import Doc, Text

    store = BedrockKBVectorStore(bucket_name="b", index_name="i", client=fake_client)

    doc = Doc(docname="test", dockey="test", citation="Test citation")
    text = Text(text="Test content", name="test chunk", doc=doc)
    text.embedding = [0.1] * 1024

    await store.add_texts_and_embeddings([text])

    fake_client.put_vectors.assert_not_called()


def test_clear_raises_not_implemented(store):
    """clear() should raise NotImplementedError - index is managed by Bedrock KB."""
    with pytest.raises(NotImplementedError, match="managed by Bedrock KB"):
        store.clear()


@pytest.mark.asyncio
async def test_extracts_source_uri_from_amazon_bedrock_metadata(mock_embedding_model):
    """Source URI should be extracted from AMAZON_BEDROCK_METADATA JSON."""
    import json
    from vectorstore.bedrock_kb_vector_store import BedrockKBVectorStore

    client = MagicMock()
    bedrock_metadata = json.dumps({
        "source": {"sourceLocation": "s3://papers-bucket/papers/study.pdf"}
    })
    client.query_vectors.return_value = {
        "vectors": [
            {
                "key": "chunk-001",
                "metadata": {
                    "AMAZON_BEDROCK_TEXT": "Study results...",
                    "AMAZON_BEDROCK_METADATA": bedrock_metadata,
                },
                "distance": 0.1,
            }
        ]
    }
    client.get_vectors.return_value = {
        "vectors": [{"key": "chunk-001", "data": {"float32": [0.1] * 1024}}]
    }

    store = BedrockKBVectorStore(bucket_name="b", index_name="i", client=client)
    texts, _ = await store.similarity_search("test", k=5, embedding_model=mock_embedding_model)

    assert texts[0].doc.docname == "study"
    assert texts[0].doc.citation == "s3://papers-bucket/papers/study.pdf"
