import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanies, deleteCompany, crawlCompany } from '../api';
import type { Company } from '../types';

const FAILED_FAVICON_HOSTS = new Set<string>();
const LETTER_COLORS = ['#9a6b2f', '#1f6656', '#35526f', '#724a2b', '#51603d', '#5d4a7a'];

function getHostname(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname;
  } catch {
    return null;
  }
}

function getFaviconUrl(website: string | null): string | null {
  const hostname = getHostname(website);
  if (!hostname || FAILED_FAVICON_HOSTS.has(hostname)) return null;
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
}

function formatCrawledAt(iso: string | null): string {
  if (!iso) return '수집 전';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return '오늘 업데이트';
  if (days < 7) return `${days}일 전 업데이트`;
  if (days < 30) return `${Math.floor(days / 7)}주 전 업데이트`;
  return `${Math.floor(days / 30)}개월 전 업데이트`;
}

function getLetterColor(name: string): string {
  return LETTER_COLORS[name.charCodeAt(0) % LETTER_COLORS.length];
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.18)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-text">{value}</p>
    </div>
  );
}

function CompanyCard({
  company,
  onDelete,
  onCrawled,
  onOpen,
  onResearch,
}: {
  company: Company;
  onDelete: (id: number) => void;
  onCrawled: (id: number) => void;
  onOpen: () => void;
  onResearch: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faviconLoaded, setFaviconLoaded] = useState(false);
  const hostname = getHostname(company.website);
  const faviconUrl = getFaviconUrl(company.website);

  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm(`'${company.name}' 회사를 삭제할까요?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCompany(company.id);
      onDelete(company.id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 404 ? '이미 삭제됨' : `삭제 실패 (${status ?? 'network'})`);
      setDeleting(false);
    }
  };

  const handleCrawl = async (event: React.MouseEvent) => {
    event.stopPropagation();
    setCrawling(true);
    setError(null);
    try {
      await crawlCompany(company.id);
      onCrawled(company.id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(`수집 실패 (${status ?? 'network'})`);
    } finally {
      setCrawling(false);
    }
  };

  return (
    <article
      onClick={onOpen}
      className="panel-card cursor-pointer rounded-[28px] p-5 transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-border"
            style={{ backgroundColor: faviconLoaded ? 'var(--color-card)' : getLetterColor(company.name) }}
          >
            {!faviconLoaded && (
              <span className="text-lg font-semibold text-white/85">{company.name.charAt(0).toUpperCase()}</span>
            )}
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt=""
                className={`absolute inset-0 h-full w-full object-contain p-2 ${faviconLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setFaviconLoaded(true)}
                onError={() => {
                  if (hostname) FAILED_FAVICON_HOSTS.add(hostname);
                  setFaviconLoaded(false);
                }}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-xl font-semibold tracking-[-0.02em] text-text">{company.name}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${company.lastCrawledAt ? 'bg-accent/12 text-accent' : 'bg-surface text-muted'}`}>
                {company.lastCrawledAt ? 'Ready' : 'Pending'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{company.companyType || '회사 유형 정보 없음'}</p>
            {company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-2 block truncate text-sm text-text-sub transition-colors hover:text-accent"
              >
                {company.website}
              </a>
            ) : (
              <p className="mt-2 text-sm text-muted">홈페이지 없음</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCrawl}
            disabled={crawling || deleting}
            className="rounded-2xl border border-border px-3 py-2 text-xs font-medium text-text transition-colors hover:bg-hover disabled:opacity-50"
          >
            {crawling ? '수집 중' : '다시 수집'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || crawling}
            className="rounded-2xl border border-border px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-[#ff9090]/40 hover:text-[#ff9090] disabled:opacity-50"
          >
            {deleting ? '삭제 중' : '삭제'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatPill label="상태" value={company.lastCrawledAt ? '분석 가능' : '수집 필요'} />
        <StatPill label="동기화" value={formatCrawledAt(company.lastCrawledAt)} />
        <StatPill label="AI 액션" value="분석 · 비교 · 면접" />
      </div>

      <p className="mt-5 min-h-[48px] text-sm leading-6 text-text-sub">
        {company.description?.trim() || '아직 설명이 없습니다. 수집 후 기업 개요와 리서치 흐름으로 확장할 수 있습니다.'}
      </p>

      {error && <p className="mt-3 text-sm text-[#ff9090]">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onResearch();
          }}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          심층 분석 시작
        </button>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover"
        >
          회사 허브 열기
        </button>
      </div>
    </article>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 9;
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies,
  });

  const filtered = companies
    .filter((company) => company.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(Boolean(b.lastCrawledAt)) - Number(Boolean(a.lastCrawledAt)) || a.name.localeCompare(b.name, 'ko'));

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const crawledCount = companies.filter((company) => company.lastCrawledAt).length;

  const handleDelete = (id: number) => {
    queryClient.setQueryData<Company[]>(['companies'], (prev) =>
      prev ? prev.filter((company) => company.id !== id) : [],
    );
  };

  const handleCrawled = (id: number) => {
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    queryClient.setQueryData<Company[]>(['companies'], (prev) =>
      prev ? prev.map((company) => company.id === id ? { ...company, lastCrawledAt: new Date().toISOString() } : company) : [],
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <section className="panel-card rounded-[32px] px-6 py-7 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Company Library</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-text md:text-5xl">
                저장한 회사를
                <br />
                리서치 허브처럼 관리합니다.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-text-sub">
                수집 상태를 보고, 회사 허브로 들어가고, 바로 심층 분석이나 채팅 작업을 시작할 수 있게 구성합니다.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatPill label="총 회사" value={`${companies.length}개`} />
              <StatPill label="수집 완료" value={`${crawledCount}개`} />
              <StatPill label="추천 액션" value="분석 시작" />
            </div>
          </div>
        </section>

        <section className="glass-card rounded-[28px] px-5 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-text">빠르게 찾기</p>
              <p className="text-sm text-muted">회사명을 검색해 허브를 열거나 바로 분석을 시작하세요.</p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="회사명 검색"
                className="w-full rounded-2xl border border-transparent bg-input py-3 pl-10 pr-4 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-surface-2"
              />
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted">회사 목록을 불러오는 중입니다.</div>
        ) : filtered.length === 0 ? (
          <section className="panel-card rounded-[30px] px-6 py-14 text-center">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Empty State</p>
            <h2 className="mt-3 text-2xl font-semibold text-text">
              {companies.length === 0 ? '아직 저장한 회사가 없습니다.' : '검색 결과가 없습니다.'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-text-sub">
              {companies.length === 0
                ? '채팅에서 회사명을 입력하면 자동으로 수집 흐름을 시작할 수 있습니다.'
                : `'${search}'에 해당하는 회사를 찾지 못했습니다.`}
            </p>
            <button
              onClick={() => navigate('/chat')}
              className="mt-6 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              채팅으로 이동
            </button>
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {visible.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                onDelete={handleDelete}
                onCrawled={handleCrawled}
                onOpen={() => navigate(`/explore/${company.id}`)}
                onResearch={() => navigate(`/research?company=${encodeURIComponent(company.name)}`)}
              />
            ))}
          </section>
        )}

        {hasMore && (
          <button
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="glass-card mx-auto rounded-full px-5 py-3 text-sm font-medium text-text transition-colors hover:bg-hover"
          >
            더 보기
          </button>
        )}
      </div>
    </div>
  );
}
