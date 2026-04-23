import axios from 'axios';
import type {
  Company,
  CompanySearchResult,
  ConversationArtifact,
  CreateCompanyRequest,
  AuthResponse,
  SessionType,
} from '../types';
import { useAuthStore } from '../store/authStore';

const getBaseUrl = () =>
  localStorage.getItem('crm-demo-api-base') || 'http://localhost:8080';

const api = axios.create({
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      const isAuthPath = window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register') ||
        window.location.pathname.startsWith('/forgot-password') ||
        window.location.pathname.startsWith('/auth/');
      if (!isAuthPath) {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Companies ──────────────────────────────────────────────────
export const getCompanies = (): Promise<Company[]> =>
  api.get<Company[]>('/companies').then((r) => r.data);

export const searchCompanies = (q: string): Promise<CompanySearchResult[]> =>
  api.get<CompanySearchResult[]>('/companies/search', { params: { q } }).then((r) => r.data);

export const getCompanyCandidates = (name: string): Promise<CompanySearchResult[]> =>
  api.get<CompanySearchResult[]>('/companies/candidates', { params: { name } }).then((r) => r.data);

export const findCompanyUrl = (name: string): Promise<string | null> =>
  api.get<{ url: string }>('/companies/find-url', { params: { name } }).then((r) => r.data.url || null);

export const createCompany = (body: CreateCompanyRequest): Promise<Company> =>
  api.post<Company>('/companies', body).then((r) => r.data);

export const getCompany = (id: number): Promise<Company> =>
  api.get<Company>(`/companies/${id}`).then((r) => r.data);

export interface CrawlResult {
  companyId: number;
  savedDocumentCount: number;
}

export const crawlCompany = (id: number): Promise<CrawlResult> =>
  api.post<CrawlResult>(`/companies/${id}/crawl`).then((r) => r.data);

export const updateCompany = (id: number, body: { website: string }): Promise<Company> =>
  api.patch<Company>(`/companies/${id}`, body).then((r) => r.data);

export const deleteCompany = (id: number): Promise<void> =>
  api.delete(`/companies/${id}`).then(() => undefined);

// ── Conversations ────────────────────────────────────────────────
export interface ServerConversation {
  id: number;
  title: string;
  sessionType: SessionType;
  selectedCompanyId: number | null;
  mode: string;
  modeState: string | null;
  createdAt: string;
  updatedAt: string;
  messages: { id: number; role: string; content: string; meta: string | null; createdAt: string }[];
}

export interface ChatRespondResponse {
  conversationId: number;
  title: string;
  sessionType?: SessionType;
  selectedCompanyId: number | null;
  mode: string;
  modeState: string | null;
  userMessage: { id: number; role: string; content: string; meta: string | null } | null;
  assistantMessage: { id: number; role: string; content: string; meta: string | null } | null;
  artifact?: ConversationArtifact | null;
}

export const getConversations = (): Promise<ServerConversation[]> =>
  api.get<ServerConversation[]>('/conversations').then((r) => r.data);

export const createConversationApi = (
  title: string,
  sessionType: SessionType = 'general',
): Promise<ServerConversation> =>
  api.post<ServerConversation>('/conversations', { title, sessionType }).then((r) => r.data);

export const updateConversationApi = (
  id: number,
  data: {
    title?: string;
    sessionType?: SessionType;
    selectedCompanyId?: number | null;
    mode?: string;
    modeState?: string | null;
  }
): Promise<ServerConversation> =>
  api.patch<ServerConversation>(`/conversations/${id}`, data).then((r) => r.data);

export const deleteConversationApi = (id: number): Promise<void> =>
  api.delete(`/conversations/${id}`).then(() => undefined);

export const addMessageApi = (
  conversationId: number,
  role: string,
  content: string,
  meta?: string
): Promise<{ id: number; role: string; content: string; meta: string | null; createdAt: string }> =>
  api.post(`/conversations/${conversationId}/messages`, { role, content, meta }).then((r) => r.data);

export const chatRespond = (
  conversationId: number,
  message: string,
  persistUserMessage = true,
): Promise<ChatRespondResponse> =>
  api.post<ChatRespondResponse>('/chat/respond', { conversationId, message, persistUserMessage }).then((r) => r.data);

export const getConversationArtifacts = (conversationId: number): Promise<ConversationArtifact[]> =>
  api.get<ConversationArtifact[]>(`/conversations/${conversationId}/artifacts`).then((r) => r.data);

// ── Auth ────────────────────────────────────────────────────────
export const checkEmailAvailable = (email: string): Promise<boolean> =>
  api.get('/auth/email/check', { params: { email } }).then((r) => r.data.available);
export const register = (
  email: string,
  name: string,
  password: string,
  verifiedToken: string,
  profile?: {
    careerLevel?: string;
    desiredJob?: string;
    techStack?: string;
    desiredIndustry?: string;
    resumeText?: string;
  }
): Promise<AuthResponse> =>
  api.post<AuthResponse>('/auth/register', { email, name, password, verifiedToken, ...profile }).then((r) => r.data);

export const sendVerificationCode = (email: string): Promise<void> =>
  api.post('/auth/email/send-code', { email }).then(() => undefined);

export const verifyEmailCode = (email: string, code: string): Promise<string> =>
  api.post<{ verifiedToken: string }>('/auth/email/verify', { email, code }).then((r) => r.data.verifiedToken);

export const resetPassword = (email: string, verifiedToken: string, newPassword: string): Promise<void> =>
  api.post('/auth/password/reset', { email, verifiedToken, newPassword }).then(() => undefined);

export const changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
  api.put('/auth/password/change', { currentPassword, newPassword }).then(() => undefined);

export const deleteAccount = (password?: string, provider?: string | null): Promise<void> =>
  api.delete('/auth/account', { data: { ...(password ? { password } : {}), ...(provider ? { provider } : {}) } }).then(() => undefined);

export const verifyCurrentPassword = (password: string): Promise<boolean> =>
  api.post<{ valid: boolean }>('/auth/password/verify', { password }).then((r) => r.data.valid);

export const checkPasswordSame = (email: string, verifiedToken: string, password: string): Promise<boolean> =>
  api.post<{ same: boolean }>('/auth/password/check-same', { email, verifiedToken, password }).then((r) => r.data.same);

export const login = (email: string, password: string, rememberMe = true): Promise<AuthResponse> =>
  api.post<AuthResponse>('/auth/login', { email, password, rememberMe }).then((r) => r.data);

export const logout = (): Promise<void> =>
  api.post('/auth/logout').then(() => undefined);

export const getCurrentUser = (): Promise<AuthResponse> =>
  api.get<AuthResponse>('/auth/me').then((r) => r.data);

export const uploadResume = (file: File): Promise<{ resumeText: string }> => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{ resumeText: string }>('/auth/profile/resume-upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const updateProfile = (data: {
  name: string;
  careerLevel?: string | null;
  desiredJob?: string | null;
  techStack?: string | null;
  desiredIndustry?: string | null;
  resumeText?: string | null;
}): Promise<AuthResponse> =>
  api.put<AuthResponse>('/auth/profile', data).then((r) => r.data);

export const socialLogin = (
  provider: 'google' | 'kakao' | 'naver',
  body: Record<string, string | boolean>,
): Promise<AuthResponse> =>
  api.post<AuthResponse>(`/auth/social/${provider}`, body).then((r) => r.data);
