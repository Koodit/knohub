import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import axios from "axios";
import * as cheerio from "cheerio";
import { addDocuments } from "../db/vectorStore";
import crypto from "crypto";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function chunkText(text: string, source: string) {
  const chunks: { id: string; source: string; content: string }[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + CHUNK_SIZE);
    if (chunk.trim().length > 50) {
      chunks.push({
        id: crypto.randomUUID(),
        source,
        content: chunk.trim(),
      });
    }
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function ingestPDF(filePath: string) {
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
  const chunks = chunkText(fullText, path.basename(filePath));
  await addDocuments(chunks);
}

export async function ingestURL(url: string) {
  console.log(`Ingesting URL: ${url}`);
  const res = await axios.get(url, { timeout: 10000 });
  const $ = cheerio.load(res.data);
  $("script, style, nav, footer, header").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const chunks = chunkText(text, url);
  await addDocuments(chunks);
}

export async function ingestText(text: string, sourceName: string) {
  console.log(`Ingesting testo: ${sourceName}`);
  const chunks = chunkText(text, sourceName);
  await addDocuments(chunks);
}

// CLI: node -r tsx/esm src/ingestion/ingest.ts <pdf|url|text> <path|url|"testo">
async function main() {
  const [, , type, input] = process.argv;
  if (!type || !input) {
    console.error("Uso: npx tsx src/ingestion/ingest.ts <pdf|url|text> <percorso|url|testo>");
    process.exit(1);
  }
  require("dotenv").config();
  if (type === "pdf") await ingestPDF(input);
  else if (type === "url") await ingestURL(input);
  else if (type === "text") await ingestText(input, "manual-input");
  else console.error("Tipo non valido. Usa: pdf, url, text");
}

main().catch(console.error);
