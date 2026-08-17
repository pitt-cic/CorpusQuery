"""Unit tests for S3VectorStore with mocked boto3 client."""
import pytest
from unittest.mock import MagicMock, AsyncMock

from paperqa.llms import VectorStore
from paperqa.types import Doc, Text
from lmi import EmbeddingModes


def make_text(docname: str, chunk_index: int, embedding: list[float]) -> Text:
    """Create a Text object for testing."""
    doc = Doc(
        docname=docname,
        dockey=docname,
        citation=f"Citation for {docname}",
    )
    t = Text(
        text=f"Chunk {chunk_index} content",
        name=f"{docname} pages 1-2",
        doc=doc,
    )
    t.embedding = embedding
    return t


@pytest.fixture
def fake_client():
    """Mock boto3 s3vectors client."""
    client = MagicMock()

    # Mock query_vectors response (returns keys, metadata, distance but NOT data)
    client.query_vectors.return_value = {
        "vectors": [
            {
                "key": "aurora_final_0000",
                "metadata": {
                    "text": "The AURORA study found...",
                    "docname": "aurora_final",
                    "original_filename": "AURORA.pdf",
                    "chunk_index": "0",
                    "doc_citation": "AURORA et al. 2023",
                },
                "distance": 0.1,
            }
        ]
    }

    # Mock get_vectors response (returns data when requested)
    client.get_vectors.return_value = {
        "vectors": [
            {
                "key": "aurora_final_0000",
                "data": {"float32": [0.1] * 1024},
                "metadata": {
                    "text": "The AURORA study found...",
                    "docname": "aurora_final",
                    "original_filename": "AURORA.pdf",
                    "chunk_index": "0",
                    "doc_citation": "AURORA et al. 2023",
                },
            }
        ]
    }

    # Mock list_vectors response
    client.list_vectors.return_value = {
        "vectors": [
            {"key": "aurora_final_0000"},
            {"key": "aurora_final_0001"},
        ],
        "nextToken": None,
    }

    return client


@pytest.fixture
def store(fake_client):
    """Create S3VectorStore with mocked client."""
    from vectorstore.s3_vector_store import S3VectorStore
    return S3VectorStore(
        bucket_name="test-bucket",
        index_name="test-index",
        client=fake_client,
    )


@pytest.fixture
def mock_embedding_model():
    """Mock embedding model."""
    model = MagicMock()
    model.embed_documents = AsyncMock(return_value=[[0.5] * 1024])
    model.set_mode = MagicMock()
    return model


@pytest.mark.asyncio
async def test_similarity_search_returns_texts_with_embeddings(store, fake_client, mock_embedding_model):
    """similarity_search must return Text objects with embeddings for MMR."""
    texts, scores = await store.similarity_search(
        query="test query",
        k=5,
        embedding_model=mock_embedding_model,
    )

    assert len(texts) == 1
    assert texts[0].embedding is not None
    assert len(texts[0].embedding) == 1024
    assert texts[0].text == "The AURORA study found..."
    assert texts[0].doc.docname == "aurora_final"


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
    """Distance 0.1 should become similarity 0.9."""
    _, scores = await store.similarity_search("test", k=5, embedding_model=mock_embedding_model)

    assert abs(scores[0] - 0.9) < 1e-6


@pytest.mark.asyncio
async def test_similarity_search_handles_empty_results(mock_embedding_model):
    """similarity_search should return empty lists when no results found."""
    from vectorstore.s3_vector_store import S3VectorStore
    client = MagicMock()
    client.query_vectors.return_value = {"vectors": []}
    # get_vectors should not be called when query returns empty
    store = S3VectorStore(bucket_name="b", index_name="i", client=client)

    texts, scores = await store.similarity_search("query", k=5, embedding_model=mock_embedding_model)

    assert texts == []
    assert scores == []
    # get_vectors should not be called when query returns empty
    client.get_vectors.assert_not_called()


def test_len_returns_texts_hashes_count_when_populated():
    """__len__ returns texts_hashes count when it has items."""
    from vectorstore.s3_vector_store import S3VectorStore
    client = MagicMock()
    store = S3VectorStore(bucket_name="b", index_name="i", client=client)
    store.texts_hashes = {1, 2, 3}

    assert len(store) == 3
    # Should not call list_vectors when texts_hashes is populated
    client.list_vectors.assert_not_called()


def test_len_queries_s3_vectors_when_texts_hashes_empty():
    """__len__ queries S3 Vectors when texts_hashes is empty."""
    from vectorstore.s3_vector_store import S3VectorStore
    client = MagicMock()
    client.list_vectors.return_value = {
        "vectors": [{"key": "k1"}, {"key": "k2"}],
        "nextToken": None,
    }
    store = S3VectorStore(bucket_name="b", index_name="i", client=client)

    assert len(store) == 2
    client.list_vectors.assert_called_once()


@pytest.mark.asyncio
async def test_add_texts_and_embeddings_batches_500(fake_client):
    """Vectors should be upserted in batches of 500."""
    from vectorstore.s3_vector_store import S3VectorStore
    store = S3VectorStore(bucket_name="b", index_name="i", client=fake_client)

    texts = [make_text("doc", i, [float(i)] * 1024) for i in range(600)]
    await store.add_texts_and_embeddings(texts)

    assert fake_client.put_vectors.call_count == 2
    first_call = fake_client.put_vectors.call_args_list[0]
    second_call = fake_client.put_vectors.call_args_list[1]
    assert len(first_call.kwargs["vectors"]) == 500
    assert len(second_call.kwargs["vectors"]) == 100


@pytest.mark.asyncio
async def test_add_texts_and_embeddings_updates_texts_hashes(fake_client):
    """add_texts_and_embeddings must call super() to update texts_hashes."""
    from vectorstore.s3_vector_store import S3VectorStore
    store = S3VectorStore(bucket_name="b", index_name="i", client=fake_client)

    texts = [make_text("doc", 0, [0.1] * 1024)]
    assert len(store.texts_hashes) == 0

    await store.add_texts_and_embeddings(texts)

    assert len(store.texts_hashes) == 1


def test_clear_paginates_and_deletes(store, fake_client):
    """clear() must paginate list_vectors and delete all."""
    store.clear()

    fake_client.list_vectors.assert_called_once()
    fake_client.delete_vectors.assert_called_once()
    assert len(store.texts_hashes) == 0
