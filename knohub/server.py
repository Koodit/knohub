from __future__ import annotations

from typing import Callable, Awaitable

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from knohub.config import KnohubConfig
from knohub.db.vector_store import Document, VectorStore


def _make_search_tool(store: VectorStore, limit: int) -> Callable[[str], Awaitable[str]]:
    """Factory that returns a search function bound to a VectorStore instance."""

    async def search(query: str) -> str:
        """Search the knowledge base for relevant information.

        Args:
            query: The search query in natural language.
        """
        results: list[Document] = await store.search(query, limit=limit)
        if not results:
            return "No results found for your query."

        lines = []
        for i, doc in enumerate(results, 1):
            lines.append(f"[{i}] Source: {doc.source}\n{doc.text}")
        return "\n\n---\n\n".join(lines)

    return search


def create_knohub_app(config: KnohubConfig) -> FastAPI:
    """Create a FastAPI app with MCP SSE endpoint and health check."""

    store = VectorStore(db_path=config.lancedb_path, openai_api_key=config.openai_api_key)

    # MCP server — allow localhost + ngrok hosts
    security = TransportSecuritySettings(
        allowed_hosts=["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000"],
        allowed_origins=["*"],
    )
    mcp = FastMCP(config.name, transport_security=security)
    search_fn = _make_search_tool(store, limit=config.search_limit)
    mcp.add_tool(search_fn, name="search", description=(
        f"Search the {config.name} knowledge base. "
        "Returns relevant text excerpts from ingested documents."
    ))

    # FastAPI wrapper
    app = FastAPI(title=config.name)

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "name": config.name})

    # Mount MCP SSE app at /sse and messages at /messages
    sse_app = mcp.sse_app()
    app.mount("/", sse_app)

    return app
