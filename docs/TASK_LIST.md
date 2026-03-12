
# TASK_LIST.md
# Company Research AI — Development Task List

이 문서는 실제 개발을 진행하면서 사용할 **TODO / 작업 관리 문서**입니다.
각 작업은 GitHub Issue 또는 개인 개발 체크리스트로 사용할 수 있습니다.

---

# 1. Project Setup

- [ ] GitHub Repository 생성
- [ ] 프로젝트 기본 폴더 구조 생성
- [ ] README.md 작성
- [ ] Docker Compose 환경 구성
- [ ] PostgreSQL 컨테이너 실행 확인
- [ ] Spring Boot 프로젝트 생성
- [ ] FastAPI 프로젝트 생성

---

# 2. Database Setup

- [ ] ERD 기반 테이블 생성
- [ ] users 테이블 생성
- [ ] companies 테이블 생성
- [ ] company_documents 테이블 생성
- [ ] reviews 테이블 생성
- [ ] questions 테이블 생성
- [ ] pgvector extension 설치
- [ ] embedding 컬럼 추가
- [ ] vector index 생성

---

# 3. Company API

- [ ] Company Entity 구현
- [ ] Company Repository 구현
- [ ] Company Service 구현
- [ ] Company Controller 구현
- [ ] 회사 등록 API
- [ ] 회사 목록 조회 API
- [ ] 회사 상세 조회 API

---

# 4. Review System

- [ ] Review Entity 구현
- [ ] Review Repository 구현
- [ ] Review Service 구현
- [ ] Review Controller 구현
- [ ] 리뷰 작성 API
- [ ] 리뷰 목록 조회 API
- [ ] 리뷰 상세 조회 API

---

# 5. Crawling

- [ ] 회사 URL 입력 처리
- [ ] HTML 다운로드
- [ ] 주요 링크 탐색
- [ ] About 페이지 수집
- [ ] Careers 페이지 수집
- [ ] Culture 페이지 수집
- [ ] 기술 블로그 수집

---

# 6. Document Processing

- [ ] HTML 본문 추출
- [ ] 불필요한 텍스트 제거
- [ ] 텍스트 정제 로직 구현
- [ ] 문서 chunking 구현
- [ ] company_documents 테이블 저장

---

# 7. Embedding Pipeline

- [ ] embedding API 연결
- [ ] 문서 embedding 생성
- [ ] document_embeddings 테이블 저장
- [ ] embedding 검색 테스트

---

# 8. RAG System

- [ ] 질문 저장 API 구현
- [ ] 질문 분류 로직 구현
- [ ] Vector Search 구현
- [ ] 문서 검색 top-k 구현
- [ ] RAG prompt 생성
- [ ] LLM 응답 생성

---

# 9. Review RAG

- [ ] 리뷰 embedding 생성
- [ ] review_embeddings 저장
- [ ] 리뷰 vector 검색 구현
- [ ] 리뷰 기반 질문 응답

---

# 10. Demo Page

- [ ] 회사 URL 입력 UI
- [ ] 질문 입력 UI
- [ ] 결과 출력 UI
- [ ] 리뷰 작성 UI
- [ ] API 연결

---

# 11. Logging

- [ ] 질문 로그 저장
- [ ] 검색 결과 로그 저장
- [ ] AI 응답 로그 저장

---

# 12. Testing

- [ ] 크롤링 테스트
- [ ] embedding 테스트
- [ ] vector search 테스트
- [ ] 질문 응답 테스트
- [ ] 리뷰 기능 테스트

---

# 13. Refactoring

- [ ] 패키지 구조 정리
- [ ] DTO 구조 정리
- [ ] 예외 처리 통합
- [ ] 로그 구조 개선

---

# 14. Documentation

- [ ] README 업데이트
- [ ] ARCHITECTURE.md 정리
- [ ] DEVELOPMENT_GUIDE.md 정리
- [ ] RAG_DESIGN.md 정리
- [ ] SYSTEM_FLOW.md 정리

---

# 15. MVP Completion Criteria

다음 기능이 정상 동작하면 MVP 완료

- 회사 등록
- 회사 크롤링
- 회사 문서 저장
- embedding 생성
- 질문 응답
- 리뷰 작성
- 리뷰 기반 질문 응답
