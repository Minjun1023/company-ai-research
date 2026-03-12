from pydantic import BaseSettings


class Settings(BaseSettings):
    environment: str = "local"
    ai_port: int = 8000

    class Config:
        env_prefix = ""
        env_file = [".env"]
