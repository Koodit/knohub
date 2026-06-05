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
import { VectorStore } from "./db/vectorStore";

export interface KnohubConfig {
  name: string;
  version?: string;
  lancedbPath: string;
  openaiApiKey: string;
  widgetHtml?: string;       // custom widget HTML — defaults to built-in
  searchLimit?: number;      // default 5
}

export interface KnohubServer {
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

const TEMPLATE_URI = "ui://widget/knowledge.html";

function defaultWidgetHtml(): string {
  try {
    const js = readFileSync(path.join(process.cwd(), "web/dist/widget.iife.js"), "utf8");
    return `<div id="root"></div>\n<script>${js}</script>`;
  } catch {
    return `<div style="padding:16px;font-family:system-ui">
      <script>
        function render(data) {
          if (!data) return;
          document.body.innerHTML = '<div style="padding:16px"><h3>' + data.query + '</h3><p>' + data.results.length + ' results</p></div>';
        }
        render(window.openai?.toolOutput);
        window.addEventListener('openai:set_globals', (e) => render(e.detail?.globals?.toolOutput), { passive: true });
      </script>
    </div>`;
  }
}

function buildTools(name: string): Tool[] {
  return [
    {
      name: "search_knowledge",
      title: `Search ${name}`,
      description:
        "Search the loaded knowledge base (manuals, product sheets, web pages, text). Use this tool to answer questions about products, instructions, spare parts, coverage, availability and any information provided.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The question or term to search for" },
        },
        required: ["query"],
      },
      _meta: {
        "openai/outputTemplate": TEMPLATE_URI,
        "openai/toolInvocation/invoking": "Searching knowledge base…",
        "openai/toolInvocation/invoked": "Results found.",
        "openai/widgetAccessible": true,
      },
      annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: true },
    },
  ];
}

function createMcpServer(config: KnohubConfig, store: VectorStore): Server {
  const tools = buildTools(config.name);
  const widgetHtml = config.widgetHtml ?? defaultWidgetHtml();
  const searchLimit = config.searchLimit ?? 5;

  const server = new Server(
    { name: config.name, version: config.version ?? "1.0.0" },
    { capabilities: { resources: {}, tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: TEMPLATE_URI, name: "Knowledge Widget", mimeType: "text/html;profile=mcp-app" }],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async () => ({
    contents: [{ uri: TEMPLATE_URI, mimeType: "text/html;profile=mcp-app", text: widgetHtml }],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { query } = z.object({ query: z.string() }).parse(request.params.arguments ?? {});
    const results = await store.search(query, searchLimit);
    const structuredContent = {
      query,
      results: results.map((r) => ({ source: r.source, content: r.content })),
    };
    const textSummary =
      results.length === 0
        ? "No information found."
        : results.map((r, i) => `[${i + 1}] ${r.source}\n${r.content.slice(0, 300)}`).join("\n\n---\n\n");
    return {
      content: [{ type: "text" as const, text: textSummary }],
      structuredContent,
      _meta: { "openai/outputTemplate": TEMPLATE_URI },
    };
  });

  return server;
}

/**
 * Creates a Knohub HTTP request handler.
 * Can be used standalone (createHttpServer) or embedded in existing HTTP servers.
 */
export function createKnohubHandler(config: KnohubConfig): KnohubServer {
  const store = new VectorStore({
    dbPath: config.lancedbPath,
    openaiApiKey: config.openaiApiKey,
  });

  const sessions: Record<string, SSEServerTransport> = {};

  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (url.pathname === "/mcp" || url.pathname === "/")) {
      const server = createMcpServer(config, store);
      const transport = new SSEServerTransport("/mcp/messages", res);
      sessions[transport.sessionId] = transport;
      res.on("close", () => {
        delete sessions[transport.sessionId];
        server.close();
      });
      await server.connect(transport);
      return;
    }

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
      res.end(JSON.stringify({ status: "ok", name: config.name }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  };

  return { handleRequest };
}

/**
 * Starts a standalone HTTP server with Knohub.
 */
export function startKnohubServer(config: KnohubConfig & { port?: number }) {
  const port = config.port ?? 3000;
  const { handleRequest } = createKnohubHandler(config);
  const httpServer = createServer(handleRequest);
  httpServer.listen(port, () => {
    console.log(`Knohub "${config.name}" listening on http://localhost:${port}/mcp`);
  });
  setInterval(() => {}, 30000); // keep alive (LanceDB closes event loop)
  return httpServer;
}

// Re-export for convenience
export { VectorStore } from "./db/vectorStore";
export { ingestPDF, ingestURL, ingestText } from "./ingestion/ingest";
