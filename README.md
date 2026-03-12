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