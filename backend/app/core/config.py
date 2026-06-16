from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./db.sqlite3"
    openai_api_key: str = ""
    app_name: str = "Voico Calls Dashboard"

    # Task 3: Stale call expiry configuration
    stale_call_check_interval_minutes: int = 10   # how often the job runs
    stale_call_threshold_minutes: int = 30         # how long before a call is considered stale


settings = Settings()
