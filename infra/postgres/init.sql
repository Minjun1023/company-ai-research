CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(1024),
  dart_corp_code VARCHAR(8),
  company_type VARCHAR(100),
  description TEXT,
  logo_url TEXT,
  location VARCHAR(255),
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT '새 대화',
  session_type VARCHAR(40) NOT NULL DEFAULT 'general',
  selected_company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  mode VARCHAR(40) DEFAULT 'idle',
  mode_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_session_type_updated_at
  ON conversations(user_id, session_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  meta VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);

CREATE TABLE IF NOT EXISTS conversation_artifacts (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  source_message_id BIGINT NOT NULL UNIQUE REFERENCES conversation_messages(id) ON DELETE CASCADE,
  artifact_type VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  meta TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_artifacts_conversation_id_updated_at
  ON conversation_artifacts(conversation_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS company_documents (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_url VARCHAR(1024),
  source_type VARCHAR(50),
  source TEXT,
  content TEXT,
  page_title TEXT,
  language VARCHAR(20) DEFAULT 'ko',
  meta JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_company_id
  ON company_documents (company_id);


CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  user_question_type VARCHAR(40),
  question_text TEXT NOT NULL,
  answer_text TEXT,
  source_type VARCHAR(100),
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_company_id
  ON questions (company_id);

CREATE TABLE IF NOT EXISTS question_logs (
  id BIGSERIAL PRIMARY KEY,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  retrieved_source_type VARCHAR(100),
  retrieved_source_id BIGINT,
  score DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_logs_question_id
  ON question_logs (question_id);

CREATE TABLE IF NOT EXISTS search_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  question_id BIGINT REFERENCES questions(id) ON DELETE SET NULL,
  request_type VARCHAR(80) NOT NULL,
  query_text TEXT NOT NULL,
  source_type VARCHAR(100) NOT NULL,
  source_id BIGINT,
  score DOUBLE PRECISION,
  rank_order INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_company_id
  ON search_logs (company_id);

CREATE INDEX IF NOT EXISTS idx_search_logs_question_id
  ON search_logs (question_id);

CREATE INDEX IF NOT EXISTS idx_search_logs_request_type
  ON search_logs (request_type);

CREATE TABLE IF NOT EXISTS ai_response_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  question_id BIGINT REFERENCES questions(id) ON DELETE SET NULL,
  request_type VARCHAR(80) NOT NULL,
  request_text TEXT NOT NULL,
  prompt TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  provider VARCHAR(80),
  latency_ms BIGINT,
  source_type VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_response_logs_company_id
  ON ai_response_logs (company_id);

CREATE INDEX IF NOT EXISTS idx_ai_response_logs_question_id
  ON ai_response_logs (question_id);

CREATE INDEX IF NOT EXISTS idx_ai_response_logs_request_type
  ON ai_response_logs (request_type);

CREATE TABLE IF NOT EXISTS document_embeddings (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES company_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id
  ON document_embeddings (document_id);


CREATE INDEX IF NOT EXISTS idx_company_documents_embedding_ivfflat
  ON company_documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding_ivfflat
  ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_questions_embedding_ivfflat
  ON questions USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;
