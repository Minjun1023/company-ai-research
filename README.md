# Company Research AI

Company Research AI는 회사 웹사이트와 직원 리뷰 데이터를 기반으로 회사 정보를 분석하고 질문에 답변하는 AI 서비스입니다.

## 주요 기능
- 회사 URL 입력 후 회사 정보 자동 분석
- AI 기반 회사 Q&A
- 직원 리뷰 작성 및 조회
- 리뷰 기반 회사 분석
- RAG 기반 검색 및 답변 생성

## 기술 스택
Backend
- Spring Boot
- JPA
- REST API

AI Service
- FastAPI
- Python
- LangChain

Database
- PostgreSQL
- pgvector

Infrastructure
- Docker
- Docker Compose

## 시스템 구조

Frontend (Demo Page) -> Spring Boot Backend -> FastAPI AI Service -> PostgreSQL + pgvector -> LLM

## 실행 방식

이 프로젝트는 아래 순서로 실행합니다.

### 1) 환경변수 설정

`.env.example`을 `.env`로 복사한 뒤 값 입력

```bash
cp .env.example .env
```

`POSTGRES_PASSWORD`, `OPENAI_API_KEY` 등은 본인 값으로 수정하세요.

### 2) PostgreSQL 컨테이너 실행

```bash
docker compose up -d postgres
```

### 3) 백엔드 실행 (로컬)

```bash
cd backend
./gradlew bootRun --args='--server.port=8080'
# 또는 gradle bootRun --args='--server.port=8080'
```

### 4) AI Service 실행 (로컬)

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 5) 실행 확인

```bash
docker compose ps
curl -s http://localhost:5433
```

- DB 확인: `docker ps --filter name=company-research-postgres --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"`
- 백엔드 확인: `curl -s http://localhost:8080/` 
- AI 서비스 확인: `curl -s http://localhost:8000/`

### 6) 종료

```bash
# 각 터미널의 실행 중인 프로세스를 Ctrl+C
# 또는 Docker DB 종료
docker compose stop postgres
```

## 비고

- CI/CD는 GitHub Actions를 사용하여 main 브랜치에서 검증 및 이미지 빌드/푸시가 가능합니다.

## 실서비스 키/비밀 값 관리 방식(권장)

- `.env`에는 실제 키를 넣지 않습니다. 로컬에서만 필요하면 `.env`에 직접 넣고 사용하세요.
- GitHub Actions에서는 `Settings > Secrets and variables > Actions`에 Secret을 등록해 사용합니다.

권장 시크릿:
- `OPENAI_API_KEY`
- `POSTGRES_PASSWORD` (운영 DB를 쓸 때)

Actions에서 시크릿 사용 예시:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Export secrets
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
        run: |
          echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> "$GITHUB_ENV"
```

실행 환경(클라우드/서버)에서는 `docker-compose` 실행 시점에 환경변수로 주입하거나, 서버의 Secret Manager를 사용하세요.
