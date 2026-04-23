import type { SessionType } from '../../types';

export function ProfileReadinessBanner({
  workspaceType,
  missingItems,
  profileScore,
  onOpenProfile,
}: {
  workspaceType: SessionType;
  missingItems: string[];
  profileScore: number;
  onOpenProfile: () => void;
}) {
  if (!['interview', 'coverletter', 'salary'].includes(workspaceType) || missingItems.length === 0) {
    return null;
  }

  const workspaceLabel = (() => {
    switch (workspaceType) {
      case 'interview':
        return '면접 준비';
      case 'coverletter':
        return '자기소개서';
      case 'salary':
        return '연봉 협상';
      default:
        return '워크스페이스';
    }
  })();

  return (
    <div className="flex-shrink-0 px-5 pb-3 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-[28px] border border-[rgba(16,163,127,0.2)] bg-[rgba(16,163,127,0.08)] px-5 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Profile Readiness</p>
            <h3 className="mt-2 text-lg font-semibold text-text">
              {workspaceLabel}에 필요한 프로필 정보가 아직 부족합니다
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-sub">
              경력, 희망 직무, 기술 스택, 이력서가 채워질수록 답변 정확도와 초안 품질이 좋아집니다.
            </p>
          </div>
          <div className="rounded-[20px] border border-[rgba(16,163,127,0.18)] bg-[rgba(255,255,255,0.22)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">완성도</p>
            <p className="mt-1 text-lg font-semibold text-text">{profileScore}%</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {missingItems.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[rgba(16,163,127,0.18)] bg-[rgba(255,255,255,0.26)] px-3 py-1.5 text-[11px] font-medium text-text"
            >
              보완 필요: {item}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            프로필 편집
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover"
          >
            이력서 업로드
          </button>
        </div>
      </div>
    </div>
  );
}
