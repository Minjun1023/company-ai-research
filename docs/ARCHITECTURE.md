# ARCHITECTURE.md — 기술 아키텍처

현재 구현 기준의 시스템 구조를 정의합니다.
설계 결정의 근거와 각 컴포넌트의 책임 범위를 명확히 합니다.

---

## 1. 전체 구조

```
┌─────────────────────────────────────────────────┐
│                  Browser                        │
│           React 19 + Vite + Tailwind            │
│              localhost:5173                     │
└──────────────────┬──────────────────────────────┘
                   │ HTTP (REST)
┌──────────────────▼──────────────────────────────┐
│              Spring Boot 3                      │
│         비즈니스 로직 + 인증 + 오케스트레이션       │
│              localhost:8080                     │
└──────┬──────────────────────┬───────────────────┘
       │ HTTP                 │ JDBC
┌──────▼───────────┐  ┌───────▼───────────────────┐
│   FastAPI        │  │   PostgreSQL 16            │
│   AI Service     │  │   + pgvector               │
│  localhost:8000  │  │   localhost:5433           │
└──────────────────┘  └───────────────────────────┘
```

---

## 2. 컴포넌트별 책임

### 2-1. Frontend (React)

**책임**: UI 렌더링, 사용자 인터랙션, 상태 관리

- 인텐트 분류 결과에 따라 QA / 비교 / 심층분석 / 크롤링 흐름 분기
- 마크다운 렌더링 (`react-markdown` + `remark-gfm`)
- 출처 칩 표시 (크롤링 문서 + 뉴스)
- 다크/라이트 테마 전환
- JWT 기반 인증 상태 관리 (`zustand`)

**하지 않는 것**: 비즈니스 로직, 직접적인 AI 호출

### 2-2. Backend (Spring Boot)

**책임**: 인증/인가, 비즈니스 규칙, AI 서비스 오케스트레이션, DB 영속성

- JWT 발급/검증 (`JwtFilter`)
- 회사/문서/질문 CRUD
- AI 서비스 호출 및 결과 조합 (`AiServiceClient`)
- 채팅 라우팅: QA / 비교 / 리서치 / 면접 / 자소서 / 연봉 / 뉴스 / 일반 대화
- 대화 내역 및 생성 결과 저장 (`conversations`, `conversation_messages`, `conversation_artifacts`)
- 검색/응답 로그 저장 (`search_logs`, `ai_response_logs`)

**하지 않는 것**: LLM 직접 호출, 크롤링, 임베딩 생성

### 2-3. AI Service (FastAPI)

**책임**: 크롤링, 임베딩, LLM 호출, RAG 파이프라인

- 웹 크롤링 + HTML 정제 + 청킹
- OpenAI 임베딩 생성 (`text-embedding-3-small`)
- LangGraph 기반 RAG 파이프라인 (DART + 뉴스 + 문서 병렬 수집)
- 인텐트 분류 (qa / compare / research / crawl)
- DART API 연동 (재무정보, 연봉, 기업정보)
- 네이버 뉴스 API 연동

**하지 않는 것**: 인증, DB 직접 접근, 비즈니스 규칙

### 2-4. PostgreSQL + pgvector

**책임**: 데이터 영속성, 벡터 유사도 검색

---

## 3. 주요 데이터 흐름

### 회사 정보 수집 흐름

```
사용자: "카카오 정보 수집해줘"
  → Frontend: POST /chat/respond
  → Backend: 회사 식별/생성 후 필요 시 후보 선택 또는 URL 입력 유도
  → Backend: 회사 생성 후 crawl 실행
  → AI Service: /internal/crawl (웹 크롤링)
  → AI Service: /internal/embeddings (임베딩 생성)
  → PostgreSQL: company_documents + document_embeddings 저장
```

### QA 흐름

```
사용자: "카카오 복지 어때?"
  → Frontend: POST /chat/respond
  → Backend: 회사 식별 후 QA 라우팅
  → AI Service: /internal/qa (LangGraph RAG 파이프라인)
      ├── Node1: DART + 네이버 뉴스 병렬 수집
      ├── Node2: DB 임베딩 컨텍스트와 통합
      └── Node3: GPT 답변 생성 (JSON 구조화 출력)
  → Frontend: 마크다운 렌더링 + 출처 칩 표시
```

### 비교/심층분석 흐름

```
사용자: "삼성전자 하이닉스 비교해줘"
  → Frontend: POST /chat/respond
  → Backend: 대화 의도 분류 + 회사별 문서 컨텍스트 구성
  → AI Service: /internal/compare
      ├── 각 회사 DART + 뉴스 병렬 수집 (ThreadPoolExecutor)
      └── GPT 비교 테이블 생성
  → Frontend: 비교 카드 UI (보라색 테두리 + 표 렌더링)
```

### 상담형 대화 흐름

```
사용자: "카카오 면접 준비해줘" / "자소서 피드백해줘"
  → Frontend: POST /chat/respond
  → Backend: 현재 대화 mode 기준으로 후속 질문/상태 관리
  → AI Service: interview / interview_practice / coverletter / feedback / salary 경로 호출
  → PostgreSQL: conversation_messages + conversation_artifacts 저장
```

---

## 4. 주요 테이블

| 테이블 | 역할 |
|--------|------|
| `companies` | 회사 기본 정보, DART corp_code |
| `company_documents` | 크롤링된 페이지 원문 |
| `document_embeddings` | 청크별 벡터 임베딩 (pgvector) |
| `conversations` | 대화 세션 |
| `conversation_messages` | 메시지 (role, content, meta TEXT) |
| `conversation_artifacts` | 비교/리서치/면접/자소서/연봉 결과 저장 |
| `questions` | QA 질문/답변 기록 |
| `search_logs` | 문서 검색 로그 |
| `ai_response_logs` | AI 응답 로그 |

---

## 5. 인증 구조

- JWT Bearer Token 방식
- 이메일/비밀번호 로컬 로그인
- Google / Kakao / Naver 소셜 로그인 지원
- 토큰 만료: 24시간
- 비밀번호 재설정: 이메일 인증 코드 방식 (5분 유효)

---

## 6. 외부 API 의존성

| API | 용도 | 없을 때 |
|-----|------|---------|
| OpenAI API | 임베딩, GPT 답변 생성 | 서비스 핵심 기능 불가 |
| DART OpenAPI | 기업 재무/연봉 공시 정보 | 해당 정보 "정보 없음" 표시 |
| Naver News API | 최신 뉴스 검색 | 뉴스 섹션 생략 |
| Gmail SMTP | 이메일 인증 | 이메일 인증 기능 불가 |

---

## 7. 로컬 개발 환경

```bash
# PostgreSQL만 Docker
docker compose up -d postgres

# AI Service (터미널 1)
cd ai-service && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Backend (터미널 2)
cd backend && ./gradlew bootRun

# Frontend (터미널 3)
cd frontend && npm run dev
```

환경변수는 프로젝트 루트 `.env` + `direnv`로 자동 로드.
각 서비스 디렉토리에 `.envrc` 설정됨.

---

## 8. 설계 결정 기록 (ADR)

| 결정 | 이유 |
|------|------|
| Spring Boot + FastAPI 분리 | Python AI 생태계(LangGraph, OpenAI SDK)와 Java 비즈니스 레이어 각각의 장점 활용 |
| LangGraph 사용 | 멀티소스(DART + 뉴스 + DB) 병렬 수집 → 통합 → 답변 생성의 명확한 노드 구조 |
| pgvector | 별도 벡터 DB 없이 PostgreSQL 내에서 벡터 검색, 운영 복잡도 최소화 |
| meta 컬럼 TEXT | 출처 JSON 저장 목적으로 VARCHAR(255) 한계 초과 → TEXT로 변경 |
| react-markdown | LLM이 반환하는 마크다운(표, 헤더) 렌더링을 위해 도입 |
