import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from knohub.ingestion.ingest import chunk_text, ingest_text, ingest_url


CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


# ── chunk_text ────────────────────────────────────────────────────────────────

def test_chunk_text_short_input_is_single_chunk():
    text = "Ciao mondo"
    chunks = chunk_text(text, source="test")
    assert len(chunks) == 1
    assert chunks[0].text == "Ciao mondo"
    assert chunks[0].source == "test"


def test_chunk_text_long_input_splits():
    text = "".join(str(i % 10) for i in range(CHUNK_SIZE * 2))
    chunks = chunk_text(text, source="test")
    assert len(chunks) >= 2
    for c in chunks:
        assert len(c.text) <= CHUNK_SIZE


def test_chunk_text_overlap():
    # use position-unique chars so overlap is detectable
    text = "".join(chr(ord("a") + (i % 26)) + str(i).zfill(3) for i in range(300))
    chunks = chunk_text(text, source="test")
    if len(chunks) >= 2:
        tail = chunks[0].text[-CHUNK_OVERLAP:]
        head = chunks[1].text[:CHUNK_OVERLAP]
        assert tail == head


def test_chunk_text_assigns_unique_ids():
    text = "x" * (CHUNK_SIZE * 3)
    chunks = chunk_text(text, source="test")
    ids = [c.id for c in chunks]
    assert len(ids) == len(set(ids))


# ── ingest_text ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ingest_text_calls_add_documents():
    mock_store = MagicMock()
    mock_store.add_documents = AsyncMock()
    await ingest_text(store=mock_store, text="Testo di prova lungo " * 10, source="test.txt")
    mock_store.add_documents.assert_called_once()
    docs = mock_store.add_documents.call_args[0][0]
    assert len(docs) >= 1


# ── ingest_url ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ingest_url_fetches_and_stores():
    mock_store = MagicMock()
    mock_store.add_documents = AsyncMock()

    html = "<html><body><p>Contenuto della pagina web di test.</p></body></html>"

    with patch("knohub.ingestion.ingest.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.text = html
        mock_resp.raise_for_status = MagicMock()
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_cls.return_value = mock_client

        await ingest_url(store=mock_store, url="https://example.com")

    mock_store.add_documents.assert_called_once()
