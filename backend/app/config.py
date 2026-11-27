from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://bloodapp:bloodapp@localhost:5432/bloodapp"
    secret_key: str = "change-this-development-key-before-deploying"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True
    password_reset_expire_minutes: int = 30
    seed_demo_donors: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
