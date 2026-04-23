import type { ModeState } from './chatShared';
import { trim } from './chatShared';

export function WorkflowActionPanel({
  mode,
  modeState,
  actionInput,
  setActionInput,
  loading,
  onSend,
}: {
  mode: string;
  modeState: ModeState;
  actionInput: string;
  setActionInput: (value: string) => void;
  loading: boolean;
  onSend: (value: string) => Promise<void>;
}) {
  if (mode === 'company_selection') {
    const candidates = modeState.candidates ?? [];
    const targetCompany = modeState.targetCompanyName || '회사';

    return (
      <div className="glass-card mb-3 rounded-[28px] px-5 py-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Action Required</p>
            <h3 className="mt-2 text-lg font-semibold text-text">어떤 회사를 의미하는지 선택해 주세요</h3>
            <p className="mt-2 text-sm leading-6 text-text-sub">
              `{targetCompany}`에 대한 후보를 찾았습니다. 선택하면 기존 요청을 이어서 처리합니다.
            </p>
          </div>

          {candidates.length === 1 ? (
            <div className="rounded-[22px] border border-border bg-[rgba(255,255,255,0.14)] px-4 py-4">
              <p className="text-base font-medium text-text">{candidates[0].name}</p>
              {candidates[0].description && (
                <p className="mt-2 text-sm leading-6 text-text-sub">{candidates[0].description}</p>
              )}
              {candidates[0].website && (
                <a
                  href={candidates[0].website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block truncate text-sm text-text-sub hover:text-accent"
                >
                  {candidates[0].website}
                </a>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void onSend('예')}
                  disabled={loading}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  맞아요
                </button>
                <button
                  onClick={() => void onSend('아니오')}
                  disabled={loading}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover disabled:opacity-50"
                >
                  아니에요
                </button>
                <button
                  onClick={() => void onSend('URL 직접 입력')}
                  disabled={loading}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover disabled:opacity-50"
                >
                  홈페이지 직접 입력
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.name}
                  onClick={() => void onSend(candidate.name)}
                  disabled={loading}
                  className="rounded-[22px] border border-border bg-[rgba(255,255,255,0.14)] px-4 py-4 text-left transition-colors hover:bg-hover disabled:opacity-50"
                >
                  <p className="text-base font-medium text-text">{candidate.name}</p>
                  {candidate.description && (
                    <p className="mt-2 text-sm leading-6 text-text-sub">{candidate.description}</p>
                  )}
                  {candidate.website && (
                    <p className="mt-2 truncate text-sm text-muted">{candidate.website}</p>
                  )}
                  <span className="mt-4 inline-flex rounded-full border border-border px-3 py-1 text-[11px] font-medium text-text-sub">
                    이 회사로 진행
                  </span>
                </button>
              ))}
              <button
                onClick={() => void onSend('URL 직접 입력')}
                disabled={loading}
                className="rounded-[22px] border border-dashed border-border bg-[rgba(255,255,255,0.12)] px-4 py-4 text-left transition-colors hover:bg-hover disabled:opacity-50"
              >
                <p className="text-base font-medium text-text">목록에 없습니다</p>
                <p className="mt-2 text-sm leading-6 text-text-sub">공식 홈페이지 URL을 직접 입력해서 회사를 등록합니다.</p>
                <span className="mt-4 inline-flex rounded-full border border-border px-3 py-1 text-[11px] font-medium text-text-sub">
                  URL 직접 입력으로 전환
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'company_url_input') {
    const targetCompany = modeState.targetCompanyName || '회사';

    return (
      <div className="glass-card mb-3 rounded-[28px] px-5 py-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Action Required</p>
            <h3 className="mt-2 text-lg font-semibold text-text">공식 홈페이지 URL이 필요합니다</h3>
            <p className="mt-2 text-sm leading-6 text-text-sub">
              `{targetCompany}` 정보를 찾지 못했습니다. 공식 홈페이지 주소를 입력하면 수집 후 기존 요청을 이어서 처리합니다.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="url"
              value={actionInput}
              onChange={(event) => setActionInput(event.target.value)}
              placeholder="https://company.com"
              disabled={loading}
              className="w-full rounded-[22px] border border-transparent bg-input px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-surface-2 disabled:opacity-50"
            />
            <button
              onClick={() => void onSend(actionInput)}
              disabled={loading || !trim(actionInput)}
              className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              URL 제출
            </button>
          </div>
          <p className="text-xs text-muted">`http://` 또는 `https://` 형식으로 입력해야 합니다.</p>
        </div>
      </div>
    );
  }

  if (mode === 'coverletter_feedback' && modeState.phase === 'awaiting_job_url') {
    return (
      <div className="glass-card mb-3 rounded-[28px] px-5 py-5">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Action Required</p>
            <h3 className="mt-2 text-lg font-semibold text-text">채용공고 URL을 추가할 수 있습니다</h3>
            <p className="mt-2 text-sm leading-6 text-text-sub">
              URL이 있으면 자소서 피드백을 더 구체적으로 맞출 수 있습니다. 없으면 건너뛰고 바로 분석을 진행합니다.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="url"
              value={actionInput}
              onChange={(event) => setActionInput(event.target.value)}
              placeholder="채용공고 URL 입력"
              disabled={loading}
              className="w-full rounded-[22px] border border-transparent bg-input px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-surface-2 disabled:opacity-50"
            />
            <button
              onClick={() => void onSend(actionInput)}
              disabled={loading || !trim(actionInput)}
              className="rounded-full border border-border px-5 py-3 text-sm font-medium text-text transition-colors hover:bg-hover disabled:opacity-50"
            >
              URL 제출
            </button>
            <button
              onClick={() => void onSend('건너뛰기')}
              disabled={loading}
              className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              건너뛰고 진행
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
