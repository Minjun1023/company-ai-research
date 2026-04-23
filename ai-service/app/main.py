import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

from .api import health
from .api import crawl
from .api import embedding
from .api import qa
from .api import search
from .api import intent
from .api import compare
from .api import research
from .api import interview
from .api import coverletter
from .api import salary
from .api import interview_practice
from .api import general_chat
from .api import resume


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 DART 법인 코드 캐시를 미리 로드한다.
    # 첫 검색 요청 시 10-20MB XML 다운로드로 인한 타임아웃을 방지하기 위함.
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from .services.jobs.dart_service import _load_corp_code_map, _API_KEY

    api_key = _API_KEY()
    if api_key and not api_key.startswith("your_"):
        logger.info("[Startup] DART 법인 코드 캐시 로딩 시작...")
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as pool:
            corp_map = await loop.run_in_executor(pool, _load_corp_code_map, api_key)
        logger.info("[Startup] DART 법인 코드 캐시 로딩 완료: %d개", len(corp_map))
    else:
        logger.warning("[Startup] DART_API_KEY 미설정 — DART 검색 비활성화")

    yield


app = FastAPI(title="Company Research AI Service", lifespan=lifespan)
app.include_router(health.router, prefix="/health")
app.include_router(crawl.router, prefix="/internal")
app.include_router(embedding.router, prefix="/internal")
app.include_router(qa.router, prefix="/internal")
app.include_router(search.router, prefix="/internal")
app.include_router(intent.router, prefix="/internal")
app.include_router(compare.router, prefix="/internal")
app.include_router(research.router, prefix="/internal")
app.include_router(interview.router, prefix="/internal")
app.include_router(coverletter.router, prefix="/internal")
app.include_router(salary.router, prefix="/internal")
app.include_router(interview_practice.router, prefix="/internal")
app.include_router(general_chat.router, prefix="/internal")
app.include_router(resume.router, prefix="/internal")


@app.get("/health")
def root_health():
    return {"status": "ok"}
