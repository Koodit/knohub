import pytest
import tempfile
import os
from unittest.mock import AsyncMock, patch, MagicMock
from knohub.db.vector_store import VectorStore, Document


@pytest.fixture
def tmp_db(tmp_path):
    return str(tmp_path / "lancedb")


@pytest.fixture
def fake_openai():
    """Mock OpenAI so tests don't call the real API."""
    with patch("knohub.db.vector_store.openai.AsyncOpenAI") as mock_cls:
        client = MagicMock()
        embedding_response = MagicMock()
        embedding_response.data = [MagicMock(embedding=[0.1] * 1536)]
        client.embeddings.create = AsyncMock(return_value=embedding_response)
        mock_cls.return_value = client
        yield client


@pytest.mark.asyncio
async def test_embed_text_returns_vector(tmp_db, fake_openai):
    store = VectorStore(db_path=tmp_db, openai_api_key="test-key")
    vector = await store.embed_text("hello world")
    assert isinstance(vector, list)
    assert len(vector) == 1536


@pytest.mark.asyncio
async def test_add_and_search_documents(tmp_db, fake_openai):
    store = VectorStore(db_path=tmp_db, openai_api_key="test-key")
    docs = [
        Document(id="1", text="trapano a batteria 18V", source="manual.pdf"),
        Document(id="2", text="sega circolare 1200W", source="manual.pdf"),
    ]
    await store.add_documents(docs)
    results = await store.search("trapano", limit=1)
    assert len(results) == 1
    assert results[0].id == "1"


@pytest.mark.asyncio
async def test_search_empty_store_returns_empty(tmp_db, fake_openai):
    store = VectorStore(db_path=tmp_db, openai_api_key="test-key")
    results = await store.search("qualcosa")
    assert results == []


@pytest.mark.asyncio
async def test_add_documents_twice_appends(tmp_db, fake_openai):
    store = VectorStore(db_path=tmp_db, openai_api_key="test-key")
    await store.add_documents([Document(id="1", text="primo", source="a.pdf")])
    await store.add_documents([Document(id="2", text="secondo", source="b.pdf")])
    results = await store.search("qualcosa", limit=10)
    assert len(results) == 2
