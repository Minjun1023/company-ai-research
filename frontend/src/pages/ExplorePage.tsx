import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanies, deleteCompany } from '../api';
import type { Company } from '../types';

const FAILED_FAVICON_HOSTS = new Set<string>();

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

const LETTER_COLORS = ['#1e3a5f', '#2d1f4a', '#1a3a2a', '#3a2510', '#2a1f3a', '#1f3a38'];

function getLetterColor(name: string): string {
  return LETTER_COLORS[name.charCodeAt(0) % LETTER_COLORS.length];
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polyline points="2,3 12,3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 3V2h4v1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M3 3l1 9h6l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);

// ── Company Card ──────────────────────────────────────────────────────────────

function CompanyCard({
  company,
  onDelete,
  onClick,
}: {
  company: Company;
  onDelete: (id: number) => void;
  onClick: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faviconLoaded, setFaviconLoaded] = useState(false);
  const hostname = getHostname(company.website);
  const faviconUrl = getFaviconUrl(company.website);
  const letter = company.name.charAt(0).toUpperCase();
  const letterBg = getLetterColor(company.name);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`'${company.name}' 회사를 삭제할까요?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCompany(company.id);
      onDelete(company.id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) setError('인증 필요');
      else if (status === 404) setError('이미 삭제됨');
      else setError(`삭제 실패 (${status ?? 'network'})`);
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[12px] px-5 py-4 flex flex-col gap-3 cursor-pointer hover:border-accent transition-colors"
    >
      {/* Top row: 로고 + 이름 + 삭제 */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg border border-[var(--color-border)] flex items-center justify-center overflow-hidden relative"
          style={{ backgroundColor: faviconLoaded ? 'var(--color-surface)' : letterBg }}
        >
          {/* 레터 아바타: favicon 로드 전/실패 시 표시 */}
          {!faviconLoaded && (
            <span className="text-sm font-bold text-white/80 select-none">{letter}</span>
          )}
          {/* favicon: 로드 성공 시만 보임 */}
          {faviconUrl && (
            <img
              src={faviconUrl}
              alt=""
              className={`absolute inset-0 w-full h-full object-contain p-1 ${faviconLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setFaviconLoaded(true)}
              onError={() => {
                if (hostname) FAILED_FAVICON_HOSTS.add(hostname);
                setFaviconLoaded(false);
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[var(--color-text)] font-bold text-[1rem] truncate">{company.name}</h3>
          </div>
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted hover:text-accent transition-colors truncate block mt-0.5"
            >
              {company.website}
            </a>
          ) : (
            <span className="text-xs text-[var(--color-muted)]">홈페이지 없음</span>
          )}
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-shrink-0 text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] text-muted hover:border-[#ff9090] hover:text-[#ff9090] transition-colors disabled:opacity-40"
          title="회사 삭제"
        >
          {deleting ? '...' : <TrashIcon />}
        </button>
      </div>

      {company.description && (
        <p className="text-muted text-xs leading-relaxed line-clamp-2">{company.description}</p>
      )}

      {error && <p className="text-[#ff9090] text-xs">{error}</p>}

    </div>
  );
}

// ── ExplorePage ───────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const PAGE_SIZE = 10;
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies,
  });

  const filtered = companies
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  };

  const handleDelete = (id: number) => {
    qc.setQueryData<Company[]>(['companies'], (prev) =>
      prev ? prev.filter((c) => c.id !== id) : [],
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg py-7 px-7">
      <div className="max-w-[760px] mx-auto flex flex-col gap-4">

        {/* Header */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[14px] p-5">
          <button
            onClick={() => navigate('/chat')}
            className="inline-block px-[18px] py-2 mb-4 rounded-lg border border-[var(--color-border)] bg-surface text-muted text-sm font-semibold hover:bg-surface-2 transition-colors"
          >
            ← 챗봇으로 돌아가기
          </button>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-text text-xl font-bold mb-1">관심 기업</h1>
              <p className="text-muted text-sm">관심 있는 회사를 추가하고 AI로 궁금한 것을 바로 물어보세요.</p>
            </div>
            {companies.length > 0 && (
              <span className="text-muted text-sm flex-shrink-0">총 {companies.length}개</span>
            )}
          </div>
        </div>

        {/* Search filter */}
        {companies.length > 0 && (
          <div className="flex items-center bg-[var(--color-card)] border border-[var(--color-border)] focus-within:border-accent rounded-[14px] px-4 transition-colors">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted flex-shrink-0">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="회사명으로 필터링"
              className="flex-1 bg-transparent px-3 py-[11px] text-[0.93rem] text-text outline-none placeholder:text-muted"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="text-muted hover:text-text text-lg leading-none"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Company grid */}
        {isLoading ? (
          <div className="py-16 text-center">
            <p className="text-muted text-sm animate-pulse">불러오는 중...</p>
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[14px] py-16 text-center">
            <p className="text-4xl mb-3">🏢</p>
            <p className="text-muted text-sm">아직 수집된 회사가 없습니다.</p>
            <p className="text-muted text-xs mt-1">
              챗봇에서 "카카오 정보 수집해줘"라고 말해보세요.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm text-center py-8">
            <span className="text-[#ff9090]">'{search}'</span>에 해당하는 회사가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visible.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  onDelete={handleDelete}
                  onClick={() => navigate('/chat', { state: { greetCompany: company.name } })}
                />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="w-full py-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] text-muted text-sm hover:text-text hover:border-accent transition-colors"
              >
                더 보기 ({filtered.length - visibleCount}개 남음)
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
