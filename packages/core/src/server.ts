import "dotenv/config";
import { startKnohubServer } from "./index";

startKnohubServer({
  name: process.env.KNOHUB_NAME ?? "knohub",
  lancedbPath: process.env.LANCEDB_PATH ?? "lancedb",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
});
