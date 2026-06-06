"""Stdio entry point for Claude Desktop / Cursor / IDE integrations."""
import asyncio
import os
from dotenv import load_dotenv

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(dotenv_path=os.path.join(PROJECT_DIR, ".env"))

from mcp.server.fastmcp import FastMCP
from knohub.config import KnohubConfig
from knohub.db.vector_store import VectorStore
from knohub.server import _make_search_tool

_lancedb_raw = os.getenv("LANCEDB_PATH", "lancedb")
_lancedb_path = _lancedb_raw if os.path.isabs(_lancedb_raw) else os.path.join(PROJECT_DIR, _lancedb_raw)

config = KnohubConfig(
    name=os.getenv("KNOHUB_NAME", "knohub"),
    lancedb_path=_lancedb_path,
    openai_api_key=os.getenv("OPENAI_API_KEY", ""),
)

store = VectorStore(db_path=config.lancedb_path, openai_api_key=config.openai_api_key)

mcp = FastMCP(config.name)
search_fn = _make_search_tool(store, limit=config.search_limit)
mcp.add_tool(search_fn, name="search", description=(
    f"Search the {config.name} knowledge base. "
    "Returns relevant text excerpts from ingested documents."
))

if __name__ == "__main__":
    asyncio.run(mcp.run_stdio_async())
