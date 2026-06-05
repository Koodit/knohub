# Knohub

Framework open-source (MIT) per creare MCP server con knowledge base RAG.

## Cos'è

Knohub permette di costruire un MCP server con base informativa flessibile (PDF, URL, testo) deployabile via Docker, collegabile a ChatGPT, Claude, Cursor e qualsiasi client MCP.

## Struttura repo

```
packages/
  core/          ← engine principale (MIT)
    src/
      server/    ← MCP server (SSE transport)
      rag/       ← vector store (LanceDB + OpenAI embeddings)
      ingest/    ← CLI ingest PDF/URL/testo
      tools/     ← tool search_knowledge
```

## Stack

- Runtime: Node.js + TypeScript
- MCP: @modelcontextprotocol/sdk
- Vector store: LanceDB (file-based, zero infra)
- Embeddings: OpenAI text-embedding-3-small
- Transport: SSE (GET /mcp + POST /mcp/messages)
- Deploy: Docker only

## Principi

- **Semplicità prima** — no complessità prematura
- **Self-hostable** — Docker, nessun vendor lock-in
- **Plugin-ready** — ingest source e deploy adapter estendibili in futuro
- **Open-core** — core MIT, cloud (knohub.io) proprietario separato

## Comandi

```bash
# Installa dipendenze
npm install

# Ingest documenti
npm run ingest pdf ./docs/manuale.pdf
npm run ingest url https://example.com
npm run ingest text "testo libero" nome-sorgente

# Avvia server
npm start          # sviluppo
docker compose up  # produzione

# Build widget UI
npm run build:widget
```

## Variabili ambiente

```
OPENAI_API_KEY=sk-...   # obbligatorio per embeddings
PORT=3000               # default 3000
```

## Git workflow

Branch: `main` (stabile) + `feature/*` per sviluppo.
No attribution "Co-Authored-By: Claude" nei commit.
