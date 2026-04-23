import type { Company } from '../../types';
import {
  formatCrawledAt,
  getCompanyLetterColor,
  getHostname,
} from './chatShared';

export function CompanyContextPanel({
  company,
  fallbackName,
  refreshing,
  onRefresh,
  onOpenHub,
}: {
  company?: Company;
  fallbackName?: string;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenHub: () => void;
}) {
  const name = company?.name ?? fallbackName;
  if (!name) return null;

  const hostname = getHostname(company?.website ?? null);

  return (
    <div className="flex-shrink-0 px-5 pb-3 md:px-8">
      <div className="glass-card mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-[28px] px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] border border-border text-lg font-semibold text-white"
            style={{ backgroundColor: getCompanyLetterColor(name) }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-text">{name}</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${company ? 'bg-accent/12 text-accent' : 'bg-surface text-muted'}`}>
                {company ? '선택된 회사' : '회사 컨텍스트 감지'}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-text-sub">
              {company
                ? company.description?.trim() || '현재 대화는 이 회사를 기준으로 진행됩니다.'
                : '현재 대화 흐름에서 이 회사가 기준으로 감지됐습니다. 회사가 확정되면 상세 정보가 함께 표시됩니다.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              {company?.lastCrawledAt ? <span>{formatCrawledAt(company.lastCrawledAt)}</span> : <span>수집 상태 확인 전</span>}
              {hostname && (
                <>
                  <span>·</span>
                  <span>{hostname}</span>
                </>
              )}
              {company?.companyType && (
                <>
                  <span>·</span>
                  <span>{company.companyType}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onOpenHub}
            disabled={!company}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            회사 허브
          </button>
          <button
            onClick={onRefresh}
            disabled={!company || refreshing}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '최신화 중' : '정보 최신화'}
          </button>
        </div>
      </div>
    </div>
  );
}
