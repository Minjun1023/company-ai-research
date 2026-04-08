import { useRef, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import {
  getCompanies,
  createCompany,
  crawlCompany,
  deleteCompany,
  askQuestion,
  classifyIntent,
  compareCompanies,
  researchCompany,
  coverLetterFeedback,
  salaryNegotiation,
  coverletterConsult,
  interviewPrepConsult,
  interviewPractice,
  analyzeJobFit,
  getJobListings,
  jobRecommend,
  generalChat,
  getCompanyCandidates,
  findCompanyUrl,
  findHomepageFromWantedUrl,
} from '../api';

import type { Company, AskQuestionResponse, AnswerContext, CompareResponse, ResearchResponse, CoverLetterFeedbackResponse, SalaryNegotiationResponse, CoverletterConsultResponse, InterviewPrepConsultResponse, InterviewPracticeResponse, JobFitResponse } from '../types';

// ── helpers ──────────────────────────────────────────────────
const trim = (v: unknown) => String(v ?? '').trim();

const norm = (s: string) => s.replace(/\s+/g, '');

const findCompany = (text: string, list: Company[]): Company | null => {
  if (!list.length) return null;
  const lower = text.toLowerCase();
  const lowerNorm = norm(lower);
  const idMatch = text.match(/(?:id)\s*[:=]?\s*(\d+)/i);
  if (idMatch) {
    const found = list.find((c) => c.id === Number(idMatch[1]));
    if (found) return found;
  }
  const exact = list.find((c) => {
    const n = trim(c.name).toLowerCase();
    return n === lower || norm(n) === lowerNorm;
  });
  if (exact) return exact;
  return (
    list.find((c) => {
      const n = trim(c.name).toLowerCase();
      const nn = norm(n);
      return nn && (
        lower.includes(n) || lowerNorm.includes(nn) ||
        n.includes(lower) || nn.includes(lowerNorm)
      );
    }) || null
  );
};

const findCompanyExact = (text: string, list: Company[]): Company | null => {
  if (!list.length) return null;
  const lower = text.toLowerCase();
  const lowerNorm = norm(lower);
  const idMatch = text.match(/(?:id)\s*[:=]?\s*(\d+)/i);
  if (idMatch) {
    const found = list.find((c) => c.id === Number(idMatch[1]));
    if (found) return found;
  }
  return (
    list.find((c) => {
      const n = trim(c.name).toLowerCase();
      return n === lower || norm(n) === lowerNorm;
    }) || null
  );
};

// ── Meta format ──────────────────────────────────────────────
type MsgType = 'qa' | 'research' | 'compare' | 'interview' | 'interview_practice' | 'coverletter' | 'feedback' | 'salary' | 'job_fit' | 'job_listing';
type MsgMeta = {
  label: string;
  type: MsgType;
  sources: Array<{ url: string; sourceType: string }>;
  lastCrawledAt?: string | null;
};

const buildMeta = (
  label: string,
  type: MsgType,
  contexts: AnswerContext[],
  lastCrawledAt?: string | null,
): string =>
  JSON.stringify({
    label,
    type,
    sources: contexts
      .filter((c) => c?.sourceUrl)
      .map((c) => ({ url: c.sourceUrl!, sourceType: c.source_type ?? '' })),
    lastCrawledAt: lastCrawledAt ?? null,
  });

const parseMeta = (meta?: string): { label: string; msgMeta: MsgMeta | null } => {
  if (!meta) return { label: '', msgMeta: null };
  try {
    const parsed = JSON.parse(meta) as MsgMeta;
    if (parsed.label && parsed.type) return { label: parsed.label, msgMeta: parsed };
  } catch { /* plain string fallback */ }
  return { label: meta, msgMeta: null };
};

function formatCrawledAt(dateStr: string | null | undefined): string {
  if (!dateStr) return '수집 전';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMin < 1) return '방금 수집';
  if (diffMin < 60) return `${diffMin}분 전 수집`;
  if (diffHour < 24) return `${diffHour}시간 전 수집`;
  if (diffDay < 7) return `${diffDay}일 전 수집`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전 수집`;
  return `${Math.floor(diffDay / 30)}개월 전 수집`;
}

// ── Markdown components ──────────────────────────────────────
const md: Record<string, React.ComponentType<any>> = {
  h1: ({ children }) => <h1 className="text-xl font-bold text-text mb-3 mt-5 first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-text mb-2 mt-5 first:mt-0 pb-1 border-b border-surface-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="text-[0.88rem] font-semibold text-text-sub mb-1 mt-3 first:mt-0">{children}</h3>,
  p:  ({ children }) => <p className="mb-2 leading-[1.75] text-[0.93rem]">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-[0.93rem] leading-[1.65]">{children}</li>,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4 rounded-lg border border-surface-2">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-text border-b border-surface-2 text-[0.82rem] whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-surface text-text-sub text-[0.82rem]">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-surface hover:bg-surface-2 transition-colors">{children}</tr>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:text-accent-2 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  em:     ({ children }) => <em className="text-text-sub italic">{children}</em>,
  code:   ({ children }) => (
    <code className="bg-surface px-1.5 py-0.5 rounded text-[0.82rem] text-text-sub font-mono">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent pl-3 text-muted italic mb-2 text-[0.9rem]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-surface-2 my-3" />,
};

// ── Source chips ─────────────────────────────────────────────
function SourceChips({ sources }: { sources: MsgMeta['sources'] }) {
  const PAGE_TYPE_LABELS: Record<string, string> = {
    about: '회사소개', recruit: '채용', career: '채용', careers: '채용', jobs: '채용',
    ir: 'IR/투자', invest: 'IR/투자', finance: '재무',
    culture: '조직문화', welfare: '복지', benefit: '복지', benefits: '복지',
    news: '뉴스', press: '보도자료', notice: '공지',
    product: '제품/서비스', service: '서비스', solution: '솔루션',
    esg: 'ESG', sustainability: 'ESG', csr: 'ESG',
    contact: '연락처', faq: 'FAQ', support: '고객지원',
  };

  const getLabel = (url: string) => {
    try {
      if (url.includes('dart.fss.or.kr')) return 'DART 공시';
      const parsed = new URL(url);
      const host = parsed.hostname.replace('www.', '');
      const path = parsed.pathname.replace(/^\/|\/$/g, '').toLowerCase();
      const segments = path.split('/').filter(Boolean);
      // 경로에서 페이지 유형 매칭
      let desc = '';
      for (const seg of segments) {
        for (const [key, label] of Object.entries(PAGE_TYPE_LABELS)) {
          if (seg.includes(key)) { desc = label; break; }
        }
        if (desc) break;
      }
      const domain = host.length > 22 ? host.slice(0, 22) + '…' : host;
      return desc ? `${domain} - ${desc}` : domain;
    } catch {
      return url.slice(0, 24) + '…';
    }
  };

  const getIcon = (sourceType: string) => {
    if (sourceType === 'dart_info') return 'DART';
    if (sourceType === 'news') return '뉴스';
    return '링크';
  };

  const visible = sources.filter((s) => s.sourceType !== 'dart_info');
  if (!visible.length) return null;

  return (
    <div className="mt-3 pt-2.5 border-t border-surface-2">
      <p className="text-[11px] text-muted mb-1.5 font-medium uppercase tracking-wide">참고 출처</p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.url}
            className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full bg-surface border border-surface-2 text-[11px] text-text-sub hover:bg-surface-2 transition-colors"
          >
            <span className="flex-shrink-0">{getIcon(s.sourceType)}</span>
            <span>[{i + 1}] {getLabel(s.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Type badge config ────────────────────────────────────────
const TYPE_CONFIG: Record<MsgType, { badge: string }> = {
  research:           { badge: '심층 분석' },
  compare:            { badge: '비교 분석' },
  interview:          { badge: '면접 준비' },
  interview_practice: { badge: '모의 면접' },
  coverletter:        { badge: '자기소개서 초안' },
  feedback:           { badge: '자소서 피드백' },
  salary:             { badge: '연봉 협상 가이드' },
  job_fit:            { badge: '직무 적합도' },
  job_listing:        { badge: '채용공고 추천' },
  qa:                 { badge: '' },
};

// ── ChatBubble ───────────────────────────────────────────────
function ChatBubble({
  role,
  content,
  meta,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta?: string;
}) {
  const { label, msgMeta } = parseMeta(meta);
  const isRich = role === 'assistant' && msgMeta && msgMeta.type !== 'qa';
  const typeConf = msgMeta ? TYPE_CONFIG[msgMeta.type] : null;

  return (
    <div
      className={`w-full max-w-3xl mx-auto px-6 py-3 flex gap-4 items-start animate-fadeIn ${
        role === 'user' ? 'flex-row-reverse' : ''
      }`}
    >
      <div className={`flex-1 min-w-0 ${role === 'user' ? 'flex flex-col items-end' : ''}`}>
        {/* User bubble */}
        {role === 'user' && (
          <div className="bg-surface rounded-[18px_4px_18px_18px] px-4 py-[10px] max-w-fit text-sm text-text whitespace-pre-wrap break-words leading-[1.65]">
            {content}
          </div>
        )}

        {/* System message */}
        {role === 'system' && (
          <p className="text-muted text-[0.87rem] whitespace-pre-wrap break-words leading-[1.65]">
            {content}
          </p>
        )}

        {/* Research / Compare / Interview / Resume — card */}
        {role === 'assistant' && isRich && typeConf && (
          <div className="rounded-xl bg-surface border border-surface-2 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-2 bg-surface-2">
              <span className="text-[12px] font-semibold text-text-sub flex-1 truncate">{label}</span>
              {typeConf.badge && (
                <span className="text-[10px] text-muted px-2 py-0.5 rounded-full border border-surface-2 flex-shrink-0">
                  {typeConf.badge}
                </span>
              )}
            </div>
            <div className="px-5 py-4 text-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                {content}
              </ReactMarkdown>
            </div>
            {msgMeta.sources.length > 0 && (
              <div className="px-5 pb-4">
                <SourceChips sources={msgMeta.sources} />
              </div>
            )}
          </div>
        )}

        {/* Regular QA assistant */}
        {role === 'assistant' && !isRich && (
          <>
            {label && (
              <p className="text-[11px] text-muted mb-1 flex items-center gap-1.5">
                <span>{label}</span>
                {msgMeta?.lastCrawledAt !== undefined && (
                  <>
                    <span className="text-muted">·</span>
                    <span className={msgMeta?.lastCrawledAt ? 'text-muted' : 'text-[#ff9090]'}>
                      {formatCrawledAt(msgMeta?.lastCrawledAt)}
                    </span>
                  </>
                )}
              </p>
            )}
            <div className="text-[0.94rem] text-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                {content}
              </ReactMarkdown>
              {msgMeta?.sources && msgMeta.sources.length > 0 && (
                <SourceChips sources={msgMeta.sources} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// placeholder 텍스트를 실제 회사명으로 등록하지 않도록 차단
const PLACEHOLDER_NAMES = new Set(['회사명', '회사명a', '회사명b', '직군', '[회사명]', '[직군]']);
const isPlaceholderName = (name: string) => PLACEHOLDER_NAMES.has(name.toLowerCase().replace(/\s/g, ''));

/**
 * 회사를 생성하고 크롤링을 실행한다.
 * - Naver로 URL을 찾지 못하거나 수집된 문서가 0개이면 생성된 회사를 자동 삭제하고 null을 반환한다.
 * - 존재하지 않는 회사가 관심 기업 목록에 남는 것을 방지한다.
 */
function normalizeWebsite(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return url.toLowerCase(); }
}

async function createAndCrawlCompany(name: string, website = ''): Promise<{ id: number } | null> {
  const targetKey = norm(name.toLowerCase());
  const websiteKey = website ? normalizeWebsite(website) : '';
  const existing = await getCompanies()
    .then((list) => list.find((c) => {
      if (norm(trim(c.name).toLowerCase()) === targetKey) return true;
      if (websiteKey && c.website && normalizeWebsite(c.website) === websiteKey) return true;
      return false;
    }) ?? null)
    .catch(() => null);

  if (existing) {
    if (!existing.lastCrawledAt) {
      try {
        const crawlResult = await crawlCompany(existing.id);
        if (!crawlResult || crawlResult.savedDocumentCount === 0) {
          return null;
        }
      } catch {
        return null;
      }
    }
    return { id: existing.id };
  }

  const created = await createCompany({ name, website, description: '' });
  if (created.lastCrawledAt) {
    return { id: created.id };
  }
  try {
    const crawlResult = await crawlCompany(created.id);
    if (!crawlResult || crawlResult.savedDocumentCount === 0) {
      await deleteCompany(created.id);
      return null;
    }
    return { id: created.id };
  } catch {
    // 백엔드가 URL을 찾지 못하거나 크롤링 오류 시 회사 삭제
    try { await deleteCompany(created.id); } catch { /* ignore */ }
    return null;
  }
}

// ── Suggestion categories ────────────────────────────────────
// 클릭 시 input에 채워지고 포커스만 이동 (즉시 전송 안 함)
const SUGGESTION_CATEGORIES = [
  {
    label: '기업 조사',
    items: [
      '카카오 심층 분석해줘',
      '카카오와 네이버 비교해줘',
      '토스 채용공고 알려줘',
    ],
  },
  {
    label: '면접 준비',
    items: [
      '삼성전자 면접 준비해줘',
      '카카오 모의 면접 시작해줘',
    ],
  },
  {
    label: '자기소개서',
    items: [
      '네이버 백엔드 개발자 자소서 써줘',
      '자소서 피드백 받고 싶어',
    ],
  },
  {
    label: '연봉 & 적합도',
    items: [
      '카카오 개발자 연봉 협상 도와줘',
      '채용공고 적합도 분석해줘',
    ],
  },
];


// ── Main ChatPage ─────────────────────────────────────────────
export default function ChatPage() {
  const {
    activeId,
    activeMessages,
    addMessage,
    setSelectedCompanyId,
    companies,
    setCompanies,
    topK,
    createConversation,
  } = useChatStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const userName = useAuthStore((s) => s.name);
  const profileCareerLevel = useAuthStore((s) => s.careerLevel);
  const profileDesiredJob = useAuthStore((s) => s.desiredJob);
  const profileTechStack = useAuthStore((s) => s.techStack);
  const profileDesiredIndustry = useAuthStore((s) => s.desiredIndustry);
  const profileCompanySize = useAuthStore((s) => s.companySize);
  const profileResumeText = useAuthStore((s) => s.resumeText);
  // 프로필 정보를 메시지 앞에 주입하는 헬퍼
  const withProfile = (msg: string): string => {
    const parts: string[] = [];
    if (profileCareerLevel) parts.push(`경력: ${profileCareerLevel}`);
    if (profileDesiredJob) parts.push(`희망 직군: ${profileDesiredJob}`);
    if (profileTechStack) parts.push(`보유 역량/툴: ${profileTechStack}`);
    if (profileDesiredIndustry) parts.push(`희망 업종: ${profileDesiredIndustry}`);
    if (profileCompanySize) parts.push(`희망 기업규모: ${profileCompanySize}`);
    if (parts.length === 0 && !profileResumeText) return msg;
    const header = parts.length > 0 ? `[사용자 프로필: ${parts.join(', ')}]` : '';
    const resume = profileResumeText ? `[자기소개서/이력서]\n${profileResumeText}` : '';
    const context = [header, resume].filter(Boolean).join('\n');
    return `${context}\n\n${msg}`;
  };

  const messages = activeMessages();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const jobUrlHandledRef = useRef(false);
  const greetHandledRef = useRef(false);

  // 모의 면접 모드 상태
  const [interviewMode, setInterviewMode] = useState<{
    companyId?: number;
    companyName: string;
    history: Array<{ role: string; content: string }>;
  } | null>(null);

  const [salaryMode, setSalaryMode] = useState<{
    companyId?: number;
    companyName: string;
    history: Array<{ role: string; content: string }>;
  } | null>(null);

  const [coverletterMode, setCoverletterMode] = useState<{
    companyId?: number;
    companyName: string;
    history: Array<{ role: string; content: string }>;
    isRevising: boolean;
    draftContent?: string;
  } | null>(null);

  const [interviewPrepMode, setInterviewPrepMode] = useState<{
    companyId?: number;
    companyName: string;
    history: Array<{ role: string; content: string }>;
    isRevising: boolean;
  } | null>(null);

  const [disambiguateMode, setDisambiguateMode] = useState<{
    candidates: import('../types').CompanySearchResult[];
    originalMsg: string;
    companyName: string;
  } | null>(null);

  type JobItem = { title: string; company: string; location: string; experience: string; skills: string[]; url: string };
  const [jobSelectMode, setJobSelectMode] = useState<{
    sessionType: 'interview' | 'interview_practice' | 'coverletter';
    companyId?: number;
    companyName: string;
    jobs: JobItem[];
    originalMsg: string;
  } | null>(null);

  const [urlInputMode, setUrlInputMode] = useState<{
    companyName: string;
    originalMsg: string;
  } | null>(null);
  const [urlInputValue, setUrlInputValue] = useState('');

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setInterviewMode(null);
    setSalaryMode(null);
    setCoverletterMode(null);
    setInterviewPrepMode(null);
    setJobSelectMode(null);
  }, [activeId]);

  useEffect(() => {
    if (companies.length === 0) {
      getCompanies().then(setCompanies).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (jobUrlHandledRef.current) return;
    const company = searchParams.get('company');
    const jobUrl = searchParams.get('jobUrl');
    if (company) {
      jobUrlHandledRef.current = true;
      setSearchParams({}, { replace: true }); // URL params 제거
      const msg = jobUrl
        ? `${company} 분석해줘 (채용공고 참고: ${jobUrl})`
        : `${company} 분석해줘`;
      handleSend(msg);
    }
  }, []); // 마운트 시 한 번만

  useEffect(() => {
    if (greetHandledRef.current) return;
    const greetCompany = (location.state as { greetCompany?: string } | null)?.greetCompany;
    if (!greetCompany) return;
    greetHandledRef.current = true;
    window.history.replaceState({}, ''); // state 제거
    addMessage({ role: 'system', content: `${greetCompany}에 대해 무엇이 궁금하세요?` });
  }, []); // 마운트 시 한 번만

  const sys = useCallback(
    (text: string) => addMessage({ role: 'system', content: text }),
    [addMessage]
  );

  const ensureCompanies = async (): Promise<Company[]> => {
    const list = await getCompanies();
    setCompanies(list);
    return list;
  };

  const resolveCompanyByText = async (msg: string): Promise<Company | null> => {
    const list = await ensureCompanies();
    return findCompany(msg, list);
  };

  const handleCoverletterToInterview = async () => {
    if (!coverletterMode) return;
    const { companyId, companyName, draftContent } = coverletterMode;
    setCoverletterMode(null);
    await addMessage({ role: 'user', content: companyName ? `${companyName} 면접 준비해줘` : '면접 준비해줘' });
    setLoading(true);
    try {
      const contextMsg = draftContent
        ? `아래 자기소개서를 바탕으로 면접 준비를 도와줘.\n\n[자기소개서]\n${draftContent}`
        : '면접 준비를 도와줘.';
      const firstMessage = { role: 'user', content: withProfile(contextMsg) };
      const result: InterviewPrepConsultResponse = await interviewPrepConsult([firstMessage], companyId);
      await addMessage({
        role: 'assistant',
        content: result.answer,
        meta: buildMeta(
          companyName ? `${companyName} 면접 준비` : '면접 준비',
          'interview',
          [],
        ),
      });
      setInterviewPrepMode({
        companyId,
        companyName: companyName || '',
        history: [firstMessage, { role: 'assistant', content: result.answer }],
        isRevising: result.isComplete,
      });
    } catch {
      sys('면접 준비 전환 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (text?: string, skipAddUserMessage = false) => {
    const msg = trim(text ?? input);
    if (!msg || loading) return;

    if (msg.length > 5000) {
      sys(`메시지가 너무 깁니다 (${msg.length}자). 5000자 이내로 입력해 주세요.`);
      return;
    }

    if (activeId == null) {
      await createConversation();
    }

    if (!skipAddUserMessage) {
      await addMessage({ role: 'user', content: msg });
    }
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      // ── 모의 면접 모드: 진행 중이면 intent 분류 없이 바로 처리 ──────
      if (interviewMode) {
        const newHistory = [...interviewMode.history, { role: 'user', content: msg }];
        const result: InterviewPracticeResponse = await interviewPractice(newHistory, interviewMode.companyId);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(
            `${interviewMode.companyName} 모의 면접`,
            'interview_practice',
            [],
          ),
        });

        if (result.isComplete) {
          setInterviewMode(null);
          sys('모의 면접이 종료되었습니다. 수고하셨습니다!');
        } else {
          setInterviewMode({
            ...interviewMode,
            history: [...newHistory, { role: 'assistant', content: result.answer }],
          });
        }
        return;
      }

      // ── 연봉 협상 모드: 진행 중이면 intent 분류 없이 바로 처리 ──
      if (salaryMode) {
        const newHistory = [...salaryMode.history, { role: 'user', content: msg }];
        const result: SalaryNegotiationResponse = await salaryNegotiation(newHistory, salaryMode.companyId);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(
            salaryMode.companyName ? `${salaryMode.companyName} 연봉 협상 상담` : '연봉 협상 상담',
            'salary',
            [],
          ),
        });

        if (result.isComplete) {
          setSalaryMode(null);
          sys('연봉 협상 상담이 완료되었습니다.');
        } else {
          setSalaryMode({
            ...salaryMode,
            history: [...newHistory, { role: 'assistant', content: result.answer }],
          });
        }
        return;
      }

      // ── 자소서 상담 모드 ────────────────────────────────────
      if (coverletterMode) {
        const newHistory = [...coverletterMode.history, { role: 'user', content: msg }];

        // 초안 완성 후 피드백 요청이면 feedback 엔드포인트로 라우팅
        const isFeedbackRequest = coverletterMode.isRevising && /피드백|첨삭|검토|평가|봐줘/.test(msg);
        if (isFeedbackRequest) {
          const feedbackContent = coverletterMode.draftContent
            ? `${coverletterMode.draftContent}\n\n${msg}`
            : msg;
          sys('자기소개서를 분석 중입니다. 잠시 기다려 주세요...');
          const feedbackResult: CoverLetterFeedbackResponse = await coverLetterFeedback(withProfile(feedbackContent), coverletterMode.companyId);
          const cited = feedbackResult.externalContexts?.filter((c) => c?.sourceUrl) ?? [];
          await addMessage({
            role: 'assistant',
            content: feedbackResult.answer || '피드백을 생성하지 못했습니다.',
            meta: buildMeta(
              coverletterMode.companyName ? `${coverletterMode.companyName} 자소서 피드백` : '자소서 피드백',
              'feedback',
              cited,
            ),
          });
          setCoverletterMode({
            ...coverletterMode,
            history: [...newHistory, { role: 'assistant', content: feedbackResult.answer }],
          });
          return;
        }

        const result: CoverletterConsultResponse = await coverletterConsult(newHistory, coverletterMode.companyId);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(
            coverletterMode.companyName ? `${coverletterMode.companyName} 자기소개서 작성` : '자기소개서 작성',
            'coverletter',
            [],
          ),
        });

        const justCompleted = result.isComplete && !coverletterMode.isRevising;
        setCoverletterMode({
          ...coverletterMode,
          history: [...newHistory, { role: 'assistant', content: result.answer }],
          isRevising: result.isComplete || coverletterMode.isRevising,
          draftContent: justCompleted ? result.answer : coverletterMode.draftContent,
        });
        return;
      }

      // ── 면접 준비 상담 모드 ─────────────────────────────────
      if (interviewPrepMode) {
        const newHistory = [...interviewPrepMode.history, { role: 'user', content: msg }];
        const result: InterviewPrepConsultResponse = await interviewPrepConsult(newHistory, interviewPrepMode.companyId);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(
            interviewPrepMode.companyName ? `${interviewPrepMode.companyName} 면접 준비` : '면접 준비',
            'interview',
            [],
          ),
        });

        setInterviewPrepMode({
          ...interviewPrepMode,
          history: [...newHistory, { role: 'assistant', content: result.answer }],
          isRevising: result.isComplete,
        });
        return;
      }

      const { intent, company_name, company_names } = await classifyIntent(msg);

      // 동명 회사 후보 확인 helper (신규 회사 등록 전 호출)
      const checkAndDisambiguate = async (name: string): Promise<boolean> => {
        const candidates = await getCompanyCandidates(name);
        const normName = norm(name.toLowerCase());
        const distinct = candidates.filter(
          (c) => norm(c.name.toLowerCase()).includes(normName) ||
                  normName.includes(norm(c.name.toLowerCase()))
        );

        // 이름 포함 관계로 매칭되는 게 없으면 전체 후보 사용 (오타 수정 폴백)
        const isFallback = distinct.length === 0 && candidates.length > 0;
        const effective = isFallback ? candidates : distinct;

        // 아무것도 없음 → URL 직접 입력 안내
        if (effective.length === 0) {
          sys(`'${name}' 회사를 찾을 수 없습니다. 회사 이름이 정확한지 확인하거나 URL을 직접 입력해 주세요.`);
          setUrlInputMode({ companyName: name, originalMsg: msg });
          setUrlInputValue('');
          return true;
        }

        // 정확히 일치하는 후보 1개 → disambiguation 불필요
        if (distinct.length === 1 && norm(distinct[0].name.toLowerCase()) === normName) return false;

        // 1개(이름 불일치·오타) or 2개 이상 → 선택 UI
        setDisambiguateMode({ candidates: effective, originalMsg: msg, companyName: name });
        const sysMsg = effective.length === 1
          ? `'${name}'을(를) 찾을 수 없습니다. 혹시 '${effective[0].name}'을(를) 말씀하신 건가요?`
          : isFallback
            ? `'${name}'을(를) 찾을 수 없습니다. 혹시 아래 회사 중 찾으시는 곳이 있나요?`
            : `'${name}'라는 이름의 회사가 여러 개 검색됐습니다. 아래에서 찾으시는 회사를 선택해 주세요.`;
        sys(sysMsg);
        return true;
      };

      // ── Research ──────────────────────────────────────────
      if (intent === 'research') {
        let company = await resolveCompanyByText(msg);
        if (!company) {
          const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();
          if (!extractedName) {
            sys('분석할 회사명을 입력해 주세요. 예) 카카오');
            return;
          }
          const list = await ensureCompanies();
          company = findCompanyExact(extractedName, list);

          if (!company) {
            if (isPlaceholderName(extractedName)) {
              sys(`'${extractedName}'은(는) 실제 회사명이 아닙니다. 분석할 회사명을 입력해 주세요. 예) 카카오`);
              return;
            }
            if (await checkAndDisambiguate(extractedName)) return;
            sys(`${extractedName} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            const created = await createAndCrawlCompany(extractedName);
            if (!created) { sys(`'${extractedName}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === created.id) || null;
            if (!company) { sys(`'${extractedName}' 정보 수집에 실패했습니다.`); return; }
          }
        }

        if (!company.lastCrawledAt) {
          sys(`${company.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
          await crawlCompany(company.id);
          const refreshed = await getCompanies();
          setCompanies(refreshed);
          company = refreshed.find((c) => c.id === company!.id) ?? company;
        }

        setSelectedCompanyId(company.id);
        sys(`${company.name} 심층 분석을 시작합니다. 잠시 기다려 주세요...`);

        const researchResult: ResearchResponse = await researchCompany(company.id);
        const cited = researchResult.externalContexts?.filter((c) => c?.sourceUrl) ?? [];

        await addMessage({
          role: 'assistant',
          content: researchResult.answer || '리포트를 생성하지 못했습니다.',
          meta: buildMeta(`${company.name} 심층 분석`, 'research', cited),
        });
        return;
      }

      // ── Compare ───────────────────────────────────────────
      if (intent === 'compare') {
        const names: string[] = (company_names as string[]) ?? [];
        if (names.length < 2) {
          sys('비교할 회사 이름을 2개 이상 포함해 주세요. 예) "카카오와 네이버 복지를 비교해줘"');
          return;
        }

        let list = await ensureCompanies();
        const resolved: Company[] = [];

        for (const name of names) {
          let company = findCompanyExact(name, list);

          if (!company) {
            if (isPlaceholderName(name)) {
              sys(`'${name}'은(는) 실제 회사명이 아닙니다. 비교할 회사명을 입력해 주세요. 예) 카카오와 네이버 비교해줘`);
              return;
            }
            if (await checkAndDisambiguate(name)) return;
            sys(`${name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            const created = await createAndCrawlCompany(name);
            if (!created) { sys(`'${name}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            list = refreshed;
            company = refreshed.find((c) => c.id === created.id) || null;
            if (!company) { sys(`'${name}' 정보 수집에 실패했습니다.`); return; }
          } else if (!company.lastCrawledAt) {
            sys(`${company.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            await crawlCompany(company.id);
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            list = refreshed;
            company = refreshed.find((c) => c.id === company!.id) || company;
          }

          resolved.push(company);
        }

        const ids = resolved.map((c) => c.id);
        sys(`${resolved.map((c) => c.name).join(', ')} 비교 분석 중입니다. 잠시 기다려 주세요...`);
        const compareResult: CompareResponse = await compareCompanies(ids, withProfile(msg));
        const cited = compareResult.externalContexts?.filter((c) => c?.sourceUrl) ?? [];

        await addMessage({
          role: 'assistant',
          content: compareResult.answer || '비교 답변을 가져오지 못했습니다.',
          meta: buildMeta(`${resolved.map((c) => c.name).join(' vs ')} 비교`, 'compare', cited),
        });
        return;
      }

      // ── Interview Prep (소크라틱 면접 준비 상담) ─────────
      if (intent === 'interview') {
        const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();

        let companyId: number | undefined;
        let companyName = extractedName;

        if (extractedName) {
          const list = await ensureCompanies();
          let company = findCompanyExact(extractedName, list);

          if (!company) {
            if (isPlaceholderName(extractedName)) {
              sys(`'${extractedName}'은(는) 실제 회사명이 아닙니다. 회사명을 입력해 주세요. 예) 카카오`);
              return;
            }
            if (await checkAndDisambiguate(extractedName)) return;
            sys(`${extractedName} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            const created = await createAndCrawlCompany(extractedName);
            if (!created) { sys(`'${extractedName}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === created.id) || null;
          } else if (!company.lastCrawledAt) {
            sys(`${company.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            await crawlCompany(company.id);
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === company!.id) || company;
          }

          if (company) {
            companyId = company.id;
            companyName = company.name;
            setSelectedCompanyId(company.id);
          }
        }

        // 채용 중인 직무 목록 조회 → 선택 UI 표시
        if (companyName) {
          try {
            const jobResult = await getJobListings(companyName);
            if (jobResult.jobs && jobResult.jobs.length > 0) {
              sys(`${companyName}에서 현재 채용 중인 포지션을 찾았습니다. 지원하실 직무를 선택해 주세요.`);
              setJobSelectMode({ sessionType: 'interview', companyId, companyName, jobs: jobResult.jobs, originalMsg: msg });
              return;
            }
          } catch { /* 공고 없으면 바로 시작 */ }
        }

        const firstMessage = { role: 'user', content: withProfile(msg) };
        const result: InterviewPrepConsultResponse = await interviewPrepConsult([firstMessage], companyId);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(
            companyName ? `${companyName} 면접 준비` : '면접 준비',
            'interview',
            [],
          ),
        });

        setInterviewPrepMode({
          companyId,
          companyName: companyName || '',
          history: [firstMessage, { role: 'assistant', content: result.answer }],
          isRevising: result.isComplete,
        });
        return;
      }

      // ── Interview Practice (모의 면접) ────────────────────
      if (intent === 'interview_practice') {
        let company = await resolveCompanyByText(msg);

        if (!company) {
          const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();
          if (!extractedName) {
            sys('면접 볼 회사명을 입력해 주세요. 예) 카카오');
            return;
          }
          if (extractedName) {
            const list = await ensureCompanies();
            company = findCompanyExact(extractedName, list);

            if (!company) {
              if (isPlaceholderName(extractedName)) {
                sys(`'${extractedName}'은(는) 실제 회사명이 아닙니다. 회사명을 입력해 주세요. 예) 카카오`);
                return;
              }
              if (await checkAndDisambiguate(extractedName)) return;
              sys(`${extractedName} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
              const created = await createAndCrawlCompany(extractedName);
              if (!created) { sys(`'${extractedName}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
              const refreshed = await getCompanies();
              setCompanies(refreshed);
              company = refreshed.find((c) => c.id === created.id) || null;
            }
          }
        }

        if (company && !company.lastCrawledAt) {
          sys(`${company.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
          await crawlCompany(company.id);
          const refreshed = await getCompanies();
          setCompanies(refreshed);
          company = refreshed.find((c) => c.id === company!.id) ?? company;
        }

        const companyName = company?.name ?? '일반';
        if (company) setSelectedCompanyId(company.id);

        // 채용 중인 직무 목록 조회 → 선택 UI 표시
        if (company) {
          try {
            const jobResult = await getJobListings(company.name);
            if (jobResult.jobs && jobResult.jobs.length > 0) {
              sys(`${company.name}에서 현재 채용 중인 포지션을 찾았습니다. 모의 면접을 볼 직무를 선택해 주세요.`);
              setJobSelectMode({ sessionType: 'interview_practice', companyId: company.id, companyName: company.name, jobs: jobResult.jobs, originalMsg: msg });
              return;
            }
          } catch { /* 공고 없으면 바로 시작 */ }
        }

        sys(`${companyName} 모의 면접을 시작합니다. 면접관이 질문하면 답변해 주세요.`);

        const result: InterviewPracticeResponse = await interviewPractice([], company?.id);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(`${companyName} 모의 면접`, 'interview_practice', []),
        });

        setInterviewMode({
          companyId: company?.id,
          companyName,
          history: [{ role: 'assistant', content: result.answer }],
        });
        return;
      }

      // ── Cover Letter (소크라틱 자소서 작성 상담) ─────────
      if (intent === 'coverletter') {
        const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();

        let companyId: number | undefined;
        let companyName = extractedName;

        if (extractedName) {
          const list = await ensureCompanies();
          let company = findCompanyExact(extractedName, list);

          if (!company) {
            if (isPlaceholderName(extractedName)) {
              sys(`'${extractedName}'은(는) 실제 회사명이 아닙니다. 회사명을 입력해 주세요. 예) 카카오`);
              return;
            }
            if (await checkAndDisambiguate(extractedName)) return;
            sys(`${extractedName} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            const created = await createAndCrawlCompany(extractedName);
            if (!created) { sys(`'${extractedName}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === created.id) || null;
          } else if (!company.lastCrawledAt) {
            sys(`${company.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            await crawlCompany(company.id);
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === company!.id) || company;
          }

          if (company) {
            companyId = company.id;
            companyName = company.name;
          }
        }

        // 채용 중인 직무 목록 조회 → 선택 UI 표시
        if (companyName) {
          try {
            const jobResult = await getJobListings(companyName);
            if (jobResult.jobs && jobResult.jobs.length > 0) {
              sys(`${companyName}에서 현재 채용 중인 포지션을 찾았습니다. 자소서를 작성할 직무를 선택해 주세요.`);
              setJobSelectMode({ sessionType: 'coverletter', companyId, companyName, jobs: jobResult.jobs, originalMsg: msg });
              return;
            }
          } catch { /* 공고 없으면 바로 시작 */ }
        }

        const firstMessage = { role: 'user', content: withProfile(msg) };
        const result: CoverletterConsultResponse = await coverletterConsult([firstMessage], companyId);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(
            companyName ? `${companyName} 자기소개서 작성` : '자기소개서 작성',
            'coverletter',
            [],
          ),
        });

        setCoverletterMode({
          companyId,
          companyName: companyName || '',
          history: [firstMessage, { role: 'assistant', content: result.answer }],
          isRevising: result.isComplete,
        });
        return;
      }

      // ── Cover Letter Feedback (자소서 피드백) ─────────────
      if (intent === 'feedback') {
        if (msg.length < 100) {
          sys('피드백할 자기소개서 내용을 함께 입력해 주세요.\n예) "아래 자소서 피드백해줘:\n[자소서 내용을 붙여넣어 주세요]"');
          return;
        }

        const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();
        let companyId: number | undefined;

        if (extractedName) {
          const list = await ensureCompanies();
          const found = findCompanyExact(extractedName, list);
          if (found) companyId = found.id;
        }

        sys('자기소개서를 분석 중입니다. 잠시 기다려 주세요...');
        const feedbackResult: CoverLetterFeedbackResponse = await coverLetterFeedback(withProfile(msg), companyId);
        const cited = feedbackResult.externalContexts?.filter((c) => c?.sourceUrl) ?? [];
        const label = extractedName ? `${extractedName} 자소서 피드백` : '자소서 피드백';

        await addMessage({
          role: 'assistant',
          content: feedbackResult.answer || '피드백을 생성하지 못했습니다.',
          meta: buildMeta(label, 'feedback', cited),
        });
        return;
      }

      // ── Salary Negotiation (대화형 연봉 협상 상담) ────────
      if (intent === 'salary') {
        const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();

        let companyId: number | undefined;
        let companyName = extractedName;

        if (extractedName) {
          const list = await ensureCompanies();
          let company = findCompanyExact(extractedName, list);

          if (!company) {
            if (isPlaceholderName(extractedName)) {
              sys(`'${extractedName}'은(는) 실제 회사명이 아닙니다. 회사명을 입력해 주세요. 예) 카카오`);
              return;
            }
            if (await checkAndDisambiguate(extractedName)) return;
            sys(`${extractedName} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            const created = await createAndCrawlCompany(extractedName);
            if (!created) { sys(`'${extractedName}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === created.id) || null;
          } else if (!company.lastCrawledAt) {
            sys(`${company.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
            await crawlCompany(company.id);
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === company!.id) || company;
          }

          if (company) {
            companyId = company.id;
            companyName = company.name;
          }
        }

        // 첫 메시지를 포함해 대화 시작
        const firstMessage = { role: 'user', content: withProfile(msg) };
        const result: SalaryNegotiationResponse = await salaryNegotiation([firstMessage], companyId);

        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(
            companyName ? `${companyName} 연봉 협상 상담` : '연봉 협상 상담',
            'salary',
            [],
          ),
        });

        if (!result.isComplete) {
          setSalaryMode({
            companyId,
            companyName: companyName || '연봉 협상',
            history: [firstMessage, { role: 'assistant', content: result.answer }],
          });
        }
        return;
      }

      // ── Job Fit (채용공고 적합도 분석) ──────────────────
      if (intent === 'job_fit') {
        const hasUrl = /https?:\/\/\S+/.test(msg);
        if (!hasUrl && msg.length < 50) {
          sys('분석할 채용공고 URL이나 내용을 함께 입력해 주세요.\n예) "아래 채용공고 적합도 분석해줘:\n[URL 또는 채용공고 내용]"');
          return;
        }

        // 지원자 정보 유무 판별: 프로필 또는 메시지 내 직접 입력 여부 확인
        const hasProfileData = !!(profileCareerLevel || profileDesiredJob || profileTechStack || profileDesiredIndustry || profileResumeText);
        const msgWithoutUrlAndTriggers = msg
          .replace(/https?:\/\/\S+/g, '')
          .replace(/(채용공고|적합도|분석|해줘|봐줘|알려줘|아래|확인해줘|어때|맞아)\s*/g, '')
          .trim();
        const hasInlineUserInfo = msgWithoutUrlAndTriggers.length >= 10;

        if (!hasProfileData && !hasInlineUserInfo) {
          sys('적합도 분석을 위해 본인의 경력, 보유 기술, 관련 경험을 함께 입력해 주세요.\n예) "카카오 백엔드 개발자 3년차인데 적합한지 봐줘"\n또는 설정에서 프로필을 먼저 작성하면 자동으로 반영됩니다.');
          return;
        }

        const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();
        const label = extractedName ? `${extractedName} 직무 적합도` : '직무 적합도';

        sys('채용공고를 수집하고 분석 중입니다. 잠시 기다려 주세요...');
        const fitResult: JobFitResponse = await analyzeJobFit(withProfile(msg));
        const cited = fitResult.externalContexts?.filter((c) => c?.sourceUrl) ?? [];

        await addMessage({
          role: 'assistant',
          content: fitResult.answer || '적합도 분석을 생성하지 못했습니다.',
          meta: buildMeta(label, 'job_fit', cited),
        });
        return;
      }

      // ── Job Listing (채용공고 추천) ──────────────────────
      if (intent === 'job_listing') {
        sys('프로필 기반으로 맞춤 채용공고를 검색하고 있습니다. 잠시 기다려 주세요...');
        const profileMsg = withProfile(msg);
        const result = await jobRecommend(profileMsg);
        const cited = result.externalContexts?.filter((c: { sourceUrl?: string }) => c?.sourceUrl) ?? [];

        await addMessage({
          role: 'assistant',
          content: result.answer || '채용공고 추천을 생성하지 못했습니다.',
          meta: buildMeta('채용공고 추천', 'job_listing', cited),
        });
        return;
      }

      // ── Crawl (명시적 최신화 요청) ───────────────────────
      if (intent === 'crawl') {
        let company = await resolveCompanyByText(msg);

        if (!company) {
          const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();
          if (!extractedName) { sys('최신화할 회사 이름을 포함해 주세요.'); return; }
          const list = await ensureCompanies();
          const extractedNorm = norm(extractedName.toLowerCase());
          company = list.find((c) => norm(trim(c.name).toLowerCase()) === extractedNorm) ?? null;
          if (!company) {
            if (isPlaceholderName(extractedName)) {
              sys(`'${extractedName}'은(는) 실제 회사명이 아닙니다. 최신화할 회사명을 입력해 주세요.`);
              return;
            }
            const created = await createAndCrawlCompany(extractedName);
            if (!created) { sys(`'${extractedName}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
            const refreshed = await getCompanies();
            setCompanies(refreshed);
            company = refreshed.find((c) => c.id === created.id) || null;
            if (!company) { sys(`'${extractedName}' 등록에 실패했습니다.`); return; }
          }
        }

        sys(`${company.name} 정보를 최신화 중입니다. 잠시 기다려 주세요...`);
        await crawlCompany(company.id);
        setSelectedCompanyId(company.id);
        queryClient.invalidateQueries({ queryKey: ['companies'] });
        await addMessage({
          role: 'assistant',
          content: `${company.name} 정보 최신화가 완료되었습니다.`,
        });
        return;
      }

      // ── QA ───────────────────────────────────────────────
      let company = await resolveCompanyByText(msg);
      const showSources = company != null && !!company_name;

      if (!company) {
        const extractedName = trim(company_name || '').replace(/[?.!]/g, '').trim();
        if (!extractedName) {
          const res = await generalChat(msg);
          await addMessage({ role: 'assistant', content: res.answer });
          return;
        }
        const list = await ensureCompanies();
        company = findCompanyExact(extractedName, list);

        // DB에 없는 신규 회사 → 자동 등록 후 수집
        if (!company) {
          if (isPlaceholderName(extractedName)) {
            sys(`'${extractedName}'은(는) 실제 회사명이 아닙니다. 회사명을 입력해 주세요. 예) 카카오`);
            return;
          }
          if (await checkAndDisambiguate(extractedName)) return;
          sys(`${extractedName} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
          const created = await createAndCrawlCompany(extractedName);
          if (!created) { sys(`'${extractedName}' 정보를 찾을 수 없습니다. 존재하는 회사명인지 확인해 주세요.`); return; }
          const refreshed = await getCompanies();
          setCompanies(refreshed);
          company = refreshed.find((c) => c.id === created.id) || null;
          if (!company) { sys(`'${extractedName}' 정보 수집에 실패했습니다.`); return; }
        }
      }

      // 한 번도 수집된 적 없는 회사 → 자동 수집 후 답변
      if (!company.lastCrawledAt) {
        sys(`${company.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
        await crawlCompany(company.id);
        const refreshed = await getCompanies();
        setCompanies(refreshed);
        company = refreshed.find((c) => c.id === company!.id) ?? company;
      }

      setSelectedCompanyId(company.id);

      const result: AskQuestionResponse = await askQuestion(company.id, withProfile(msg), topK, userName ?? undefined);

      const answer = result.answerText || result.question?.answerText || '';
      if (!answer) {
        sys(`'${company.name}' 답변을 생성하지 못했습니다.`);
        return;
      }

      const cited = showSources ? (result.externalContexts?.filter((c) => c?.sourceUrl) ?? []) : [];

      await addMessage({
        role: 'assistant',
        content: answer,
        meta: buildMeta(`회사: ${company.name}`, 'qa', cited, company.lastCrawledAt),
      });
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errMsg =
        axErr?.response?.data?.message ||
        axErr?.response?.data?.error ||
        axErr?.message ||
        '알 수 없는 오류가 발생했습니다.';
      sys(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleJobSelect = async (job: JobItem | null) => {
    if (!jobSelectMode || loading) return;
    const { sessionType, companyId, companyName, originalMsg } = jobSelectMode;
    setJobSelectMode(null);
    setLoading(true);
    try {
      const jobTag = job
        ? `[지원 직무: ${job.title}${job.experience ? ` | 경력: ${job.experience}` : ''}${job.skills?.length ? ` | 요구 기술: ${job.skills.slice(0, 5).join(', ')}` : ''}]`
        : '';
      const profiledMsg = withProfile(originalMsg);
      const msgWithJob = jobTag ? `${jobTag}\n\n${profiledMsg}` : profiledMsg;

      if (sessionType === 'interview') {
        const firstMessage = { role: 'user', content: msgWithJob };
        const result: InterviewPrepConsultResponse = await interviewPrepConsult([firstMessage], companyId);
        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(companyName ? `${companyName} 면접 준비` : '면접 준비', 'interview', []),
        });
        setInterviewPrepMode({
          companyId,
          companyName: companyName || '',
          history: [firstMessage, { role: 'assistant', content: result.answer }],
          isRevising: result.isComplete,
        });
      } else if (sessionType === 'interview_practice') {
        sys(`${companyName} 모의 면접을 시작합니다. 면접관이 질문하면 답변해 주세요.`);
        const initMessages = jobTag ? [{ role: 'user', content: `${jobTag}\n면접을 시작해줘.` }] : [];
        const result: InterviewPracticeResponse = await interviewPractice(initMessages, companyId);
        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(`${companyName} 모의 면접`, 'interview_practice', []),
        });
        setInterviewMode({
          companyId,
          companyName,
          history: [{ role: 'assistant', content: result.answer }],
        });
      } else if (sessionType === 'coverletter') {
        const firstMessage = { role: 'user', content: msgWithJob };
        const result: CoverletterConsultResponse = await coverletterConsult([firstMessage], companyId);
        await addMessage({
          role: 'assistant',
          content: result.answer,
          meta: buildMeta(companyName ? `${companyName} 자기소개서 작성` : '자기소개서 작성', 'coverletter', []),
        });
        setCoverletterMode({
          companyId,
          companyName: companyName || '',
          history: [firstMessage, { role: 'assistant', content: result.answer }],
          isRevising: result.isComplete,
        });
      }
    } catch {
      sys('오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisambiguateSelect = async (candidate: import('../types').CompanySearchResult) => {
    if (loading || !disambiguateMode) return;
    const originalMsg = disambiguateMode.originalMsg;
    const originalName = disambiguateMode.companyName;
    // 오타/오입력된 회사명을 선택된 정확한 이름으로 치환하여 재처리 시 disambiguation 루프 방지
    const fixedMsg = originalName && originalName !== candidate.name
      ? originalMsg.replace(new RegExp(originalName, 'g'), candidate.name)
      : originalMsg;
    setDisambiguateMode(null);
    setLoading(true);
    try {
      sys(`${candidate.name} 정보를 수집 중입니다. 잠시 기다려 주세요...`);

      // 후보에 URL이 있으면 그대로 사용
      // Wanted 후보인 경우 wantedUrl에서 직접 홈페이지 추출
      // 그 외에는 정제된 검색 쿼리로 URL 탐색
      let website = candidate.website ?? '';
      if (!website && candidate.wantedUrl) {
        // Wanted 회사 페이지에서 공식 홈페이지 직접 추출
        const found = await findHomepageFromWantedUrl(candidate.wantedUrl).catch(() => null);
        if (found) website = found;
      }
      if (!website && candidate.description) {
        // description 정제: "지원,대행>지불,결제대행 · 경기도 안양시" → "지불결제대행"
        // · 기준으로 분리해 카테고리 부분만 취하고 > 뒤의 세부 분류만 사용
        const categoryPart = candidate.description.split('·')[0].trim();
        const subCategory = categoryPart.includes('>') ? categoryPart.split('>').pop()! : categoryPart;
        const cleanCategory = subCategory.replace(/[,>·\s]+/g, '').trim();
        if (cleanCategory) {
          const found = await findCompanyUrl(`${candidate.name} ${cleanCategory}`).catch(() => null);
          if (found) website = found;
        }
      }

      const created = await createAndCrawlCompany(candidate.name, website);
      if (!created) {
        // URL을 자동으로 찾지 못한 경우 사용자가 직접 입력하도록 안내
        setUrlInputMode({ companyName: candidate.name, originalMsg });
        setUrlInputValue('');
        sys(`'${candidate.name}' 공식 홈페이지를 자동으로 찾지 못했습니다. 아래에 URL을 직접 입력해 주세요.`);
        return;
      }
      const refreshed = await getCompanies();
      setCompanies(refreshed);
    } finally {
      setLoading(false);
    }
    await handleSend(fixedMsg, true);
  };

  const handleUrlInputSubmit = async () => {
    if (!urlInputMode || loading) return;
    const url = urlInputValue.trim();
    if (!url || !/^https?:\/\//.test(url)) return;
    const { companyName, originalMsg } = urlInputMode;
    setUrlInputMode(null);
    setUrlInputValue('');
    setLoading(true);
    let fixedOriginalMsg = originalMsg;
    try {
      sys(`${companyName} 정보를 수집 중입니다. 잠시 기다려 주세요...`);
      const created = await createAndCrawlCompany(companyName, url);
      if (!created) {
        sys(`'${companyName}' 정보를 가져오지 못했습니다. URL이 올바른지 확인해 주세요.`);
        return;
      }
      const refreshed = await getCompanies();
      setCompanies(refreshed);
      // 실제 등록된 회사명으로 오타를 교체하여 disambiguation 루프 방지
      const actualName = refreshed.find((c) => c.id === created.id)?.name ?? companyName;
      if (companyName !== actualName) {
        fixedOriginalMsg = originalMsg.replace(new RegExp(companyName, 'g'), actualName);
      }
    } finally {
      setLoading(false);
    }
    await handleSend(fixedOriginalMsg, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg">
      {/* Header */}
      <div className="flex items-center justify-center px-5 py-[14px] flex-shrink-0">
        <span className="font-semibold text-text flex items-center gap-2">
          ChatCompany
        </span>
      </div>

      {/* Empty state */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 py-10 text-center">
          <div className="text-[2.8rem] text-accent mb-1">◈</div>
          <h2 className="text-[1.6rem] font-bold text-text">무엇이든 물어보세요</h2>
          <p className="text-muted text-[0.95rem] max-w-[380px]">
            회사 정보, 면접 준비, 자소서 작성 등 취업 관련 무엇이든 도와드립니다
          </p>
          <div className="grid grid-cols-2 gap-2.5 mt-2 w-full max-w-[560px]">
            {SUGGESTION_CATEGORIES.map((cat) => (
              <div key={cat.label} className="rounded-xl border border-surface-2 bg-surface p-3 text-left">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">{cat.label}</p>
                <div className="flex flex-col gap-1">
                  {cat.items.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setInput(item);
                        textareaRef.current?.focus();
                      }}
                      className="text-left px-2.5 py-1.5 rounded-lg text-[0.82rem] text-text-sub hover:bg-surface-2 hover:text-text transition-colors leading-snug"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {hasMessages && (
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto py-6 pb-8 flex flex-col gap-0 scrollbar-thin"
        >
          {messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} content={m.content} meta={m.meta} />
          ))}
          {loading && (
            <div className="w-full max-w-3xl mx-auto px-6 py-3 flex gap-4 items-start">
              <div className="flex-1 text-muted text-sm flex items-center gap-1.5 pl-1 pt-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom area: gradient overlay + mode bar + input */}
      <div className="flex-shrink-0 bg-gradient-to-b from-transparent via-bg/80 to-bg -mt-10 pt-10">


      {/* 모의 면접 모드 배너 */}
      {interviewMode && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-6 pb-2">
          <div className="flex items-center justify-between bg-[#1e2a1e] border border-[#2a4a2a] rounded-xl px-4 py-2">
            <span className="text-[0.82rem] text-[#6fcf6f]">모의 면접 진행 중 — {interviewMode.companyName}</span>
            <button
              onClick={() => { setInterviewMode(null); sys('모의 면접을 종료했습니다.'); }}
              className="text-[0.78rem] text-[#aaa] hover:text-[#eee] transition-colors"
            >
              종료
            </button>
          </div>
        </div>
      )}

      {/* 자소서 작성 상담 모드 배너 */}
      {coverletterMode && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-6 pb-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between bg-[#1e1e2a] border border-[#2a2a4a] rounded-xl px-4 py-2">
            <span className="text-[0.82rem] text-[#9b9bef]">
              {coverletterMode.isRevising ? '자기소개서 수정/피드백' : '자기소개서 작성 중'}
              {coverletterMode.companyName ? ` — ${coverletterMode.companyName}` : ''}
            </span>
            <button
              onClick={() => { setCoverletterMode(null); sys('자기소개서 작성 상담을 종료했습니다.'); }}
              className="text-[0.78rem] text-[#aaa] hover:text-[#eee] transition-colors"
            >
              종료
            </button>
          </div>
          {coverletterMode.isRevising && (
            <div className="flex gap-2">
              <button
                onClick={() => handleSend('상세 피드백 받고 싶어')}
                disabled={loading}
                className="flex-1 text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a4a] text-[#9b9bef] hover:bg-[#1e1e2a] transition-colors disabled:opacity-40"
              >
                상세 피드백 받기
              </button>
              <button
                onClick={handleCoverletterToInterview}
                disabled={loading}
                className="flex-1 text-[11px] px-3 py-1.5 rounded-lg border border-[#2a4a2a] text-[#6fcf6f] hover:bg-[#1e2a1e] transition-colors disabled:opacity-40"
              >
                면접 준비로 이어가기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 면접 준비 상담 모드 배너 */}
      {interviewPrepMode && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-6 pb-2">
          <div className="flex items-center justify-between bg-[#1e2a1e] border border-[#2a4a2a] rounded-xl px-4 py-2">
            <span className="text-[0.82rem] text-[#6fcf6f]">
              {interviewPrepMode.isRevising ? '면접 준비 보완 중' : '면접 준비 상담 중'}
              {interviewPrepMode.companyName ? ` — ${interviewPrepMode.companyName}` : ''}
            </span>
            <button
              onClick={() => { setInterviewPrepMode(null); sys('면접 준비 상담을 종료했습니다.'); }}
              className="text-[0.78rem] text-[#aaa] hover:text-[#eee] transition-colors"
            >
              종료
            </button>
          </div>
        </div>
      )}

      {/* 연봉 협상 상담 모드 배너 */}
      {salaryMode && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-6 pb-2">
          <div className="flex items-center justify-between bg-[#1e2a2a] border border-[#2a4a4a] rounded-xl px-4 py-2">
            <span className="text-[0.82rem] text-[#6fcfcf]">연봉 협상 상담 중 — {salaryMode.companyName}</span>
            <button
              onClick={() => { setSalaryMode(null); sys('연봉 협상 상담을 종료했습니다.'); }}
              className="text-[0.78rem] text-[#aaa] hover:text-[#eee] transition-colors"
            >
              종료
            </button>
          </div>
        </div>
      )}

      {/* 직무 선택 카드 */}
      {jobSelectMode && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-6 pb-2">
          <div className="rounded-xl border border-[#2a3a4a] bg-[#111c2a] px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[0.82rem] font-medium text-[#7ec8e3]">
                {jobSelectMode.sessionType === 'interview' ? '면접 준비할' : jobSelectMode.sessionType === 'interview_practice' ? '모의 면접 볼' : '자소서 작성할'} 직무를 선택해 주세요
              </span>
              <button
                onClick={() => setJobSelectMode(null)}
                disabled={loading}
                className="text-[0.75rem] text-[#666] hover:text-[#aaa] transition-colors disabled:opacity-40"
              >
                취소
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {jobSelectMode.jobs.slice(0, 7).map((job, i) => (
                <button
                  key={i}
                  onClick={() => handleJobSelect(job)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-[#1e3040] text-[0.84rem] text-text hover:border-[#7ec8e3] hover:bg-[#0d1e2e] transition-colors disabled:opacity-40"
                >
                  <div className="font-medium text-[#e2e8f0]">{job.title}</div>
                  <div className="text-[0.75rem] text-[#6b8a9e] mt-0.5 flex flex-wrap gap-x-2">
                    {job.experience && <span>{job.experience}</span>}
                    {job.location && <span>{job.location}</span>}
                    {job.skills?.slice(0, 3).map((s, si) => (
                      <span key={si} className="text-[#4a8fa8]">#{s}</span>
                    ))}
                  </div>
                </button>
              ))}
              <button
                onClick={() => handleJobSelect(null)}
                disabled={loading}
                className="w-full text-left px-3 py-2 rounded-lg border border-dashed border-[#2a3a4a] text-[0.82rem] text-[#666] hover:border-[#4a6a7a] hover:text-[#aaa] transition-colors disabled:opacity-40 mt-1"
              >
                해당 직무가 없어요 — 직무 구분 없이 진행하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 동명 회사 선택 카드 */}
      {disambiguateMode && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-6 pb-2">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[0.82rem] font-medium text-text">
                {disambiguateMode.candidates.length === 1 ? '혹시 이 회사를 찾으시나요?' : '어떤 회사를 찾으시나요?'}
              </span>
              <button
                onClick={() => setDisambiguateMode(null)}
                disabled={loading}
                className="text-[0.75rem] text-[#666] hover:text-[#aaa] transition-colors disabled:opacity-40"
              >
                취소
              </button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto pr-1">
              {disambiguateMode.candidates.length === 1 ? (
                // 오타 교정 케이스: 예/아니오 버튼
                <>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDisambiguateSelect(disambiguateMode.candidates[0])}
                      disabled={loading}
                      className="flex-1 px-3 py-2 rounded-lg border border-[#4ade80] bg-[#0d1f0d] text-[0.85rem] text-[#4ade80] font-medium hover:bg-[#152b15] transition-colors disabled:opacity-40"
                    >
                      예, {disambiguateMode.candidates[0].name}
                    </button>
                    <button
                      onClick={() => {
                        const { originalMsg, companyName } = disambiguateMode;
                        setDisambiguateMode(null);
                        setUrlInputMode({ companyName, originalMsg });
                        setUrlInputValue('');
                      }}
                      disabled={loading}
                      className="flex-1 px-3 py-2 rounded-lg border border-[#3a3a3a] text-[0.85rem] text-[#666] hover:border-[#555] hover:text-[#aaa] transition-colors disabled:opacity-40"
                    >
                      아니오 — URL 직접 입력
                    </button>
                  </div>
                </>
              ) : (
                // 동명 이의어 케이스: 번호 목록
                <>
                  {disambiguateMode.candidates.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => handleDisambiguateSelect(c)}
                      disabled={loading}
                      className="w-full text-left px-3 py-2 rounded-lg border border-surface text-[0.85rem] text-text hover:border-[#4ade80] hover:bg-[#0d1f0d] transition-colors disabled:opacity-40"
                    >
                      <span className="text-[#4ade80] font-medium mr-2">{i + 1}</span>
                      {c.name}
                      {c.description && (
                        <span className="ml-2 text-[0.78rem] text-[#666]">
                          {c.description.length > 50 ? c.description.slice(0, 50) + '…' : c.description}
                        </span>
                      )}
                      {c.website && (
                        <span className="ml-2 text-[0.75rem] text-[#4ade80]/50 font-mono">
                          {(() => { try { return new URL(c.website).hostname.replace(/^www\./, ''); } catch { return c.website; } })()}
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const { originalMsg, companyName } = disambiguateMode;
                      setDisambiguateMode(null);
                      setUrlInputMode({ companyName, originalMsg });
                      setUrlInputValue('');
                    }}
                    disabled={loading}
                    className="w-full text-left px-3 py-2 rounded-lg border border-dashed border-[#3a3a3a] text-[0.82rem] text-[#666] hover:border-[#555] hover:text-[#aaa] transition-colors disabled:opacity-40 mt-1"
                  >
                    찾는 회사가 목록에 없어요 — URL 직접 입력
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* URL 직접 입력 카드 */}
      {urlInputMode && (
        <div className="flex-shrink-0 max-w-3xl w-full mx-auto px-6 pb-2">
          <div className="rounded-xl border border-[#3a3a3a] bg-[#1a1a1a] px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[0.82rem] font-medium text-[#ececec]">
                {urlInputMode.companyName} 홈페이지 URL 입력
              </span>
              <button
                onClick={() => { setUrlInputMode(null); setUrlInputValue(''); }}
                disabled={loading}
                className="text-[0.75rem] text-[#666] hover:text-[#aaa] transition-colors disabled:opacity-40"
              >
                취소
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInputValue}
                onChange={(e) => setUrlInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlInputSubmit(); }}
                placeholder="https://example.com"
                autoFocus
                className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-[#ececec] outline-none focus:border-[#4ade80] transition-colors placeholder:text-[#444]"
              />
              <button
                onClick={handleUrlInputSubmit}
                disabled={loading || !/^https?:\/\//.test(urlInputValue.trim())}
                className="px-3 py-1.5 rounded-lg bg-[#4ade80] text-[#111] text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-6 pb-4 pt-2 max-w-3xl w-full mx-auto">
        <div className="flex items-end gap-2 bg-surface border border-surface-2 rounded-2xl px-4 py-[10px] focus-within:border-muted focus-within:shadow-[0_0_0_3px_rgba(128,128,128,0.1)] transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              interviewMode
                ? `${interviewMode.companyName} 면접 답변을 입력하세요...`
                : salaryMode
                  ? `${salaryMode.companyName} 연봉 협상 관련 답변을 입력하세요...`
                  : coverletterMode
                    ? coverletterMode.isRevising
                      ? '수정 요청, 피드백 받기, 또는 면접 준비로 이어가세요...'
                      : coverletterMode.companyName ? `${coverletterMode.companyName} 자기소개서 관련 답변을 입력하세요...` : '자기소개서 관련 답변을 입력하세요...'
                    : interviewPrepMode
                      ? interviewPrepMode.isRevising
                        ? '추가로 궁금한 점이나 보완할 부분을 말씀해 주세요...'
                        : interviewPrepMode.companyName ? `${interviewPrepMode.companyName} 면접 준비 관련 답변을 입력하세요...` : '면접 준비 관련 답변을 입력하세요...'
                      : '무엇이든 질문하세요...'
            }
            disabled={loading}
            className="flex-1 bg-transparent border-none outline-none text-text text-[0.95rem] leading-[1.5] resize-none max-h-[200px] overflow-y-auto py-0.5 placeholder:text-muted font-sans disabled:opacity-50"
          />
          {input.length > 4000 && (
            <span className={`text-[11px] flex-shrink-0 self-end pb-1 ${input.length >= 5000 ? 'text-[#ff9090]' : 'text-muted'}`}>
              {input.length}/5000
            </span>
          )}
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="w-[34px] h-[34px] rounded-xl bg-accent flex items-center justify-center text-white flex-shrink-0 hover:bg-accent-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 14V2M8 2L3 7M8 2L13 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-center text-[11px] text-muted mt-2">
          AI는 실수할 수 있습니다. 중요한 정보는 공식 홈페이지에서 확인하세요.
        </p>
      </div>
      </div>

      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease; }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .typing-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: var(--color-muted);
          animation: typingBounce 1.2s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
}
