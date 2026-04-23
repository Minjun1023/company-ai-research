import type { ChatMessage } from '../types';

export type TagColor = 'blue' | 'green' | 'purple' | 'amber';

export interface ConversationTag {
  label: string;
  color: TagColor;
}

const TYPE_META: Record<string, { label: string; color: TagColor }> = {
  research:           { label: '심층 분석',   color: 'blue' },
  compare:            { label: '비교 분석',   color: 'purple' },
  interview:          { label: '면접 준비',   color: 'blue' },
  interview_practice: { label: '모의 면접',   color: 'blue' },
  resume:             { label: '면접 질문',   color: 'blue' },
  coverletter:        { label: '자기소개서',  color: 'green' },
  feedback:           { label: '자소서 피드백', color: 'green' },
  salary:             { label: '연봉',        color: 'amber' },
  news_search:        { label: '뉴스',        color: 'green' },
};

export function extractConversationTags(messages: ChatMessage[]): ConversationTag[] {
  const seen = new Map<string, ConversationTag>();

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.meta) continue;
    try {
      const meta = JSON.parse(msg.meta) as { type?: string };
      if (meta.type && meta.type !== 'qa') {
        const m = TYPE_META[meta.type];
        if (m && !seen.has(m.label)) seen.set(m.label, m);
      }
    } catch {
      // meta 파싱 실패 시 무시
    }
  }

  return [...seen.values()].slice(0, 2);
}
