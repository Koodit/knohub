"""Script di ingest rapido per test."""
import asyncio, os, sys
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

from knohub.db.vector_store import VectorStore
from knohub.ingestion.ingest import ingest_text, ingest_url, ingest_pdf


async def main():
    store = VectorStore(db_path="lancedb", openai_api_key=os.environ["OPENAI_API_KEY"])

    if len(sys.argv) < 2:
        # demo default
        await ingest_text(store, """
        Knohub è un framework open-source per creare server MCP con knowledge base RAG.
        Permette di ingestire PDF, URL e testo libero come base di conoscenza.
        Il server espone un tool di ricerca semantica utilizzabile da Claude, ChatGPT e Cursor.
        Sviluppato da Koodit, licenza MIT.
        """, source="knohub-intro.txt")
        print("✅ Testo demo ingestito")

    elif sys.argv[1] == "url":
        url = sys.argv[2]
        await ingest_url(store, url)
        print(f"✅ URL ingestito: {url}")

    elif sys.argv[1] == "pdf":
        path = sys.argv[2]
        with open(path, "rb") as f:
            data = f.read()
        await ingest_pdf(store, data, source=os.path.basename(path))
        print(f"✅ PDF ingestito: {path}")


asyncio.run(main())
