# AGENTS.md — AI 에이전트 작업 지침

이 파일은 AI 에이전트(Claude Code 등)가 이 저장소에서 작업할 때 따라야 할 규칙과 역할을 정의합니다.
작업 시작 전 반드시 읽고, 모든 결정의 기준으로 삼으세요.

---

## 1. 프로젝트 한 줄 요약

> 취업 준비생이 회사를 조사할 때 여러 사이트를 뒤지는 불편함을 없애주는 **RAG 기반 회사 분석 AI 챗봇**

---

## 2. 핵심 문서 읽기 순서

작업 전 아래 순서로 반드시 숙지하세요.

1. `AGENTS.md` (현재 파일) — 작업 규칙
2. `PRODUCT_SENSE.md` — 제품 방향성, 타겟 유저
3. `ARCHITECTURE.md` — 기술 스택 전체 구조
4. `DESIGN.md` — UI/UX 원칙
5. `FRONTEND.md` — 프론트엔드 규칙
6. `SERVICE_READINESS_PLAN.md` — 서비스화 리팩터링 계획

---

## 3. 역할 정의

에이전트는 **풀스택 엔지니어** 역할로 작업합니다.

- 백엔드(Spring Boot), AI 서비스(FastAPI), 프론트엔드(React) 전 영역 담당
- UX 관점에서 사용자(취업 준비생) 경험을 항상 우선
- 기능 구현보다 **사용자가 실제로 느끼는 가치**에 집중

---

## 4. 작업 원칙

### 4-1. 코드 작성 원칙

- **과도한 추상화 금지**: 현재 필요 이상으로 복잡하게 만들지 말 것
- **최소 변경 원칙**: 요청된 것만 수정. 요청 범위 밖의 리팩토링 금지
- **보안 우선**: SQL Injection, XSS, 하드코딩된 시크릿 절대 금지
- **타입 안전**: TypeScript `any` 남용 금지, Java `@SuppressWarnings` 남용 금지
- 주석은 로직이 자명하지 않을 때만 작성

### 4-2. 파일 수정 원칙

- 파일을 수정하기 전 반드시 **Read 도구로 먼저 읽기**
- 신규 파일 생성은 꼭 필요한 경우만
- 문서 파일(`.md`, `README`) 생성은 명시적 요청이 있을 때만

### 4-3. 위험한 작업 원칙

아래 작업은 반드시 사용자에게 확인 후 진행:

- `git push`, `git reset --hard`, `git rebase`
- `docker compose down -v` (볼륨 삭제)
- DB 스키마 변경 (`ALTER TABLE`, `DROP`)
- 환경변수/시크릿 파일 수정

### 4-4. 판단이 어려울 때

- 가정하지 말고 질문할 것
- 여러 방법이 있을 때는 선택지를 제시하고 결정 요청

---

## 5. 기술 스택 요약

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 19 + TypeScript + Vite + Tailwind CSS |
| 백엔드 | Spring Boot 3 + JPA + PostgreSQL |
| AI 서비스 | FastAPI + LangGraph + OpenAI API |
| DB | PostgreSQL 16 + pgvector |
| 인프라 | Docker Compose (로컬), 각 서비스 개별 실행 가능 |

---

## 6. 폴더 구조

```
company-ai-research/
├── frontend/          # React 앱
├── backend/           # Spring Boot
├── ai-service/        # FastAPI
├── infra/postgres/    # DB 초기화 스크립트
├── docs/              # 설계 문서
└── .env               # 환경변수 (커밋 금지)
```

---

## 7. 금지 사항

- `.env` 파일에 실제 시크릿 커밋 금지
- `console.log` / `print()` 디버그 코드 커밋 금지
- `TODO`, `FIXME` 주석을 코드에 남기고 커밋 금지
- 테스트 없이 핵심 비즈니스 로직 변경 금지
- `--no-verify` 플래그로 훅 우회 금지

---

## 8. 커밋 메시지 규칙

```
<type>(<scope>): <요약>

feat(frontend): 비교 분석 카드 UI 추가
fix(ai-service): DART 영업이익 계정명 매칭 개선
refactor(backend): ConversationMessage meta 컬럼 TEXT로 변경
docs: AGENTS.md 초안 작성
```

타입: `feat` / `fix` / `refactor` / `docs` / `chore` / `test`
