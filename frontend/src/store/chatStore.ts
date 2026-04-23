import { create } from 'zustand';
import type { ChatMessage, Company, ConversationArtifact, SessionFilter, SessionType } from '../types';
import {
  getConversations,
  getConversationArtifacts,
  createConversationApi,
  updateConversationApi,
  deleteConversationApi,
  addMessageApi,
  type ChatRespondResponse,
  type ServerConversation,
} from '../api';

export interface Conversation {
  id: number;
  title: string;
  messages: ChatMessage[];
  sessionType: SessionType;
  selectedCompanyId: number | null;
  mode: string;
  modeState?: string;
  createdAt: string;
  updatedAt: string;
}

function fromServer(sc: ServerConversation): Conversation {
  return {
    id: sc.id,
    title: sc.title,
    sessionType: sc.sessionType ?? 'general',
    selectedCompanyId: sc.selectedCompanyId,
    mode: sc.mode ?? 'idle',
    modeState: sc.modeState ?? undefined,
    createdAt: sc.createdAt,
    updatedAt: sc.updatedAt,
    messages: sc.messages.map((m) => ({
      id: m.id,
      role: m.role as ChatMessage['role'],
      content: m.content,
      meta: m.meta ?? undefined,
      createdAt: m.createdAt,
    })),
  };
}

interface ChatState {
  conversations: Conversation[];
  activeId: number | null;
  sessionFilter: SessionFilter;
  artifactsByConversation: Record<number, ConversationArtifact[]>;
  companies: Company[];
  topK: number;

  activeConversation: () => Conversation | undefined;
  activeMessages: () => ChatMessage[];
  activeCompanyId: () => number | null;
  activeArtifacts: () => ConversationArtifact[];

  // 서버에서 대화 목록 로드
  loadConversations: () => Promise<void>;
  loadArtifacts: (conversationId: number) => Promise<void>;

  // 새 대화 생성 (서버 저장)
  createConversation: (sessionType?: SessionType) => Promise<number>;

  setActiveId: (id: number | null) => void;
  setSessionFilter: (filter: SessionFilter) => void;

  // 대화 삭제 (서버 + 로컬)
  deleteConversation: (id: number) => Promise<void>;

  // 대화 제목 수정 (서버 + 로컬)
  renameConversation: (id: number, title: string) => Promise<void>;

  // 메시지 추가 (서버 저장 후 로컬 반영)
  addMessage: (msg: { role: 'user' | 'assistant' | 'system'; content: string; meta?: string }) => Promise<void>;

  // 선택 회사 업데이트
  setSelectedCompanyId: (id: number | null) => void;
  syncConversationState: (data: {
    selectedCompanyId?: number | null;
    mode?: string;
    modeState?: string | null;
  }) => Promise<void>;
  applyRespondResult: (result: ChatRespondResponse) => void;

  setCompanies: (list: Company[]) => void;
  setTopK: (k: number) => void;
  clearConversations: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  activeId: null,
  sessionFilter: 'all',
  artifactsByConversation: {},
  companies: [],
  topK: 10,

  activeConversation: () => {
    const { conversations, activeId } = get();
    return conversations.find((c) => c.id === activeId);
  },

  activeMessages: () => get().activeConversation()?.messages ?? [],

  activeCompanyId: () => get().activeConversation()?.selectedCompanyId ?? null,

  activeArtifacts: () => {
    const { artifactsByConversation, activeId } = get();
    if (activeId == null) return [];
    return artifactsByConversation[activeId] ?? [];
  },

  loadConversations: async () => {
    try {
      const list = await getConversations();
      const conversations = list.map(fromServer);
      const activeId = conversations.length > 0 ? conversations[0].id : null;
      set({ conversations, activeId });
    } catch {
      // 인증 실패 등 — 무시
    }
  },

  loadArtifacts: async (conversationId) => {
    const artifacts = await getConversationArtifacts(conversationId);
    set((s) => ({
      artifactsByConversation: {
        ...s.artifactsByConversation,
        [conversationId]: artifacts,
      },
    }));
  },

  createConversation: async (sessionType = 'general') => {
    const sc = await createConversationApi('새 대화', sessionType);
    const conv = fromServer(sc);
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeId: conv.id,
      artifactsByConversation: {
        ...s.artifactsByConversation,
        [conv.id]: [],
      },
    }));
    return conv.id;
  },

  setActiveId: (id) => set({ activeId: id }),

  setSessionFilter: (sessionFilter) => set({ sessionFilter }),

  deleteConversation: async (id) => {
    const { conversations } = get();
    await deleteConversationApi(id);
    const remaining = conversations.filter((c) => c.id !== id);
    const activeId = get().activeId === id ? (remaining[0]?.id ?? null) : get().activeId;
    set((s) => {
      const nextArtifacts = { ...s.artifactsByConversation };
      delete nextArtifacts[id];
      return { conversations: remaining, activeId, artifactsByConversation: nextArtifacts };
    });
  },

  renameConversation: async (id, title) => {
    await updateConversationApi(id, { title });
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  },

  addMessage: async (msg) => {
    const { activeId } = get();
    if (activeId == null) return;

    const saved = await addMessageApi(activeId, msg.role, msg.content, msg.meta);

    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== activeId) return c;
        const newMsg: ChatMessage = {
          id: saved.id,
          role: saved.role as ChatMessage['role'],
          content: saved.content,
          meta: saved.meta ?? undefined,
          createdAt: saved.createdAt,
        };
        // 첫 user 메시지로 로컬 제목 업데이트
        const title =
          c.title === '새 대화' && msg.role === 'user'
            ? msg.content.slice(0, 30) + (msg.content.length > 30 ? '…' : '')
            : c.title;
        return { ...c, title, messages: [...c.messages, newMsg] };
      }),
    }));

    // selectedCompanyId 동기화는 setSelectedCompanyId에서 처리하므로 여기서는 생략
    // (addMessage 백엔드 save와 동시 PATCH 시 409 Conflict 방지)
  },

  setSelectedCompanyId: (id) => {
    const { activeId } = get();
    if (activeId == null) return;
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === activeId ? { ...c, selectedCompanyId: id } : c
      ),
    }));
    // 서버 동기화 (백그라운드)
    if (id !== null) {
      updateConversationApi(activeId, { selectedCompanyId: id }).catch(() => {});
    }
  },

  syncConversationState: async (data) => {
    const { activeId } = get();
    if (activeId == null) return;

    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === activeId
          ? {
              ...c,
              selectedCompanyId: data.selectedCompanyId !== undefined ? data.selectedCompanyId : c.selectedCompanyId,
              mode: data.mode ?? c.mode,
              modeState: data.modeState !== undefined ? (data.modeState ?? undefined) : c.modeState,
            }
          : c
      ),
    }));

    await updateConversationApi(activeId, data).catch(() => {});
  },

  applyRespondResult: (result) => {
    set((s) => ({
      activeId: result.conversationId,
      artifactsByConversation: result.artifact
        ? {
            ...s.artifactsByConversation,
            [result.conversationId]: [
              result.artifact,
              ...(s.artifactsByConversation[result.conversationId] ?? []).filter(
                (artifact) => artifact.id !== result.artifact?.id
              ),
            ],
          }
        : s.artifactsByConversation,
      conversations: s.conversations.map((c) => {
        if (c.id !== result.conversationId) return c;

        const existingIds = new Set(c.messages.map((m) => m.id));
        const nextMessages = [...c.messages];
        if (result.userMessage && !existingIds.has(result.userMessage.id)) {
          nextMessages.push({
            id: result.userMessage.id,
            role: result.userMessage.role as ChatMessage['role'],
            content: result.userMessage.content,
            meta: result.userMessage.meta ?? undefined,
            createdAt: new Date().toISOString(),
          });
        }
        if (result.assistantMessage && !existingIds.has(result.assistantMessage.id)) {
          nextMessages.push({
            id: result.assistantMessage.id,
            role: result.assistantMessage.role as ChatMessage['role'],
            content: result.assistantMessage.content,
            meta: result.assistantMessage.meta ?? undefined,
            createdAt: new Date().toISOString(),
          });
        }

        return {
          ...c,
          title: result.title,
          sessionType: result.sessionType ?? c.sessionType,
          selectedCompanyId: result.selectedCompanyId,
          mode: result.mode ?? c.mode,
          modeState: result.modeState ?? undefined,
          messages: nextMessages,
        };
      }),
    }));
  },

  setCompanies: (companies) => set({ companies }),

  setTopK: (topK) => set({ topK }),

  clearConversations: () => set({ conversations: [], activeId: null, artifactsByConversation: {}, companies: [] }),
}));
