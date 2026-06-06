from dataclasses import dataclass, field


@dataclass
class KnohubConfig:
    name: str
    lancedb_path: str
    openai_api_key: str
    widget_html: str | None = None
    search_limit: int = 5
