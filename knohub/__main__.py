"""python -m knohub"""
import os
import uvicorn
from dotenv import load_dotenv
from knohub.config import KnohubConfig
from knohub.server import create_knohub_app

load_dotenv()

config = KnohubConfig(
    name=os.getenv("KNOHUB_NAME", "knohub"),
    lancedb_path=os.getenv("LANCEDB_PATH", "lancedb"),
    openai_api_key=os.getenv("OPENAI_API_KEY", ""),
)

app = create_knohub_app(config)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
