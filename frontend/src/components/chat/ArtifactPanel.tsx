import type { ConversationArtifact } from '../../types';
import {
  ARTIFACT_BADGE,
  formatArtifactUpdatedAt,
  previewArtifactContent,
} from './chatShared';

export function ArtifactPanel({
  artifacts,
  onOpenArtifact,
  onContinueArtifact,
}: {
  artifacts: ConversationArtifact[];
  onOpenArtifact: (artifact: ConversationArtifact) => void;
  onContinueArtifact: (artifact: ConversationArtifact) => void;
}) {
  if (artifacts.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-2 pt-2">
      <div className="glass-card rounded-[28px] p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text">저장된 결과</p>
            <p className="text-xs text-muted">이번 세션에서 만든 분석 리포트와 작업 결과를 다시 열 수 있습니다.</p>
          </div>
          <span className="text-xs text-muted">{artifacts.length}개</span>
        </div>
        <div className="grid gap-2.5 md:grid-cols-2">
          {artifacts.map((artifact) => (
            <article
              key={artifact.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenArtifact(artifact)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenArtifact(artifact);
                }
              }}
              className="cursor-pointer rounded-[22px] border border-border bg-[rgba(255,255,255,0.16)] px-4 py-3.5 text-left transition-colors hover:bg-hover"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                  {ARTIFACT_BADGE[artifact.artifactType]}
                </span>
                <span className="text-[10px] text-muted">v{artifact.version}</span>
                <span className="ml-auto text-[10px] text-muted">{formatArtifactUpdatedAt(artifact.updatedAt)}</span>
              </div>
              <p className="text-sm font-medium leading-snug text-text">{artifact.title}</p>
              <p className="mt-1.5 text-xs leading-5 text-muted">{previewArtifactContent(artifact.content)}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-muted">원본 응답 보기</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onContinueArtifact(artifact);
                  }}
                  className="ml-auto rounded-full border border-border px-2.5 py-1 text-[11px] text-text-sub hover:bg-hover"
                >
                  이어서 작업
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
