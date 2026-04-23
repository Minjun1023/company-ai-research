import type { ComponentType, ReactNode } from 'react';
import type { ConversationArtifact, SessionType } from '../../types';

export const trim = (value: unknown) => String(value ?? '').trim();

export type MsgType =
  | 'qa'
  | 'research'
  | 'compare'
  | 'interview'
  | 'coverletter'
  | 'feedback'
  | 'salary'
  | 'news_search';

export type MsgMeta = {
  label: string;
  type: MsgType;
  sources: Array<{ url: string; sourceType: string }>;
  lastCrawledAt?: string | null;
};

export type ModeStateCandidate = {
  name: string;
  website?: string;
  description?: string;
};

export type ModeState = {
  phase?: string;
  targetCompanyName?: string;
  pendingMessage?: string;
  pendingIntent?: string;
  candidates?: ModeStateCandidate[];
  companyId?: number;
  companyName?: string;
  pendingFeedbackMessage?: string;
};

type MarkdownNodeProps = {
  children?: ReactNode;
  href?: string;
  [key: string]: unknown;
};

export const parseMeta = (meta?: string): { label: string; msgMeta: MsgMeta | null } => {
  if (!meta) return { label: '', msgMeta: null };
  try {
    const parsed = JSON.parse(meta) as MsgMeta;
    if (parsed.label && parsed.type) return { label: parsed.label, msgMeta: parsed };
  } catch {
    // plain string fallback
  }
  return { label: meta, msgMeta: null };
};

export function parseModeState(raw?: string): ModeState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ModeState;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function formatCrawledAt(dateStr: string | null | undefined): string {
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

export function formatArtifactUpdatedAt(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function previewArtifactContent(content: string): string {
  return content
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function getHostname(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname;
  } catch {
    return null;
  }
}

export function getCompanyLetterColor(name: string): string {
  const colors = ['#9a6b2f', '#1f6656', '#35526f', '#724a2b', '#51603d', '#5d4a7a'];
  return colors[name.charCodeAt(0) % colors.length];
}

export const md: Record<string, ComponentType<MarkdownNodeProps>> = {
  h1: ({ children }) => <h1 className="mb-3 mt-5 text-xl font-bold text-text first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mt-5 border-b border-surface-2 pb-1 text-base font-semibold text-text first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mb-1 mt-3 text-[0.88rem] font-semibold text-text-sub first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mb-2 text-[0.93rem] leading-[1.75]">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-[0.93rem] leading-[1.65]">{children}</li>,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-lg border border-surface-2">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
  th: ({ children }) => (
    <th className="whitespace-nowrap border-b border-surface-2 px-3 py-2 text-left text-[0.82rem] font-semibold text-text">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-surface px-3 py-2 text-[0.82rem] text-text-sub">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-surface transition-colors hover:bg-surface-2">{children}</tr>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 transition-colors hover:text-accent-2"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  em: ({ children }) => <em className="italic text-text-sub">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.82rem] text-text-sub">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-accent pl-3 text-[0.9rem] italic text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-surface-2" />,
};

export function SourceChips({ sources }: { sources: MsgMeta['sources'] }) {
  const pageTypeLabels: Record<string, string> = {
    about: '회사소개',
    recruit: '채용',
    career: '채용',
    careers: '채용',
    jobs: '채용',
    ir: 'IR/투자',
    invest: 'IR/투자',
    finance: '재무',
    culture: '조직문화',
    welfare: '복지',
    benefit: '복지',
    benefits: '복지',
    news: '뉴스',
    press: '보도자료',
    notice: '공지',
    product: '제품/서비스',
    service: '서비스',
    solution: '솔루션',
    esg: 'ESG',
    sustainability: 'ESG',
    csr: 'ESG',
    contact: '연락처',
    faq: 'FAQ',
    support: '고객지원',
  };

  const getLabel = (url: string) => {
    try {
      if (url.includes('dart.fss.or.kr')) return 'DART 공시';
      const parsed = new URL(url);
      const host = parsed.hostname.replace('www.', '');
      const path = parsed.pathname.replace(/^\/|\/$/g, '').toLowerCase();
      const segments = path.split('/').filter(Boolean);
      let desc = '';
      for (const seg of segments) {
        for (const [key, label] of Object.entries(pageTypeLabels)) {
          if (seg.includes(key)) {
            desc = label;
            break;
          }
        }
        if (desc) break;
      }
      const domain = host.length > 22 ? `${host.slice(0, 22)}…` : host;
      return desc ? `${domain} - ${desc}` : domain;
    } catch {
      return `${url.slice(0, 24)}…`;
    }
  };

  const getIcon = (sourceType: string) => {
    if (sourceType === 'dart_info') return 'DART';
    if (sourceType === 'news') return '뉴스';
    return '링크';
  };

  const visible = sources.filter((source) => source.sourceType !== 'dart_info');
  if (!visible.length) return null;

  return (
    <div className="mt-3 border-t border-surface-2 pt-2.5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">참고 출처</p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((source, index) => (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.url}
            className="inline-flex items-center gap-1 rounded-full border border-surface-2 bg-surface px-2.5 py-[3px] text-[11px] text-text-sub transition-colors hover:bg-surface-2"
          >
            <span className="flex-shrink-0">{getIcon(source.sourceType)}</span>
            <span>[{index + 1}] {getLabel(source.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export const TYPE_CONFIG: Record<MsgType, { badge: string }> = {
  research: { badge: '심층 분석' },
  compare: { badge: '비교 분석' },
  interview: { badge: '면접 준비' },
  coverletter: { badge: '자기소개서 초안' },
  feedback: { badge: '자소서 피드백' },
  salary: { badge: '연봉 협상 가이드' },
  news_search: { badge: '뉴스' },
  qa: { badge: '' },
};

export const ARTIFACT_BADGE: Record<ConversationArtifact['artifactType'], string> = {
  research: '리서치',
  compare: '비교',
  interview: '면접',
  coverletter: '자소서',
  feedback: '피드백',
  salary: '연봉',
};

export const MODE_LABELS: Record<string, string> = {
  idle: '대기 중',
  qa: '회사 Q&A',
  compare: '비교 진행',
  research: '분석 진행',
  interview_prep: '면접 준비',
  interview_practice: '모의 면접',
  coverletter_consult: '자소서 작성',
  coverletter_feedback: '자소서 피드백',
  salary_consult: '연봉 상담',
  company_selection: '회사 선택',
  company_url_input: '회사 URL 입력',
  general: '일반 대화',
  news_agent: '뉴스 검색',
};

export function artifactSessionType(artifactType: ConversationArtifact['artifactType']): SessionType {
  switch (artifactType) {
    case 'research':
      return 'research';
    case 'compare':
      return 'compare';
    case 'interview':
      return 'interview';
    case 'salary':
      return 'salary';
    case 'coverletter':
    case 'feedback':
      return 'coverletter';
    default:
      return 'general';
  }
}
