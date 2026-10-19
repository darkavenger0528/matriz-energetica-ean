from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    seed_on_startup: bool = True


settings = Settings()
