import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ConversationArtifact } from '../../types';
import {
  ARTIFACT_BADGE,
  formatArtifactUpdatedAt,
  md,
  parseMeta,
  SourceChips,
} from './chatShared';

export function ArtifactReader({
  artifact,
  onClose,
  onOpenOriginal,
  onContinue,
  onDuplicate,
}: {
  artifact: ConversationArtifact;
  onClose: () => void;
  onOpenOriginal: () => void;
  onContinue: () => void;
  onDuplicate: () => void;
}) {
  const { label, msgMeta } = parseMeta(artifact.meta);
  const typeLabel = ARTIFACT_BADGE[artifact.artifactType];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="아티팩트 리더 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(10,14,16,0.36)] backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-3xl flex-col border-l border-border bg-[rgba(252,248,241,0.92)] shadow-[0_20px_60px_rgba(18,22,24,0.22)] backdrop-blur-2xl dark:bg-[rgba(18,24,27,0.92)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted">
                {typeLabel}
              </span>
              <span className="text-[11px] text-muted">v{artifact.version}</span>
              <span className="text-[11px] text-muted">{formatArtifactUpdatedAt(artifact.updatedAt)}</span>
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-text">
              {artifact.title || label || '저장된 결과'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-text-sub">
              저장된 결과를 문서처럼 읽고, 같은 결과를 바탕으로 다음 작업을 이어갈 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-text transition-colors hover:bg-hover"
          >
            닫기
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-6 py-4">
          <button
            type="button"
            onClick={onOpenOriginal}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover"
          >
            원본 응답 위치
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            현재 세션에서 이어서 작업
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-hover"
          >
            새 세션으로 복사
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="glass-card rounded-[30px] px-6 py-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
              {artifact.content}
            </ReactMarkdown>
            {msgMeta?.sources && msgMeta.sources.length > 0 && <SourceChips sources={msgMeta.sources} />}
          </div>
        </div>
      </aside>
    </div>
  );
}
