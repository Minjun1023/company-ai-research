# 엔지니어링 로그

성능 개선, 장애 대응, 트러블슈팅, 구조 개선 기록을 남기는 문서다.
나중에 포트폴리오나 면접 답변으로 옮기기 쉽도록 "문제 -> 분석 -> 해결 -> 결과" 흐름으로 정리한다.

---

## 작성 원칙

- 한 항목은 가능한 한 하나의 문제만 다룬다.
- 증상만 적지 말고 원인과 검증 과정을 같이 적는다.
- 성능 이슈는 반드시 측정 수치를 남긴다.
- 성능 수치는 최소한 `Before`, `After`, `측정 조건`을 같이 적는다.
- 가능하면 평균만 쓰지 말고 `p95`, 요청 수, 쿼리 수, 번들 크기, 렌더링 시간 같은 보조 지표도 같이 적는다.
- 해결 방법뿐 아니라 왜 그 방법을 선택했는지도 적는다.
- 포트폴리오에 옮길 때 바로 쓸 수 있도록 사용자 영향도를 적는다.

---

## 추천 태그

- `[성능]`
- `[버그]`
- `[장애]`
- `[안정성]`
- `[리팩터링]`
- `[DX]`
- `[배포]`

---

## 기록 템플릿

아래 템플릿을 복사해서 계속 추가하면 된다.

```md
## YYYY-MM-DD

### [태그] 제목

**배경**
- 어떤 기능/화면/서비스에서 발생했는지
- 왜 이 이슈를 다루게 되었는지

**문제**
- 사용자 관점에서 어떤 문제가 있었는지
- 에러 메시지, 느린 구간, 잘못된 동작 등

**영향**
- 누구에게 어떤 불편/리스크가 있었는지
- 성능 이슈라면 응답 시간, 렌더링 시간, 호출 수 등

**측정 조건**
- 어디서 측정했는지
- 어떤 방식으로 측정했는지
- 몇 회 측정했는지
- 예: 로컬 MacBook M1 / Chrome DevTools / 10회 평균

**원인 분석**
- 실제 원인이 무엇이었는지
- 처음 가설과 최종 원인이 다르면 둘 다 적기

**해결**
- 어떤 방식으로 수정했는지
- 다른 대안 대신 이 방식을 선택한 이유

**결과**
- 수정 후 어떻게 달라졌는지
- 가능하면 before / after 수치 기록

**핵심 지표**
- 응답 시간: 2.4s -> 1.1s (54% 감소)
- SQL 쿼리 수: 41회 -> 3회
- 초기 JS 번들: 575kB -> 412kB
- LCP: 3.8s -> 2.1s
- 메모리 사용량: 420MB -> 280MB
- 재시도율/에러율: 7.2% -> 0.8%

**파일**
- `path/to/file`

**배운 점**
- 다음에는 어떻게 더 빨리 찾을지
- 구조적으로 예방하려면 무엇이 필요한지

**포트폴리오용 한 줄 요약**
- 예: "세션 상태 분리로 기능 간 문맥 충돌을 줄이고 대화 구조를 워크스페이스 기반으로 확장 가능하게 개선"
```

---

## 기록

## 2026-04-20

### [리팩터링] 기능별 세션 분리를 위한 대화 모델 확장 시작

**배경**
- 하나의 채팅 세션 안에서 기업 분석, 면접 준비, 자소서, 연봉 협상 기능이 모두 섞여 있었다.
- 이후 워크스페이스 기반 UI로 확장하기 위해 세션 목적을 구분할 기준이 필요했다.

**문제**
- 기존 `mode` 필드가 사용자 작업 종류와 내부 진행 상태를 동시에 표현하고 있었다.
- 이 구조에서는 기능별 세션 목록, 워크스페이스 필터링, 전용 시작 화면 구성이 어려웠다.

**영향**
- 기능이 늘수록 대화 맥락 전환이 복잡해지고, UI와 백엔드 라우팅 규칙이 함께 꼬일 위험이 있었다.

**측정 조건**
- 이번 항목은 구조 개선 작업이라 성능 측정 대상은 아니었다.
- 이후 성능 개선 기록부터는 `측정 도구`, `측정 횟수`, `Before/After` 수치를 같이 남긴다.

**원인 분석**
- `Conversation.mode` 하나에 `research`, `interview_prep`, `company_selection` 같은 서로 다른 수준의 상태가 혼재해 있었다.
- 사용자에게 보여줄 세션 목적과 내부 상태 머신이 분리되지 않은 것이 핵심 원인이었다.

**해결**
- `conversations.session_type` 컬럼을 추가하고, `general / research / compare / interview / coverletter / salary` 값을 저장하도록 구조를 확장했다.
- `mode`는 유지하되 내부 단계 상태로만 쓰도록 방향을 정했다.
- 백엔드 conversation DTO와 프론트 store/API 타입에 `sessionType`을 통과시켰다.

**결과**
- 기존 채팅 플로우를 깨지 않고 세션 목적 정보를 저장할 수 있게 됐다.
- 이후 사이드바 워크스페이스 필터, 기능별 세션 생성, 세션 타입 우선 라우팅 작업의 기반이 마련됐다.

**핵심 지표**
- 구조 개선 작업으로 정량 성능 수치는 아직 없음

**파일**
- `infra/postgres/init.sql`
- `backend/src/main/java/com/companyresearch/domain/chat/entity/Conversation.java`
- `backend/src/main/java/com/companyresearch/domain/chat/entity/ConversationSessionType.java`
- `backend/src/main/java/com/companyresearch/domain/chat/controller/ConversationController.java`
- `backend/src/main/java/com/companyresearch/domain/chat/controller/ChatController.java`
- `backend/src/main/java/com/companyresearch/domain/chat/service/ConversationService.java`
- `frontend/src/api/index.ts`
- `frontend/src/store/chatStore.ts`
- `frontend/src/types/index.ts`

**배운 점**
- 상태 필드 하나로 버티는 구조는 초기엔 빠르지만, 기능이 늘어날수록 의미 충돌이 생긴다.
- 사용자에게 보이는 분류와 시스템 내부 상태를 분리하면 제품 구조와 코드 구조가 동시에 단순해진다.

**포트폴리오용 한 줄 요약**
- "단일 챗봇 구조를 기능별 워크스페이스로 확장하기 위해 대화 모델에 세션 타입 계층을 추가하고, 프론트-백엔드 전체 데이터 흐름을 호환성 있게 확장했다."

## 2026-04-20

### [성능] 세션 타입 기반 대화 목록 조회를 위한 복합 인덱스 추가

**배경**
- 워크스페이스 구조를 도입하면서 대화 목록을 `user_id + session_type + updated_at DESC` 기준으로 조회하는 패턴이 생겼다.
- 사이드바에서 `전체 / 분석 / 비교 / 면접 / 자소서 / 연봉` 탭을 빠르게 전환하려면 세션 타입별 최신 대화 정렬 비용을 줄일 필요가 있었다.

**문제**
- `conversations` 테이블에는 기존에 `user_id` 단일 인덱스만 있었고, 세션 타입 필터와 최신순 정렬이 결합된 조회 패턴에는 최적화가 부족했다.
- 데이터가 늘어나면 특정 유저의 대화 목록을 읽은 뒤 `session_type`으로 다시 거르고 `updated_at DESC`로 정렬하는 비용이 커질 수 있었다.

**영향**
- 사이드바 워크스페이스 필터 전환 시 최신 대화 목록 응답이 느려질 가능성이 있었다.
- 대화가 누적될수록 세션별 목록 조회 성능이 점진적으로 저하될 리스크가 있었다.

**측정 조건**
- 이번 변경 시점에는 로컬 데이터셋이 작아 유의미한 `Before / After` 수치를 확보하지 못했다.
- 이후 대화 데이터가 충분히 쌓이면 `EXPLAIN ANALYZE`, p95 응답 시간, 조회 행 수 기준으로 다시 측정할 예정이다.
- 측정 예정 쿼리:
  `SELECT * FROM conversations WHERE user_id = ? AND session_type = ? ORDER BY updated_at DESC`

**원인 분석**
- 단일 컬럼 인덱스만으로는 `WHERE user_id AND session_type` + `ORDER BY updated_at DESC` 조합을 효율적으로 처리하기 어렵다.
- 워크스페이스 도입 이후 실제 UI 조회 패턴이 복합 조건으로 바뀐 것이 핵심 원인이었다.

**해결**
- `conversations(user_id, session_type, updated_at DESC)` 복합 인덱스를 추가했다.
- 새 조회 패턴에 맞춘 인덱스를 선제적으로 넣어, 세션 타입별 최신 목록 정렬을 인덱스 레벨에서 처리할 수 있도록 했다.

**결과**
- 워크스페이스 기반 사이드바 필터 구조에 맞는 조회 최적화 기반을 마련했다.
- 현재는 선제적 구조 개선 단계이며, 데이터 증가 이후에도 목록 조회가 안정적으로 유지되도록 준비했다.

**핵심 지표**
- 추가 인덱스 수: 1개
- 최적화 대상 컬럼 수: 3개 (`user_id`, `session_type`, `updated_at`)
- 정량 성능 수치: 측정 전

**파일**
- `infra/postgres/init.sql`

**배운 점**
- 인덱스는 “느려진 뒤”가 아니라, 실제 조회 패턴이 바뀌는 시점에 함께 설계해야 효과가 크다.
- 워크스페이스/필터 UI를 추가할 때는 API 코드뿐 아니라 데이터 접근 패턴도 같이 바뀐다는 점을 놓치면 안 된다.

**포트폴리오용 한 줄 요약**
- "워크스페이스 기반 대화 목록 조회 패턴에 맞춰 `user_id + session_type + updated_at` 복합 인덱스를 설계해 세션별 최신 목록 조회 성능 저하를 선제적으로 방지했다."

---

## 측정 메모

### 인덱스 측정용 더미 데이터 SQL

`conversations` 테이블에 테스트용 데이터를 많이 넣고 인덱스 전후 차이를 비교할 때 사용한다.
기존 운영 데이터와 섞고 싶지 않다면 테스트 DB에서만 실행하는 것이 좋다.

```sql
INSERT INTO conversations (
  user_id,
  title,
  session_type,
  mode,
  created_at,
  updated_at
)
SELECT
  1,
  '테스트 대화 ' || gs,
  (ARRAY['general', 'research', 'compare', 'interview', 'coverletter', 'salary'])[1 + (random() * 5)::int],
  'idle',
  NOW() - ((random() * 30)::int || ' days')::interval,
  NOW() - ((random() * 30)::int || ' days')::interval
FROM generate_series(1, 20000) AS gs;
```

특정 세션 타입만 더 많이 넣고 싶으면 이렇게 별도 추가한다.

```sql
INSERT INTO conversations (
  user_id,
  title,
  session_type,
  mode,
  created_at,
  updated_at
)
SELECT
  1,
  '리서치 대화 ' || gs,
  'research',
  'idle',
  NOW() - ((random() * 30)::int || ' days')::interval,
  NOW() - ((random() * 30)::int || ' days')::interval
FROM generate_series(1, 10000) AS gs;
```

### 인덱스 측정 명령

인덱스가 있는 상태에서 실행:

```bash
docker compose exec postgres psql -U postgres -d company_research -c "
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, session_type, updated_at
FROM conversations
WHERE user_id = 1
  AND session_type = 'research'
ORDER BY updated_at DESC
LIMIT 20;
"
```

비교를 위해 인덱스를 잠깐 내린 뒤 동일 쿼리를 다시 실행:

```bash
docker compose exec postgres psql -U postgres -d company_research -c "
DROP INDEX IF EXISTS idx_conversations_user_session_type_updated_at;
"
```

측정 후 인덱스 복구:

```bash
docker compose exec postgres psql -U postgres -d company_research -c "
CREATE INDEX IF NOT EXISTS idx_conversations_user_session_type_updated_at
ON conversations(user_id, session_type, updated_at DESC);
"
```

### 로그 문장 예시

실제 수치를 채워 넣을 때는 아래 형식을 그대로 쓰면 된다.

```md
**측정 조건**
- 로컬 Docker Postgres 16
- `conversations` 데이터 30,000건
- 측정 방식: `EXPLAIN (ANALYZE, BUFFERS)` 3회 확인
- 대상 쿼리:
  `SELECT id, title, session_type, updated_at FROM conversations WHERE user_id = 1 AND session_type = 'research' ORDER BY updated_at DESC LIMIT 20`

**결과**
- Before: Seq Scan + Sort, Execution Time 12.84ms
- After: Index Scan, Execution Time 1.91ms

**핵심 지표**
- Execution Time: 12.84ms -> 1.91ms (85.1% 감소)
- Scan 방식: Seq Scan -> Index Scan
- Buffers: shared hit 248 -> 31
```

### 포트폴리오용 문장 예시

짧게 쓰는 버전:

```md
- 세션 타입 기반 대화 목록 조회 쿼리에 복합 인덱스를 적용해 Execution Time을 12.84ms에서 1.91ms로 줄였다.
```

조금 더 설명하는 버전:

```md
- 워크스페이스 탭 도입 이후 `user_id + session_type + updated_at DESC` 조회 패턴이 새로 생겨, `conversations` 테이블에 복합 인덱스를 설계했다.
- 그 결과 세션별 최신 대화 목록 조회가 `Seq Scan + Sort`에서 `Index Scan`으로 바뀌었고, 로컬 기준 Execution Time을 12.84ms에서 1.91ms로 개선했다.
```

면접 답변형 버전:

```md
- 단순히 인덱스를 추가한 것이 아니라, UI에서 실제로 어떤 조회가 발생하는지 먼저 확인한 뒤 그 패턴에 맞춰 컬럼 순서를 설계했다.
- 특히 `WHERE user_id AND session_type`와 `ORDER BY updated_at DESC`가 함께 쓰인다는 점을 기준으로 복합 인덱스를 구성해, 워크스페이스 전환 시 목록 조회 비용이 커지는 문제를 선제적으로 막았다.
```

---

## 2026-04-20

### [백엔드/RAG] 문서 검색은 되는데 질문 응답만 빈 컨텍스트가 되던 문제 수정

**배경**
- 회사 문서 검색 API는 정상적으로 문화/복지 문서를 반환하고 있었지만,
- `POST /companies/{companyId}/questions/ask`는 같은 질문에 대해 `contexts=[]`로 응답하는 문제가 있었다.

**문제**
- 사용자는 질문 API에서 `200 OK`를 받아도 실제 답변은 `"먼저 회사 정보 수집(크롤링)을 진행해주세요."`로 떨어졌다.
- 검색 API와 질문 API의 동작 결과가 달라서, RAG 파이프라인 안에서 문맥 필터링이 과도하게 적용되고 있다는 신호였다.

**원인**
- `QuestionService`에서 복지/조직문화 질문을 별도 처리하는 과정에서
- `culture/about/careers` 문서가 실제로는 유효한 근거인데도, 복지 전용 키워드에 직접 매칭되지 않으면 필터링 단계에서 제거되고 있었다.

**해결**
- 복지 관련 키워드에 `culture`, `people`, `문화`, `조직문화`를 추가했다.
- 복지 키워드가 직접 잡히지 않아도 `culture/about/careers` 문서는 fallback 문맥으로 허용하도록 수정했다.
- `sourceType`이 `culture/about/careers`인 경우도 복지성 문맥으로 인정하게 보완했다.

**검증**
- 수정 전:
  - `POST /companies/138/questions/ask` → `200`
  - 응답: `contexts=[]`
  - 답변: `"먼저 회사 정보 수집(크롤링)을 진행해주세요."`
- 수정 후:
  - 로컬 백엔드 재기동 후 동일 요청 재호출
  - `prompt`에 `sourceType=culture` 문맥 포함 확인
  - 답변도 카카오 조직문화 항목을 실제 문서 기반으로 생성

**핵심 포인트**
- 같은 데이터가 있어도 검색 API와 RAG 질문 API의 후처리 로직이 다르면 실제 사용자 경험은 완전히 깨질 수 있다.
- 이번 수정은 검색 품질보다 `문맥 필터 설계`가 더 중요한 병목이 될 수 있다는 점을 확인한 사례였다.

**포트폴리오용 문장 예시**

짧게 쓰는 버전:

```md
- 문서 검색 API는 정상인데 RAG 질문 API만 빈 컨텍스트를 반환하던 문제를 추적해, 복지 질문 전용 문맥 필터를 수정하고 조직문화 문서를 fallback 컨텍스트로 허용했다.
```

설명형 버전:

```md
- 회사 문서 검색 결과는 존재했지만 `questions/ask` 경로에서만 `contexts=[]`가 되는 문제를 디버깅했다.
- 원인을 `QuestionService`의 과도한 복지 질문 필터링 로직으로 좁힌 뒤, `culture/about/careers` 문서를 유효한 fallback 문맥으로 허용해 실제 근거 기반 답변이 생성되도록 수정했다.
```

---

## 2026-04-20

### [백엔드/API] 인증 실패 응답을 `400`에서 `401`로 정리

**배경**
- 잘못된 로그인과 비로그인 사용자 조회가 모두 `400 BAD_REQUEST`로 내려오고 있었다.
- 기능 자체는 동작했지만, 클라이언트 입장에서는 입력 오류와 인증 오류를 구분하기 어려운 상태였다.

**문제**
- `POST /auth/login` 잘못된 비밀번호 → `400`
- `POST /auth/logout` 후 `GET /auth/me` → `400 "사용자를 찾을 수 없습니다."`

**원인**
- 로그인 실패와 비인증 상태를 `IllegalArgumentException`으로 던지고 있었고,
- 전역 예외 핸들러가 이를 일괄적으로 `400`으로 매핑하고 있었다.

**해결**
- `UnauthorizedException`을 추가해 인증 실패를 별도 예외로 분리했다.
- 전역 예외 핸들러에서 `UnauthorizedException`을 `401 UNAUTHORIZED`로 매핑했다.
- `UserService.login()`과 `UserService.getCurrentUser()`를 해당 예외를 사용하도록 수정했다.

**검증**
- 수정 전:
  - 잘못된 로그인 → `400`
  - 로그아웃 후 `/auth/me` → `400`
- 수정 후:
  - 잘못된 로그인 → `401`
  - 로그아웃 후 `/auth/me` → `401`

**핵심 포인트**
- API가 “동작한다”와 “HTTP 의미론이 정확하다”는 별개의 품질 기준이다.
- 특히 인증 실패를 `401`로 정리해 두면 프론트에서 재로그인 유도, 세션 만료 처리, 에러 메시지 분기가 훨씬 명확해진다.

**포트폴리오용 문장 예시**

짧게 쓰는 버전:

```md
- 로그인 실패와 비로그인 사용자 조회가 `400`으로 내려오던 문제를 정리하고, 인증 실패 전용 예외를 도입해 `401 UNAUTHORIZED`로 일관되게 응답하도록 개선했다.
```

설명형 버전:

```md
- 백엔드 기능은 정상 동작했지만 인증 실패가 `400 BAD_REQUEST`로 응답돼 HTTP 의미론이 어긋나는 문제를 발견했다.
- `UnauthorizedException`을 도입하고 전역 예외 매핑을 정리해, 잘못된 로그인과 로그아웃 후 사용자 조회가 모두 `401 UNAUTHORIZED`로 응답되도록 수정했다.
```
