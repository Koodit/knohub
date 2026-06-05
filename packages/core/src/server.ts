import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { searchKnowledge } from "./db/vectorStore";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const WIDGET_JS = readFileSync(path.join(process.cwd(), "web/dist/widget.iife.js"), "utf8");
const TEMPLATE_URI = "ui://widget/knowledge.html";
const WIDGET_HTML = `<div id="root"></div>\n<script>${WIDGET_JS}</script>`;

const tools: Tool[] = [
  {
    name: "search_knowledge",
    title: "Cerca nella knowledge base",
    description:
      "Cerca nelle informazioni caricate (manuali, schede prodotto, siti web, testi). Usa questo tool per rispondere a domande su prodotti, istruzioni, ricambi, coperture, disponibilità e qualsiasi informazione fornita dal cliente.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "La domanda da cercare nella knowledge base" },
      },
      required: ["query"],
    },
    _meta: {
      "openai/outputTemplate": TEMPLATE_URI,
      "openai/toolInvocation/invoking": "Cerco nella knowledge base…",
      "openai/toolInvocation/invoked": "Risultati trovati.",
      "openai/widgetAccessible": true,
    },
    annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
  },
];

function createMcpServer(): Server {
  const server = new Server(
    { name: "knowledge-mcp", version: "1.0.0" },
    { capabilities: { resources: {}, tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: TEMPLATE_URI, name: "Knowledge Widget", mimeType: "text/html;profile=mcp-app" }],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async () => ({
    contents: [{ uri: TEMPLATE_URI, mimeType: "text/html;profile=mcp-app", text: WIDGET_HTML }],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { query } = z.object({ query: z.string() }).parse(request.params.arguments ?? {});
    const results = await searchKnowledge(query, 5);
    const structuredContent = {
      query,
      results: results.map((r) => ({ source: r.source, content: r.content })),
    };
    const textSummary =
      results.length === 0
        ? "Nessuna informazione trovata."
        : results.map((r, i) => `[${i + 1}] ${r.source}\n${r.content.slice(0, 300)}`).join("\n\n---\n\n");
    return {
      content: [{ type: "text" as const, text: textSummary }],
      structuredContent,
      _meta: { "openai/outputTemplate": TEMPLATE_URI },
    };
  });

  return server;
}

const sessions: Record<string, SSEServerTransport> = {};

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /mcp — apre stream SSE
  if (req.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/")) {
    const server = createMcpServer();
    const transport = new SSEServerTransport("/mcp/messages", res);
    sessions[transport.sessionId] = transport;
    res.on("close", () => {
      delete sessions[transport.sessionId];
      server.close();
    });
    await server.connect(transport);
    return;
  }

  // POST /mcp/messages — messaggi della sessione SSE
  if (req.method === "POST" && url.pathname === "/mcp/messages") {
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const transport = sessions[sessionId];
    if (!transport) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }
    await transport.handlePostMessage(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

const httpServer = createServer(handleRequest);
httpServer.listen(PORT, () => {
  console.log(`MCP server in ascolto su http://localhost:${PORT}/mcp`);
});

setInterval(() => {}, 30000);
