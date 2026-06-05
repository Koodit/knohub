# Knohub

**Build MCP servers with flexible knowledge bases. Ship in minutes.**

Knohub is an open-source framework for creating [Model Context Protocol](https://modelcontextprotocol.io) servers backed by a RAG knowledge base. Load your documents, start the server, connect to ChatGPT, Claude, or any MCP client.

## Features

- 📄 **Ingest anything** — PDF, URLs, plain text
- 🔍 **Semantic search** — vector embeddings via OpenAI
- 🧩 **MCP-native** — SSE transport, works with ChatGPT, Claude, Cursor
- 🐳 **Docker deploy** — self-host anywhere
- 🎛️ **Widget UI** — embedded iframe in ChatGPT

## Quick start

```bash
git clone https://github.com/koodit/knohub
cd knohub
cp .env.example .env  # add your OPENAI_API_KEY

# Load documents
npm run ingest pdf ./docs/manual.pdf
npm run ingest url https://yoursite.com/page

# Start server
docker compose up
```

Connect `https://your-server/mcp` to ChatGPT or Claude.

## License

MIT — see [LICENSE](LICENSE)

---

> **Knohub Cloud** — managed hosting, admin UI, multi-tenant — coming soon at knohub.io
