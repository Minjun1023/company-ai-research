from fastapi import FastAPI

from .api import health

app = FastAPI(title="Company Research AI Service")
app.include_router(health.router, prefix="/health")


@app.get("/health")
def root_health():
    return {"status": "ok"}
