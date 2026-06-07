from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import List, Optional

import lancedb
import openai
import pyarrow as pa


TABLE_NAME = "documents"
EMBEDDING_MODEL = "text-embedding-3-small"
DIMS = 1536


@dataclass
class Document:
    id: str
    text: str
    source: str
    vector: List[float] = field(default_factory=list)


class VectorStore:
    def __init__(self, db_path: str, openai_api_key: str) -> None:
        self._db_path = db_path
        self._client = openai.AsyncOpenAI(api_key=openai_api_key)

    def _get_db(self) -> lancedb.DBConnection:
        return lancedb.connect(self._db_path)

    async def embed_text(self, text: str) -> List[float]:
        response = await self._client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text,
        )
        return response.data[0].embedding

    def _add_documents_sync(self, rows: list, schema: pa.Schema) -> None:
        db = self._get_db()
        table_names = db.list_tables()
        if TABLE_NAME in table_names:
            tbl = db.open_table(TABLE_NAME)
            tbl.add(rows)
        else:
            db.create_table(TABLE_NAME, data=rows, schema=schema)

    async def add_documents(self, docs: List[Document]) -> None:
        if not docs:
            return

        schema = pa.schema([
            pa.field("id", pa.string()),
            pa.field("text", pa.string()),
            pa.field("source", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), DIMS)),
        ])

        rows = []
        for doc in docs:
            vector = await self.embed_text(doc.text)
            rows.append({
                "id": doc.id,
                "text": doc.text,
                "source": doc.source,
                "vector": vector,
            })

        await asyncio.to_thread(self._add_documents_sync, rows, schema)

    def _search_sync(self, vector: List[float], limit: int) -> List[Document]:
        db = self._get_db()
        if TABLE_NAME not in db.list_tables():
            return []
        tbl = db.open_table(TABLE_NAME)
        results = tbl.search(vector).limit(limit).to_list()
        return [
            Document(id=r["id"], text=r["text"], source=r["source"], vector=list(r["vector"]))
            for r in results
        ]

    def _list_sources_sync(self) -> List[dict]:
        db = self._get_db()
        if TABLE_NAME not in db.list_tables():
            return []
        tbl = db.open_table(TABLE_NAME)
        rows = tbl.to_pandas()[["id", "source"]].to_dict("records")
        # Count chunks per source
        counts: dict = {}
        for r in rows:
            counts[r["source"]] = counts.get(r["source"], 0) + 1
        return [{"source": s, "chunks": n} for s, n in sorted(counts.items())]

    async def list_sources(self) -> List[dict]:
        return await asyncio.to_thread(self._list_sources_sync)

    async def search(self, query: str, limit: int = 5) -> List[Document]:
        vector = await self.embed_text(query)
        return await asyncio.to_thread(self._search_sync, vector, limit)
