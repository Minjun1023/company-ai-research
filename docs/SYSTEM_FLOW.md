# Company Research AI — System Flow

## 1. 전체 처리 순서

1. 사용자가 회사를 생성하거나 검색
2. 필요 시 회사 웹사이트를 찾아 크롤링 실행
3. Backend가 AI Service에 크롤링/분석 요청
4. 수집 문서를 저장하고 임베딩을 생성
5. 질문/비교/리서치 요청 수신
6. 문서 검색 결과와 외부 소스(DART/뉴스)를 결합
7. AI Service가 응답을 생성
8. 응답과 대화 이력을 저장해 프론트에 반환

## 2. 핵심 컴포넌트 흐름

### Company Flow

- `POST /companies`로 회사 등록
- 또는 `POST /chat/respond`에서 회사 후보 선택/URL 입력을 거쳐 자동 등록
- `POST /companies/{id}/crawl` 호출
- Backend가 AI Service `/internal/crawl` 호출
- Backend가 임베딩 생성까지 연계
- 크롤링 결과가 `company_documents`, `document_embeddings`로 반영

### Question Flow

- `POST /companies/{companyId}/questions/ask`
- 질문 저장 후 임베딩 검색 (`document_embeddings`)
- AI Service `/internal/qa`에 컨텍스트 전달
- 응답 반환

### Compare / Research Flow

- `POST /chat/respond`
- `POST /companies/{companyId}/research`
- Backend가 회사별 문서 컨텍스트를 구성하고, 필요 시 선행 크롤링
- AI Service가 회사별 DART/뉴스/문서 컨텍스트를 통합
- 마크다운 응답과 출처 목록 반환

### Consult Flow

- `POST /chat/respond`
- 면접 준비, 모의 면접, 자기소개서 작성, 자기소개서 피드백, 연봉 협상 상담을 대화 상태(`mode`, `modeState`)로 이어감
- 완료된 결과는 `conversation_artifacts`에 저장 가능

## 3. API 흐름 예시

```text
User -> Backend -> AI Service -> PostgreSQL
          <-           <-            <-
```

- Health
  - `GET /actuator/health` (backend)
  - `GET /health` (ai-service)

## 4. 로깅/추적

- 대화 이력: `conversations`, `conversation_messages`
- 결과 아티팩트: `conversation_artifacts`
- 검색 로그: `search_logs`
- 응답 로그: `ai_response_logs`
- 회사별 크롤링 시각: `lastCrawledAt`

## 5. 실패 대응

- AI Service 호출 실패: Backend 예외로 변환 후 공통 예외 응답 반환
- DB 미연결/포맷 오류: 공통 에러 응답 형식 반환
- 크롤링 실패: 부분 수집 또는 실패 메시지 반환
