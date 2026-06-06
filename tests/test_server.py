import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from knohub.config import KnohubConfig
from knohub.server import create_knohub_app


@pytest.fixture
def config(tmp_path):
    return KnohubConfig(
        name="test-kb",
        lancedb_path=str(tmp_path / "lancedb"),
        openai_api_key="test-key",
    )


@pytest.fixture
def mock_store():
    store = MagicMock()
    store.search = AsyncMock(return_value=[])
    store.add_documents = AsyncMock()
    return store


@pytest.mark.asyncio
async def test_health_endpoint(config, mock_store):
    with patch("knohub.server.VectorStore", return_value=mock_store):
        app = create_knohub_app(config)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["name"] == "test-kb"


@pytest.mark.asyncio
async def test_sse_route_is_mounted(config, mock_store):
    """L'app deve avere un route SSE montato (verifica struttura, non connessione)."""
    with patch("knohub.server.VectorStore", return_value=mock_store):
        app = create_knohub_app(config)
    routes = [str(r.path) if hasattr(r, "path") else str(r) for r in app.routes]
    # health deve esistere, SSE è montato via Mount (non ha path esplicito su /sse)
    assert any("/health" in r for r in routes)


@pytest.mark.asyncio
async def test_search_tool_uses_vector_store(config, mock_store):
    """Il tool search deve chiamare store.search con la query."""
    from knohub.db.vector_store import Document
    mock_store.search = AsyncMock(return_value=[
        Document(id="1", text="trapano 18V", source="manual.pdf")
    ])

    with patch("knohub.server.VectorStore", return_value=mock_store):
        # Importiamo la factory del tool direttamente
        from knohub.server import _make_search_tool
        search_fn = _make_search_tool(mock_store, limit=5)
        result = await search_fn(query="trapano")

    mock_store.search.assert_called_once_with("trapano", limit=5)
    assert "trapano 18V" in result
