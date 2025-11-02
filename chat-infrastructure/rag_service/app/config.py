from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_host: str = Field("0.0.0.0", alias="APP_HOST")
    app_port: int = Field(8081, alias="APP_PORT")
    qdrant_host: str = Field("localhost", alias="QDRANT_HOST")
    qdrant_port: int = Field(6333, alias="QDRANT_PORT")
    qdrant_collection: str = Field("restaurant-faq", alias="QDRANT_COLLECTION")
    redis_url: str = Field("redis://localhost:6379/0", alias="REDIS_URL")
    ollama_host: str = Field("http://localhost:11434", alias="OLLAMA_HOST")
    ollama_embed_model: str = Field("nomic-embed-text", alias="OLLAMA_EMBED_MODEL")
    ollama_generate_model: str = Field("mistral:7b-instruct", alias="OLLAMA_GENERATE_MODEL")
    max_result_chunks: int = Field(5, alias="MAX_RESULT_CHUNKS")
    cache_ttl_seconds: int = Field(600, alias="CACHE_TTL_SECONDS")
    cors_allow_origins: str = Field("*", alias="CORS_ALLOW_ORIGINS")
    admin_api_key: str = Field("", alias="RAG_ADMIN_API_KEY")
    db_uri: str | None = Field(default=None, alias="DB_URI")
    db_host: str | None = Field(default=None, alias="DB_HOST")
    db_port: int | None = Field(default=None, alias="DB_PORT")
    db_name: str | None = Field(default=None, alias="DB_NAME")
    db_user: str | None = Field(default=None, alias="DB_USER")
    db_password: str | None = Field(default=None, alias="DB_PASSWORD")
    db_dialect: str | None = Field(default=None, alias="DB_DIALECT")
    clarification_model_path: str = Field(
        default="notebooks/menu_query_training/artifacts/clarification_model.joblib",
        alias="CLARIFICATION_MODEL_PATH"
    )
    clarification_model_reload_seconds: int = Field(
        default=60,
        alias="CLARIFICATION_MODEL_RELOAD_SECONDS"
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_allow_origins_list(self) -> list[str]:
        value = (self.cors_allow_origins or "").strip()
        if not value or value == "*":
            return ["*"]
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]
