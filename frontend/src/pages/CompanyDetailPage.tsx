import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCompany } from '../api';

const FAILED_FAVICON_HOSTS = new Set<string>();

function getHostname(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website).hostname;
  } catch {
    return null;
  }
}

function getLogoUrl(website: string | null): string | null {
  const hostname = getHostname(website);
  if (!hostname || FAILED_FAVICON_HOSTS.has(hostname)) return null;
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
}

function formatCrawledAt(dateStr: string | null): string {
  if (!dateStr) return '아직 수집 전';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMin < 1) return '방금 동기화됨';
  if (diffMin < 60) return `${diffMin}분 전 동기화`;
  if (diffHour < 24) return `${diffHour}시간 전 동기화`;
  if (diffDay < 7) return `${diffDay}일 전 동기화`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}주 전 동기화`;
  return `${Math.floor(diffDay / 30)}개월 전 동기화`;
}

function ActionCard({
  title,
  description,
  actionLabel,
  onClick,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <article className="glass-card rounded-[26px] p-5">
      <p className="text-lg font-semibold text-text">{title}</p>
      <p className="mt-3 min-h-[72px] text-sm leading-7 text-text-sub">{description}</p>
      <button
        onClick={onClick}
        className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover"
      >
        {actionLabel}
      </button>
    </article>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const companyId = Number(id);
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId),
    enabled: !Number.isNaN(companyId),
  });

  const logoUrl = getLogoUrl(company?.website ?? null);
  const hostname = getHostname(company?.website ?? null);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">회사 허브를 불러오는 중입니다.</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-text">회사를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/explore')}
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm text-text transition-colors hover:bg-hover"
          >
            회사 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <button
          onClick={() => navigate('/explore')}
          className="self-start rounded-full border border-border px-4 py-2 text-sm text-text transition-colors hover:bg-hover"
        >
          회사 라이브러리로 돌아가기
        </button>

        <section className="panel-card rounded-[34px] px-6 py-7 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-5">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-border bg-[rgba(255,255,255,0.2)]">
                {logoUrl && !logoError ? (
                  <img
                    src={logoUrl}
                    alt={company.name}
                    className="h-full w-full object-contain p-3"
                    onError={() => {
                      if (hostname) FAILED_FAVICON_HOSTS.add(hostname);
                      setLogoError(true);
                    }}
                  />
                ) : (
                  <span className="text-3xl">🏢</span>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Company Hub</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-text md:text-5xl">{company.name}</h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${company.lastCrawledAt ? 'bg-accent/12 text-accent' : 'bg-surface text-muted'}`}>
                    {company.lastCrawledAt ? '분석 준비 완료' : '수집 필요'}
                  </span>
                  <span className="rounded-full bg-surface px-3 py-1.5 text-xs text-muted">
                    {company.companyType || '유형 미정'}
                  </span>
                </div>
                <p className="mt-4 max-w-2xl text-base leading-8 text-text-sub">
                  {company.description?.trim() || '회사 소개가 아직 비어 있습니다. 분석과 리서치 세션을 통해 더 풍부한 컨텍스트를 쌓을 수 있습니다.'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[340px]">
              <div className="glass-card rounded-[24px] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">동기화 상태</p>
                <p className="mt-2 text-lg font-semibold text-text">{formatCrawledAt(company.lastCrawledAt)}</p>
              </div>
              <div className="glass-card rounded-[24px] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">웹사이트</p>
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block truncate text-sm text-text transition-colors hover:text-accent"
                  >
                    {company.website}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-muted">등록된 URL 없음</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ActionCard
            title="심층 분석 리포트"
            description="기업 개요, 조직 문화, 채용 정보, 연봉과 근속까지 구조화된 리포트로 정리합니다."
            actionLabel="분석 워크스페이스 열기"
            onClick={() => navigate(`/research?company=${encodeURIComponent(company.name)}`)}
          />
          <ActionCard
            title="통합 Q&A"
            description="복지, 기술 스택, 채용 분위기처럼 특정 질문을 중심으로 바로 묻고 답을 확인합니다."
            actionLabel="통합 채팅 열기"
            onClick={() => navigate('/chat', { state: { greetCompany: company.name } })}
          />
          <ActionCard
            title="면접 준비"
            description="회사 정보와 내 이력서를 바탕으로 예상 질문, 답변 포인트, 후속 상담까지 이어집니다."
            actionLabel="면접 세션 시작"
            onClick={() => navigate('/interview', { state: { greetCompany: company.name } })}
          />
          <ActionCard
            title="자기소개서 · 연봉"
            description="회사 맥락에 맞는 자소서 초안과 피드백, 연봉 상담 흐름으로 바로 연결합니다."
            actionLabel="자소서 작업 시작"
            onClick={() => navigate('/coverletter', { state: { greetCompany: company.name } })}
          />
        </section>
      </div>
    </div>
  );
}
