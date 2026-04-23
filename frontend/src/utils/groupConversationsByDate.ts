import type { Conversation } from '../store/chatStore';

export type DateGroup = '고정됨' | '오늘' | '어제' | '지난 7일' | '이번 달' | '더 이전';

export interface ConversationGroup {
  label: DateGroup;
  items: Conversation[];
}

export function groupConversationsByDate(
  conversations: Conversation[],
  pinnedIds: number[]
): ConversationGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOf7DaysAgo = new Date(startOfToday.getTime() - 6 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const pinned: Conversation[] = [];
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const last7: Conversation[] = [];
  const thisMonth: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of conversations) {
    if (pinnedIds.includes(conv.id)) {
      pinned.push(conv);
      continue;
    }
    const d = new Date(conv.updatedAt);
    if (d >= startOfToday) {
      today.push(conv);
    } else if (d >= startOfYesterday) {
      yesterday.push(conv);
    } else if (d >= startOf7DaysAgo) {
      last7.push(conv);
    } else if (d >= startOfMonth) {
      thisMonth.push(conv);
    } else {
      older.push(conv);
    }
  }

  const groups: ConversationGroup[] = [];
  if (pinned.length)    groups.push({ label: '고정됨',   items: pinned });
  if (today.length)     groups.push({ label: '오늘',     items: today });
  if (yesterday.length) groups.push({ label: '어제',     items: yesterday });
  if (last7.length)     groups.push({ label: '지난 7일', items: last7 });
  if (thisMonth.length) groups.push({ label: '이번 달',  items: thisMonth });
  if (older.length)     groups.push({ label: '더 이전',  items: older });

  return groups;
}
