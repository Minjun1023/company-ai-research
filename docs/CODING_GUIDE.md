
# CODING_GUIDE.md

# Company Research AI — Coding Guide

이 문서는 Company Research AI 프로젝트 개발 시 코딩하면서 참고하는 개발 기준 문서입니다.

목적
- 개발 방향 통일
- 구현 기능 정리
- API 구조 확인
- RAG 파이프라인 확인
- TODO 관리

---

# 1. Project Goal

회사 URL을 입력하면

1. 회사 데이터를 수집하고
2. 회사 문서를 분석하고
3. 직원 리뷰를 저장하고
4. AI 질문에 답변하는 시스템을 구현한다.

---

# 2. Core Features

핵심 기능

- 회사 등록
- 회사 데이터 크롤링
- 회사 분석
- AI 질문 응답
- 리뷰 작성
- 리뷰 기반 분석

---

# 3. System Overview

서비스 흐름

회사 URL 입력
↓
회사 사이트 크롤링
↓
문서 정제
↓
문서 chunking
↓
embedding 생성
↓
vector DB 저장
↓
사용자 질문
↓
vector 검색
↓
LLM 답변 생성

---

# 4. Project Structure

company-research-ai/
├── backend/
├── ai-service/
├── demo/
├── infra/
├── docs/
└── docker-compose.yml

---

# 5. Backend Structure

Spring Boot는 Domain 중심 구조로 개발한다.

domain/
├── company
├── review
├── document
├── question
└── user

각 도메인 구조

controller/
service/
repository/
entity/
dto/

---

# 6. Database Tables

핵심 테이블

users
companies
company_documents
document_embeddings
reviews
review_embeddings
questions

---

# 7. API List

Company API

POST /companies
GET /companies
GET /companies/{id}

Company Analysis

POST /companies/{id}/crawl
POST /companies/{id}/analyze

Question API

POST /companies/{id}/questions

Review API

POST /companies/{id}/reviews
GET /companies/{id}/reviews

---

# 8. Crawling Process

회사 사이트 데이터 수집

회사 URL 입력
↓
HTML 수집
↓
본문 텍스트 추출
↓
텍스트 정제
↓
문서 저장

크롤링 대상

- 회사 소개 페이지
- 채용 페이지
- 문화 페이지
- 기술 블로그
- 뉴스

---

# 9. RAG Process

질문 처리 흐름

사용자 질문
↓
질문 분류
↓
Vector Search
↓
관련 문서 검색
↓
LLM 답변 생성

검색 데이터

회사 문서
+
직원 리뷰

---

# 10. Development Priority

개발 순서

Step 1
- Company API
- Review API

Step 2
- Crawling
- Document 저장

Step 3
- Embedding 생성
- Vector Search

Step 4
- AI 질문 응답

Step 5
- Demo Page

---

# 11. TODO

Backend
- [ ] Company Entity 구현
- [ ] Company API 구현
- [ ] Review Entity 구현
- [ ] Review API 구현

Crawling
- [ ] URL HTML 수집
- [ ] 본문 텍스트 추출
- [ ] 텍스트 정제

Embedding
- [ ] 문서 chunking
- [ ] embedding 생성
- [ ] vector 저장

RAG
- [ ] 질문 분류
- [ ] vector search
- [ ] LLM 답변 생성

---

# 12. Coding Rules

Backend
- Controller → Service → Repository 구조
- DTO 사용
- Entity 직접 노출 금지

AI Service
- services 폴더에 로직 구현
- api 폴더에 endpoint 구현

---

# 13. Git Strategy

브랜치 전략

main
feature/*

예

feature/company-api
feature/review-api
feature/crawler
feature/rag

---

# 14. Commit Convention

feat: 새로운 기능
fix: 버그 수정
refactor: 코드 리팩토링
docs: 문서 수정

예

feat: company api 구현
fix: crawler html parsing 오류 수정

---

# 15. MVP Goal

다음 기능이 동작하면 MVP 완료

회사 등록
회사 크롤링
회사 분석
AI 질문
리뷰 작성
리뷰 기반 답변
