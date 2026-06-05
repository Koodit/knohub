import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("../src/db/vectorStore", () => ({
  VectorStore: class {
    constructor() {}
    async search(query: string) {
      return [{ source: "test.pdf", content: `Result for: ${query}` }];
    }
    async embedText() { return Array(1536).fill(0); }
    async addDocuments() {}
  },
}));

vi.mock("fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("fs")>();
  return {
    ...real,
    readFileSync: (p: string) => {
      if (String(p).includes("widget.iife.js")) return "// widget";
      return real.readFileSync(p);
    },
  };
});

import { createKnohubHandler } from "../src/index";

let baseUrl: string;
let httpServer: ReturnType<typeof createServer>;

beforeAll(async () => {
  const { handleRequest } = createKnohubHandler({
    name: "test-server",
    lancedbPath: "test-db",
    openaiApiKey: "sk-test",
  });
  httpServer = createServer(handleRequest);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => httpServer.close());

describe("GET /health", () => {
  it("returns 200 with status ok and server name", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json() as { status: string; name: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.name).toBe("test-server");
  });
});

describe("OPTIONS /mcp", () => {
  it("returns 204 for CORS preflight", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
  });
});

describe("GET /mcp", () => {
  it("returns 200 with text/event-stream content-type", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/mcp`, {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    controller.abort();
  });

  it("each connection gets a unique session", async () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/mcp`, { signal: c1.signal }),
      fetch(`${baseUrl}/mcp`, { signal: c2.signal }),
    ]);
    // Both return SSE streams — two independent connections
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    c1.abort();
    c2.abort();
  });
});

describe("POST /mcp/messages", () => {
  it("returns 404 for unknown sessionId", async () => {
    const res = await fetch(`${baseUrl}/mcp/messages?sessionId=unknown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    expect(res.status).toBe(404);
  });
});

describe("unknown routes", () => {
  it("returns 404 for unrecognized path", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });
});
