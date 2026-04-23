# RAG Design

이 문서는 현재 구현 기준의 RAG 동작을 정리합니다.

## 1. 개요

회사 문서 검색 결과와 외부 소스(DART, 뉴스)를 함께 사용해 QA, 비교, 리서치 응답을 생성하는 구조입니다.
채팅 기반 상담 기능도 회사 문서 컨텍스트를 공통으로 재사용합니다.

## 2. 파이프라인

### A. 문서 수집 및 임베딩

1. **크롤링 입력**
   - Backend: `POST /companies/{id}/crawl`
   - AI Service: `/internal/crawl`
2. **정제/청크화**
   - HTML 본문 정제
   - 텍스트 chunk 생성(서비스 내부 처리)
3. **임베딩 생성**
   - AI Service: `/internal/embeddings`
4. **저장**
   - `document_embeddings`

### B. QA 응답

1. `POST /companies/{id}/questions/ask`
2. Backend가 `document_embeddings` 유사도 검색
3. AI Service `/internal/qa`에 질문, 문서 컨텍스트, 회사 정보 전달
4. AI Service가 DART/뉴스를 병합해 답변 생성

### C. 비교 / 리서치 응답

1. `POST /chat/respond` 또는 `POST /companies/{id}/research`
2. Backend가 회사별 문서 컨텍스트를 준비
3. AI Service `/internal/compare`, `/internal/research` 호출
4. 응답 본문과 출처 목록 반환

### D. 상담형 응답

1. `POST /chat/respond`
2. Backend가 대화 상태와 사용자 프로필/이력서를 포함해 히스토리를 구성
3. 회사 문서 검색 결과를 면접 준비, 모의 면접, 자기소개서 작성, 자기소개서 피드백, 연봉 상담에 재사용
4. AI Service 전용 엔드포인트가 답변을 생성하고, Backend가 대화/아티팩트를 저장

## 3. 검색 데이터 소스

- `document_embeddings`
- DART 공시 데이터
- 네이버 뉴스 검색 결과

## 4. 검색-응답 연결

1. 사용자가 질문
2. Backend에서 컨텍스트를 위한 텍스트 임베딩 생성 요청
3. 상위 N개 임베딩 결과 조합
4. 질문 유형에 따라 QA / 비교 / 리서치 프롬프트 구성
5. AI Service 전용 엔드포인트 호출 (`/internal/qa`, `/internal/compare`, `/internal/research`)
6. 최종 응답 반환

## 5. 현재 제약/운영 규칙

- 임베딩 모델: 기본 `text-embedding-3-small`
- 답변 모델: 기본 `gpt-4o-mini`
- 질문 유효성은 DTO(`@Valid`)로 1차 검증
- 검색 실패 시 빈 결과를 허용하되 외부 소스로 보완
