export interface Company {
  id: number;
  name: string;
  website: string | null;
  description: string | null;
  companyType: string | null;
  lastCrawledAt: string | null;
}

export interface CreateCompanyRequest {
  name: string;
  website?: string;
  description?: string;
}

export interface AnswerContext {
  sourceUrl: string | null;
  content?: string;
  source_type?: string;
}

export interface CompanySearchResult {
  id: number | null;
  name: string;
  website: string | null;
  registered: boolean;
  description?: string | null;
}


export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta?: string;
  createdAt: string;
}

export interface ConversationArtifact {
  id: number;
  conversationId: number;
  sourceMessageId: number;
  artifactType: 'research' | 'compare' | 'interview' | 'coverletter' | 'feedback' | 'salary';
  title: string;
  content: string;
  meta?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SessionType =
  | 'general'
  | 'research'
  | 'compare'
  | 'interview'
  | 'coverletter'
  | 'salary';

export type SessionFilter = 'all' | SessionType;

export interface AuthResponse {
  token?: string;
  email: string;
  name: string;
  careerLevel: string | null;
  desiredJob: string | null;
  techStack: string | null;
  desiredIndustry: string | null;
  resumeText: string | null;
  isNewUser?: boolean;
  hasPassword?: boolean;
}
