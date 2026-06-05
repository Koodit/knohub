import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock OpenAI and LanceDB — external services
vi.mock("openai", () => ({
  default: class {
    embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: Array.from({ length: 1536 }, (_, i) => i / 1536) }],
      }),
    };
  },
}));

vi.mock("@lancedb/lancedb", () => {
  const rows: any[] = [];
  const mockTable = {
    add: vi.fn().mockImplementation(async (docs: any[]) => rows.push(...docs)),
    vectorSearch: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue(rows),
    }),
  };
  const mockConn = {
    tableNames: vi.fn().mockResolvedValue(["knowledge"]),
    openTable: vi.fn().mockResolvedValue(mockTable),
    createTable: vi.fn().mockResolvedValue(mockTable),
  };
  return { connect: vi.fn().mockResolvedValue(mockConn) };
});

import { VectorStore } from "../src/db/vectorStore";

describe("VectorStore", () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore({ dbPath: "test-db", openaiApiKey: "sk-test" });
  });

  it("embedText returns array of 1536 numbers", async () => {
    const vec = await store.embedText("hello world");
    expect(vec).toHaveLength(1536);
    vec.forEach((n) => expect(typeof n).toBe("number"));
  });

  it("addDocuments embeds each document and stores it", async () => {
    const docs = [
      { id: "1", source: "test.pdf", content: "A".repeat(100) },
      { id: "2", source: "test.pdf", content: "B".repeat(100) },
    ];
    await expect(store.addDocuments(docs)).resolves.not.toThrow();
  });

  it("search returns results from vector store", async () => {
    const results = await store.search("ricambi trapano", 5);
    expect(Array.isArray(results)).toBe(true);
  });

  it("throws when no documents loaded and search is called on empty DB", async () => {
    // Override the tableNames mock to return empty for this test
    const lancedb = await import("@lancedb/lancedb");
    const mockConn = await (lancedb.connect as any)();
    mockConn.tableNames.mockResolvedValueOnce([]); // empty DB for next call

    const emptyStore = new VectorStore({ dbPath: "empty-db", openaiApiKey: "sk-test" });
    await expect(emptyStore.search("query")).rejects.toThrow("No documents loaded");
  });
});
