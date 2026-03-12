# RAG Design

## RAG Overview
RAG (Retrieval-Augmented Generation)는 검색 기반 AI 응답 생성 방식입니다.

Company Research AI는 회사 문서와 직원 리뷰 데이터를 기반으로 AI 질문 응답을 제공합니다.

## RAG Flow

User Question
↓
Question Classification
↓
Vector Search
↓
Relevant Documents
↓
LLM Prompt
↓
AI Answer

## Data Sources

- 회사 홈페이지
- 채용 공고
- 기술 블로그
- 뉴스
- 직원 리뷰

## Vector Database

PostgreSQL + pgvector 사용

저장 데이터
- document embeddings
- review embeddings

## Search Strategy

질문 유형에 따라 검색 대상 변경

Company Question → company_documents
Review Question → review_embeddings
Mixed Question → documents + reviews

## Prompt Design

Prompt 구성
- Question
- Retrieved Documents
- Context
- Answer format

## Goal

정확한 문서 검색과 신뢰 가능한 AI 답변 제공