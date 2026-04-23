import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../types';
import {
  formatCrawledAt,
  md,
  parseMeta,
  SourceChips,
  TYPE_CONFIG,
} from './chatShared';

export function ChatBubble({
  messageId,
  role,
  content,
  meta,
  highlighted = false,
}: {
  messageId: number;
  role: ChatMessage['role'];
  content: string;
  meta?: string;
  highlighted?: boolean;
}) {
  const { label, msgMeta } = parseMeta(meta);
  const isRich = role === 'assistant' && msgMeta && msgMeta.type !== 'qa';
  const typeConf = msgMeta ? TYPE_CONFIG[msgMeta.type] : null;

  return (
    <div
      id={`message-${messageId}`}
      className={`mx-auto flex w-full max-w-5xl items-start gap-4 px-6 py-3 animate-fadeIn ${role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`min-w-0 flex-1 transition-all ${role === 'user' ? 'flex flex-col items-end' : ''} ${highlighted ? 'rounded-[24px] bg-hover px-3 py-2 ring-1 ring-accent/60' : ''}`}
      >
        {role === 'user' && (
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[22px_8px_22px_22px] bg-accent px-4 py-[11px] text-sm leading-[1.7] text-white shadow-[0_14px_34px_rgba(16,163,127,0.24)]">
            {content}
          </div>
        )}

        {role === 'system' && (
          <p className="whitespace-pre-wrap break-words text-[0.87rem] leading-[1.65] text-muted">
            {content}
          </p>
        )}

        {role === 'assistant' && isRich && typeConf && (
          <div className="glass-card overflow-hidden rounded-[26px]">
            <div className="flex items-center gap-2 border-b border-border bg-[rgba(255,255,255,0.16)] px-4 py-3">
              <span className="flex-1 truncate text-[12px] font-semibold text-text-sub">{label}</span>
              {typeConf.badge && (
                <span className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                  {typeConf.badge}
                </span>
              )}
            </div>
            <div className="px-5 py-5 text-text">
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

        {role === 'assistant' && !isRich && (
          <>
            {label && (
              <p className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
                <span>{label}</span>
                {msgMeta?.lastCrawledAt !== undefined && (
                  <>
                    <span className="text-muted">·</span>
                    <span className={msgMeta.lastCrawledAt ? 'text-muted' : 'text-[#ff9090]'}>
                      {formatCrawledAt(msgMeta.lastCrawledAt)}
                    </span>
                  </>
                )}
              </p>
            )}
            <div className="glass-card rounded-[26px] px-5 py-4 text-[0.94rem] text-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                {content}
              </ReactMarkdown>
              {msgMeta?.sources && msgMeta.sources.length > 0 && <SourceChips sources={msgMeta.sources} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
