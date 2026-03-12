# System Architecture

## Overview
Company Research AI는 회사 데이터를 수집하고 직원 리뷰를 분석하여 AI 기반 회사 정보를 제공하는 서비스입니다.

## Architecture Diagram

Frontend (Demo Page)
        |
        v
Spring Boot Backend
        |
        v
FastAPI AI Service
        |
        v
PostgreSQL + pgvector
        |
        v
LLM

## Component Roles

### Spring Boot Backend
- 회사 관리
- 리뷰 관리
- 질문 관리
- API 제공
- AI 서비스 호출

### FastAPI AI Service
- 웹 크롤링
- 문서 정제
- 임베딩 생성
- Vector 검색
- RAG 응답 생성

### Database
- 회사 정보
- 회사 문서
- 리뷰 데이터
- 질문 로그

### LLM
- 질문 분석
- 답변 생성
- 리뷰 요약