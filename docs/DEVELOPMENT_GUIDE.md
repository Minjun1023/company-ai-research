# Development Guide

이 문서는 Company Research AI 프로젝트 개발 시 참고하는 개발 가이드입니다.

# Project Folder Structure

company-research-ai/
├── README.md
├── docker-compose.yml
├── .gitignore
├── .env.example
│
├── backend/                          # Spring Boot 메인 백엔드
│   ├── build.gradle
│   ├── settings.gradle
│   ├── Dockerfile
│   ├── gradlew
│   ├── gradlew.bat
│   └── src/
│       ├── main/
│       │   ├── java/com/companyresearch/
│       │   │   ├── CompanyResearchApplication.java
│       │   │   │
│       │   │   ├── common/
│       │   │   │   ├── config/
│       │   │   │   ├── exception/
│       │   │   │   ├── response/
│       │   │   │   └── util/
│       │   │   │
│       │   │   ├── domain/
│       │   │   │   ├── company/
│       │   │   │   │   ├── controller/
│       │   │   │   │   ├── service/
│       │   │   │   │   ├── repository/
│       │   │   │   │   ├── entity/
│       │   │   │   │   └── dto/
│       │   │   │   │
│       │   │   │   ├── review/
│       │   │   │   │   ├── controller/
│       │   │   │   │   ├── service/
│       │   │   │   │   ├── repository/
│       │   │   │   │   ├── entity/
│       │   │   │   │   └── dto/
│       │   │   │   │
│       │   │   │   ├── document/
│       │   │   │   │   ├── service/
│       │   │   │   │   ├── repository/
│       │   │   │   │   ├── entity/
│       │   │   │   │   └── dto/
│       │   │   │   │
│       │   │   │   ├── question/
│       │   │   │   │   ├── controller/
│       │   │   │   │   ├── service/
│       │   │   │   │   ├── repository/
│       │   │   │   │   ├── entity/
│       │   │   │   │   └── dto/
│       │   │   │   │
│       │   │   │   └── user/
│       │   │   │       ├── controller/
│       │   │   │       ├── service/
│       │   │   │       ├── repository/
│       │   │   │       ├── entity/
│       │   │   │       └── dto/
│       │   │   │
│       │   │   └── infra/
│       │   │       ├── client/      # FastAPI 호출
│       │   │       ├── persistence/
│       │   │       └── scheduler/
│       │   │
│       │   └── resources/
│       │       ├── application.yml
│       │       ├── application-local.yml
│       │       ├── application-prod.yml
│       │       └── db/migration/
│       │
│       └── test/
│
├── ai-service/                       # FastAPI AI/RAG 서비스
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       │
│       ├── api/
│       │   ├── health.py
│       │   ├── crawl.py
│       │   ├── embed.py
│       │   ├── ask.py
│       │   └── classify.py
│       │
│       ├── core/
│       │   ├── config.py
│       │   ├── logging.py
│       │   └── constants.py
│       │
│       ├── services/
│       │   ├── crawler/
│       │   │   ├── crawler_service.py
│       │   │   ├── html_fetcher.py
│       │   │   ├── link_discovery_service.py
│       │   │   └── page_classifier.py
│       │   │
│       │   ├── extractor/
│       │   │   ├── content_extractor.py
│       │   │   ├── cleaner.py
│       │   │   └── boilerplate_remover.py
│       │   │
│       │   ├── embedding/
│       │   │   ├── embedding_service.py
│       │   │   └── chunking_service.py
│       │   │
│       │   ├── retrieval/
│       │   │   ├── vector_search_service.py
│       │   │   ├── keyword_search_service.py
│       │   │   ├── hybrid_search_service.py
│       │   │   └── rerank_service.py
│       │   │
│       │   ├── qa/
│       │   │   ├── question_classifier.py
│       │   │   ├── answer_service.py
│       │   │   └── source_formatter.py
│       │   │
│       │   └── review/
│       │       ├── review_analysis_service.py
│       │       └── review_embedding_service.py
│       │
│       ├── repositories/
│       │   ├── document_repository.py
│       │   ├── review_repository.py
│       │   └── vector_repository.py
│       │
│       ├── models/
│       │   ├── requests/
│       │   └── responses/
│       │
│       ├── prompts/
│       │   ├── classify_question.txt
│       │   ├── company_answer.txt
│       │   ├── review_answer.txt
│       │   └── mixed_answer.txt
│       │
│       └── utils/
│           ├── text_utils.py
│           ├── token_utils.py
│           └── url_utils.py
│
├── demo/                             # 최소 데모 페이지
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── infra/                            # 인프라 설정
│   ├── docker/
│   ├── postgres/
│   │   ├── init.sql
│   │   └── extensions.sql
│   └── env/
│       ├── backend.env.example
│       ├── ai-service.env.example
│       └── postgres.env.example
│
├── scripts/                          # 실행/초기화 스크립트
│   ├── run-local.sh
│   ├── stop-local.sh
│   ├── reset-db.sh
│   └── seed-data.sh
│
└── docs/                             # 프로젝트 문서
    ├── ARCHITECTURE.md
    ├── DEVELOPMENT_GUIDE.md
    ├── RAG_DESIGN.md
    ├── SYSTEM_FLOW.md
    ├── CODING_GUIDE.md
    └── TASK_LIST.md

## 프로젝트 목표
회사 데이터를 분석하고 AI 기반 질의응답을 제공하는 시스템 구축

## 핵심 기능
- 회사 등록
- 회사 크롤링
- 회사 분석
- AI 질문 응답
- 리뷰 작성
- 리뷰 기반 분석

## 개발 순서

1. Company API 구현
2. Review API 구현
3. Crawling 기능 구현
4. Embedding 생성
5. Vector Search
6. RAG 질문 응답
7. Demo Page 구현

## Backend 구조

domain/
- company
- review
- document
- question
- user

각 도메인 구조

controller/
service/
repository/
entity/
dto/

## Git 전략

main
feature/*

예

feature/company-api
feature/review-api
feature/crawler
feature/rag