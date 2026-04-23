# Company Research AI

Company Research AI는 회사 웹사이트, DART 공시, 뉴스 데이터를 바탕으로 회사 분석과 질의응답을 제공하는 프로젝트입니다.

## 현재 구현 범위

- 회사 CRUD
- 회사 크롤링 요청 → AI Service 호출
- 문서 임베딩 저장 및 유사도 검색
- 질문 기반 회사 Q&A
- 채팅 오케스트레이션 기반 회사 비교 분석
- 심층 리서치 리포트
- 자기소개서 초안/첨삭, 면접 준비/모의 면접, 연봉 협상 상담
- 뉴스 검색 및 일반 대화 fallback
- 회사 선택/홈페이지 URL 직접 입력을 포함한 대화형 회사 등록 보조
- 대화 세션/메시지/아티팩트 저장

## 아키텍처

Frontend (React SPA)  
→ `Spring Boot` Backend  
→ `FastAPI` AI Service  
→ `PostgreSQL + pgvector`

## 기술 스택

- Spring Boot 3.x + Web MVC + JPA
- FastAPI + Pydantic
- PostgreSQL + pgvector
- Docker / Docker Compose
- OpenAI API (임베딩/응답용)

## 폴더 구조

- `backend/` : Spring Boot API 서버
- `ai-service/` : FastAPI AI 파이프라인
- `infra/` : Docker/DB 초기화 SQL
- `docs/` : 프로젝트 문서
- `.env` : 실행 환경 변수

## 환경 변수

프로젝트는 단일 `.env` 사용 기준입니다.

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=company_research
POSTGRES_PORT=5433
BACKEND_PORT=8080
AI_SERVICE_PORT=8000

OPENAI_API_KEY=...
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/company_research
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
SPRING_PROFILES_ACTIVE=local
```

`OPENAI_API_KEY`와 비밀값은 운영에서는 GitHub Actions Secret 또는 서버 Secret Manager로 주입하고, 레포에 커밋되지 않도록 관리합니다.

## 실행 가이드

### Docker로 실행 (권장)

```bash
cp .env.example .env  # 값 반영 후
docker compose up -d postgres          # DB 먼저 실행
docker compose up -d backend ai-service # API 컨테이너 실행

curl -s http://localhost:8080/actuator/health
curl -s http://localhost:8000/health
docker compose ps
```

### 로컬 + Docker DB 실행

DB는 Docker에서 유지하고, 필요 시 백엔드/AI 서비스는 로컬에서 직접 실행할 수 있습니다.

- Backend
  ```bash
  cd backend
  ./gradlew bootRun
  ```
- AI Service
  ```bash
  cd ai-service
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```

## API 정리 (핵심)

- `POST /companies`
- `GET /companies`
- `GET /companies/search?q=`
- `GET /companies/candidates?name=`
- `GET /companies/find-url?name=`
- `GET /companies/{id}`
- `POST /companies/{id}/crawl`
- `PATCH /companies/{id}`
- `DELETE /companies/{id}`
- `POST /companies/{id}/documents/search`
- `POST /companies/{id}/questions`
- `GET /companies/{id}/questions`
- `POST /companies/{id}/questions/ask`
- `POST /companies/{id}/research`
- `POST /companies/{id}/coverletter`
- `POST /companies/{id}/interview`
- `POST /companies/{id}/salary`
- `POST /chat/respond`
- `GET /conversations`
- `POST /conversations`
- `PATCH /conversations/{id}`
- `DELETE /conversations/{id}`
- `POST /conversations/{id}/messages`
- `GET /conversations/{id}/artifacts`
- `GET /auth/email/check`
- `POST /auth/email/send-code`
- `POST /auth/email/verify`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/password/check-same`
- `POST /auth/password/verify`
- `PUT /auth/password/change`
- `POST /auth/password/reset`
- `PUT /auth/profile`
- `POST /auth/profile/resume-upload`
- `DELETE /auth/account`
- `POST /auth/social/google`
- `POST /auth/social/kakao`
- `POST /auth/social/naver`

## 채팅 기반 기능

`POST /chat/respond`는 단순 QA 외에도 아래 기능의 진입점으로 동작합니다.

- 회사 비교
- 심층 리서치
- 면접 준비
- 모의 면접
- 자기소개서 작성 상담
- 자기소개서 피드백
- 연봉 협상 상담
- 뉴스 검색
- 일반 대화 fallback

## Docs

- `AGENTS.md` 작업 원칙
- `PRODUCT_SENSE.md` 제품 방향
- `ARCHITECTURE.md` 시스템 구조
- `DESIGN.md` UI/UX 원칙
- `FRONTEND.md` 프론트엔드 가이드
- `DEVELOPMENT_GUIDE.md` 개발 세팅
- `RAG_DESIGN.md` RAG 및 AI 응답 흐름
- `SERVICE_READINESS_PLAN.md` 서비스화 리팩터링 계획
- `SYSTEM_FLOW.md` 요청 처리 흐름
- `TROUBLE_SHOOTING.md` 변경/문제 해결 기록
