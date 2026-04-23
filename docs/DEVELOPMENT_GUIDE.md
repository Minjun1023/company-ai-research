# Development Guide

## 1) 실행 개요

Project는 다음 방식으로 운영합니다.

- Docker DB + 로컬 또는 Docker 앱 동시 실행 지원
- 기본 실행 우선순위:
  1) `docker compose up -d postgres`
  2) 백엔드/AI 서비스 실행

## 2) 폴더 구조(현재 기준)

- `backend/`: Spring Boot API 서버
  - `domain`: 회사/문서/질문/로그 도메인
  - `common`: 공통 설정/예외 처리
  - `infra`: AI Service 호출 클라이언트
- `ai-service/`: FastAPI 기반 AI 파이프라인
  - `api/` : `crawl`, `embeddings`, `answer`, `health`
  - `services/` : 크롤링, 임베딩, 검색/질의 응답
- `infra/`: PostgreSQL 초기화 SQL
- `docs/`: 아키텍처/흐름/작업 체크리스트

## 3) 실행 순서

```bash
cp .env.example .env
# .env 값 채우기

docker compose up -d postgres

docker compose up -d backend ai-service
```

로컬 실행(백엔드/AI 직접 실행)도 가능합니다.

```bash
cd backend
./gradlew bootRun

cd ../ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 4) 확인 명령

- `docker compose ps`
- `curl -s http://localhost:8080/actuator/health`
- `curl -s http://localhost:8000/health`

## 5) 주요 API

- Company
  - `POST /companies`
  - `GET /companies`
  - `GET /companies/search`
  - `GET /companies/candidates`
  - `GET /companies/find-url`
  - `GET /companies/{id}`
  - `POST /companies/{id}/crawl`
  - `POST /companies/{id}/documents/search`
  - `POST /companies/{id}/research`
  - `POST /companies/{id}/coverletter`
  - `POST /companies/{id}/interview`
  - `POST /companies/{id}/salary`
- Question
  - `POST /companies/{companyId}/questions`
  - `GET /companies/{companyId}/questions`
  - `POST /companies/{companyId}/questions/ask`
- Conversation
  - `GET /conversations`
  - `POST /conversations`
  - `PATCH /conversations/{id}`
  - `DELETE /conversations/{id}`
  - `POST /conversations/{id}/messages`
  - `GET /conversations/{id}/artifacts`
- Chat
  - `POST /chat/respond`
- Auth
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
## 6) 테스트

- 테스트 위치: `backend/src/test/java/...`
- 실행: `./gradlew test`

## 7) 예외 처리 원칙

- 컨트롤러는 로직만 처리
- 공통 예외 응답은 `@RestControllerAdvice`(`GlobalExceptionHandler`)로 일괄 처리

## 8) 환경변수 전략

현재는 단일 `.env`로 관리.

- `.env.example`을 복사해 `.env` 작성
- `OPENAI_API_KEY`/DB 계정은 레포 비노출(Secret/운영 비밀관리 권장)
