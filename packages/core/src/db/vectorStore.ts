import * as lancedb from "@lancedb/lancedb";
import OpenAI from "openai";
import path from "path";

const DB_PATH = path.join(process.cwd(), "lancedb");
const TABLE_NAME = "knowledge";

export interface Document {
  id: string;
  source: string;
  content: string;
  vector: number[];
}

let db: lancedb.Connection | null = null;
let table: lancedb.Table | null = null;

async function getDB() {
  if (!db) db = await lancedb.connect(DB_PATH);
  return db;
}

async function getTable() {
  if (table) return table;
  const conn = await getDB();
  const names = await conn.tableNames();
  if (!names.includes(TABLE_NAME)) throw new Error("Nessun documento caricato. Esegui prima npm run ingest.");
  table = await conn.openTable(TABLE_NAME);
  return table;
}

export async function embedText(text: string): Promise<number[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0]!.embedding;
}

export async function addDocuments(docs: Omit<Document, "vector">[]) {
  const withVectors: Document[] = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      vector: await embedText(d.content),
    }))
  );

  const conn = await getDB();
  const names = await conn.tableNames();
  if (names.includes(TABLE_NAME)) {
    const t = await conn.openTable(TABLE_NAME);
    await t.add(withVectors);
    table = t;
  } else {
    table = await conn.createTable(TABLE_NAME, withVectors, { mode: "create" });
  }
  console.log(`Aggiunti ${withVectors.length} chunk al vector store.`);
}

export async function searchKnowledge(query: string, limit = 5): Promise<Document[]> {
  const t = await getTable();
  const queryVec = await embedText(query);
  const results = await t.vectorSearch(queryVec).limit(limit).toArray();
  return results as Document[];
}
