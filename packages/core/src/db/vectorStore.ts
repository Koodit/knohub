import * as lancedb from "@lancedb/lancedb";
import OpenAI from "openai";

const TABLE_NAME = "knowledge";

export interface Document {
  id: string;
  source: string;
  content: string;
  vector: number[];
}

export interface VectorStoreConfig {
  dbPath: string;
  openaiApiKey: string;
}

export class VectorStore {
  private config: VectorStoreConfig;
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private openai: OpenAI;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  private async getDB() {
    if (!this.db) this.db = await lancedb.connect(this.config.dbPath);
    return this.db;
  }

  private async getTable() {
    if (this.table) return this.table;
    const conn = await this.getDB();
    const names = await conn.tableNames();
    if (!names.includes(TABLE_NAME))
      throw new Error("No documents loaded. Run ingest first.");
    this.table = await conn.openTable(TABLE_NAME);
    return this.table;
  }

  async embedText(text: string): Promise<number[]> {
    const res = await this.openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return res.data[0]!.embedding;
  }

  async addDocuments(docs: Omit<Document, "vector">[]) {
    const withVectors: Document[] = await Promise.all(
      docs.map(async (d) => ({ ...d, vector: await this.embedText(d.content) }))
    );
    const conn = await this.getDB();
    const names = await conn.tableNames();
    if (names.includes(TABLE_NAME)) {
      const t = await conn.openTable(TABLE_NAME);
      await t.add(withVectors);
      this.table = t;
    } else {
      this.table = await conn.createTable(TABLE_NAME, withVectors, { mode: "create" });
    }
    console.log(`Added ${withVectors.length} chunks to vector store.`);
  }

  async search(query: string, limit = 5): Promise<Document[]> {
    const t = await this.getTable();
    const queryVec = await this.embedText(query);
    const results = await t.vectorSearch(queryVec).limit(limit).toArray();
    return results as Document[];
  }
}
