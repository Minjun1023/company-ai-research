
# SYSTEM_FLOW.md

# Company Research AI — System Flow

이 문서는 Company Research AI 프로젝트의 전체 시스템 흐름을 설명합니다.

목적
- 사용자 요청이 어떻게 처리되는지 이해
- 백엔드와 AI 서비스 역할 구분
- RAG 파이프라인 흐름 정리
- 포트폴리오 및 면접 설명 자료로 활용

---

# 1. Overview

Company Research AI는 다음 흐름으로 동작합니다.

1. 사용자가 회사 URL을 입력한다.
2. 시스템이 회사 사이트를 크롤링한다.
3. 회사 문서를 정제하고 저장한다.
4. 문서를 chunk로 나누고 embedding을 생성한다.
5. 사용자가 질문을 입력한다.
6. 질문 유형을 분류한다.
7. 관련 문서/리뷰를 검색한다.
8. LLM이 답변을 생성한다.
9. 사용자에게 결과를 반환한다.

---

# 2. High-Level Flow

사용자
↓
회사 URL 입력 / 질문 입력
↓
Spring Boot Backend
↓
FastAPI AI Service
↓
크롤링 / 문서 정제 / 임베딩 / 검색
↓
PostgreSQL + pgvector
↓
LLM
↓
답변 반환

---

# 3. Company Analysis Flow

Step 1. 회사 등록

사용자가 회사 URL 또는 회사명을 입력

예:
https://www.naver.com

Backend 처리:
- 회사 정보 저장
- company_id 생성

---

Step 2. 크롤링 요청

Spring Boot Backend가 AI Service에 크롤링 요청

POST /internal/crawl

AI Service 처리:
- HTML 수집
- 주요 링크 탐색
- about / careers / culture / news 페이지 탐색

---

Step 3. 본문 추출 및 정제

수집된 HTML에서 본문 텍스트만 추출

제거 대상:
- nav
- footer
- header
- 광고
- 로그인 버튼
- 쿠키 배너

결과:
회사 소개 / 기술 스택 / 문화 설명 / 채용 정보

---

Step 4. 문서 저장

정제된 문서를 company_documents 테이블에 저장

저장 정보:
- company_id
- source_url
- page_type
- cleaned_text

---

Step 5. Chunking

문서를 작은 단위로 분할

문서
↓
chunk 1
chunk 2
chunk 3

목적:
- 검색 정확도 향상
- embedding 생성 최적화

---

Step 6. Embedding 생성

각 chunk를 embedding vector로 변환

예:
"Java 기반 백엔드 개발 환경"
→ [0.123, 0.982, 0.441 ...]

---

Step 7. Vector DB 저장

embedding을 document_embeddings 테이블에 저장

목적:
질문 시 관련 문서를 빠르게 검색하기 위함

---

# 4. Question Answer Flow

Step 1. 질문 입력

예:
이 회사 백엔드 기술 스택 뭐야?
이 회사 문화 어때?
야근 많아?

---

Step 2. 질문 저장

Spring Boot Backend가 질문을 questions 테이블에 저장

저장 정보:
- user_id
- company_id
- question_text

---

Step 3. 질문 분류

AI Service가 질문 유형을 분류

유형:
company
review
job
mixed

예:
"이 회사 어떤 회사야?" → company
"야근 많아?" → review

---

Step 4. 검색 대상 선택

질문 유형에 따라 검색 대상이 달라짐

company 질문:
company_documents

review 질문:
reviews

mixed 질문:
company_documents + reviews

---

Step 5. Vector Search

질문을 embedding으로 변환 후 유사 문서 검색

예:
culture page
review chunks
job posting text

---

Step 6. Context 구성

LLM에 전달할 context 생성

구성:
- 사용자 질문
- 검색된 문서
- 리뷰 요약
- 출처 정보

---

Step 7. LLM 답변 생성

LLM이 context 기반 답변 생성

예:
이 회사는 자율성과 협업을 강조하는 문화를 가지고 있습니다.
일부 리뷰에서는 업무 강도가 높다는 언급도 있습니다.

---

Step 8. 결과 반환 및 로그 저장

Backend가 답변 반환

question_logs 저장:
- question_id
- retrieved_source_type
- retrieved_source_id
- score

---

# 5. Review Flow

Step 1. 리뷰 작성

입력:
- job_role
- career_level
- employment_status
- pros
- cons
- content

---

Step 2. 리뷰 저장

Spring Boot Backend → reviews 테이블 저장

---

Step 3. 리뷰 임베딩 생성

리뷰 텍스트 → chunk → embedding

저장:
review_embeddings

---

Step 4. 리뷰 기반 질문 응답

예:
이 회사 워라밸 어때?
Backend 개발자 분위기 어때?

AI Service가 review_embeddings 검색 후 답변 생성

---

# 6. Salary Analysis Flow

연봉 정보는 리뷰 기반 범위 분석 사용

Step 1. 리뷰 연봉 데이터 수집

예:
Backend / 3년차 / 5200

Step 2. 직무 기준 필터

job_role = backend

Step 3. 범위 계산

예:
Backend 개발자 연봉은 리뷰 기준 5000 ~ 6500만원 범위

---

# 7. Internal Service Communication

Spring Boot ↔ FastAPI 내부 API

POST /internal/crawl
POST /internal/classify-question
POST /internal/ask

---

# 8. End-to-End Flow

1. 회사 URL 입력
2. 회사 크롤링
3. 문서 저장
4. chunk + embedding 생성
5. vector DB 저장
6. 질문 입력
7. 질문 분류
8. vector 검색
9. LLM 답변 생성
10. 결과 반환
11. 로그 저장

---

# 9. Summary

Company Research AI 핵심 흐름

회사 URL 입력
→ 크롤링
→ 문서 정제
→ 임베딩 생성
→ Vector DB 저장
→ 질문 입력
→ 질문 분류
→ 문서 검색
→ LLM 답변 생성
→ 사용자 반환
