from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from typing import List

import httpx
from bs4 import BeautifulSoup

from knohub.db.vector_store import Document, VectorStore

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def chunk_text(text: str, source: str) -> List[Document]:
    """Split text into overlapping chunks."""
    chunks: List[Document] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end]
        chunk_id = hashlib.md5(f"{source}:{start}".encode()).hexdigest()
        chunks.append(Document(id=chunk_id, text=chunk, source=source))
        if end == len(text):
            break
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


async def ingest_text(store: VectorStore, text: str, source: str) -> None:
    docs = chunk_text(text, source)
    await store.add_documents(docs)


async def ingest_url(store: VectorStore, url: str) -> None:
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove scripts and styles
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)

    await ingest_text(store=store, text=text, source=url)


async def ingest_pdf(store: VectorStore, pdf_bytes: bytes, source: str) -> None:
    from pypdf import PdfReader
    import io

    reader = PdfReader(io.BytesIO(pdf_bytes))
    full_text = " ".join(
        page.extract_text() or "" for page in reader.pages
    )
    await ingest_text(store=store, text=full_text, source=source)
