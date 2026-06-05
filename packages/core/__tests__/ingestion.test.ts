import { describe, it, expect } from "vitest";
import { chunkText } from "../src/ingestion/ingest";

describe("chunkText", () => {
  it("returns empty array for text shorter than 50 chars", () => {
    const chunks = chunkText("short text", "src");
    expect(chunks).toHaveLength(0);
  });

  it("returns single chunk for text between 50 and 800 chars", () => {
    const text = "A".repeat(100);
    const chunks = chunkText(text, "src");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(text);
  });

  it("splits text longer than CHUNK_SIZE (800) into multiple chunks", () => {
    const text = "A".repeat(2000);
    const chunks = chunkText(text, "src");
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk is at most 800 characters", () => {
    const text = "A".repeat(5000);
    const chunks = chunkText(text, "src");
    chunks.forEach((c) => expect(c.content.length).toBeLessThanOrEqual(800));
  });

  it("chunks overlap by 100 characters", () => {
    // Each position gets a unique char so overlap is detectable
    // 2000 chars using position-based unique content
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const text = Array.from({ length: 2000 }, (_, i) => chars[i % chars.length]).join("");
    const chunks = chunkText(text, "src");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // last 100 chars of chunk0 must equal first 100 chars of chunk1
    const end0 = chunks[0]!.content.slice(-100);
    const start1 = chunks[1]!.content.slice(0, 100);
    expect(end0).toBe(start1);
  });

  it("assigns the given source to every chunk", () => {
    const text = "X".repeat(1000);
    const chunks = chunkText(text, "my-source");
    chunks.forEach((c) => expect(c.source).toBe("my-source"));
  });

  it("assigns unique UUID to each chunk", () => {
    const text = "Y".repeat(2000);
    const chunks = chunkText(text, "src");
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("trims whitespace from chunk content", () => {
    const text = "  " + "A".repeat(100) + "  ";
    const chunks = chunkText(text, "src");
    expect(chunks[0]!.content).toBe("A".repeat(100));
  });
});
