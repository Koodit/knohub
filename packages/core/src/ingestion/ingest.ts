import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { VectorStore, type VectorStoreConfig } from "../db/vectorStore";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function chunkText(text: string, source: string) {
  const chunks: { id: string; source: string; content: string }[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + CHUNK_SIZE);
    if (chunk.trim().length > 50) {
      chunks.push({ id: crypto.randomUUID(), source, content: chunk.trim() });
    }
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function ingestPDF(filePath: string, store: VectorStore) {
  console.log(`Ingesting PDF: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    fullText += pageText + "\n";
  }
  await store.addDocuments(chunkText(fullText, path.basename(filePath)));
}

export async function ingestURL(url: string, store: VectorStore) {
  console.log(`Ingesting URL: ${url}`);
  const res = await axios.get(url, { timeout: 10000 });
  const $ = cheerio.load(res.data);
  $("script, style, nav, footer, header").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  await store.addDocuments(chunkText(text, url));
}

export async function ingestText(text: string, sourceName: string, store: VectorStore) {
  console.log(`Ingesting text: ${sourceName}`);
  await store.addDocuments(chunkText(text, sourceName));
}

// CLI entry point
async function main() {
  require("dotenv").config();
  const [, , type, input] = process.argv;
  if (!type || !input) {
    console.error("Usage: npx tsx src/ingestion/ingest.ts <pdf|url|text> <path|url|text>");
    process.exit(1);
  }

  const storeConfig: VectorStoreConfig = {
    dbPath: process.env.LANCEDB_PATH ?? "lancedb",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  };
  const store = new VectorStore(storeConfig);

  if (type === "pdf") await ingestPDF(input, store);
  else if (type === "url") await ingestURL(input, store);
  else if (type === "text") await ingestText(input, "manual-input", store);
  else console.error("Invalid type. Use: pdf, url, text");
}

// Run only when called directly as CLI
if (require.main === module) {
  main().catch(console.error);
}
