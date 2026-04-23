import { useEffect } from 'react';
import ChatPage from './ChatPage';
import { useChatStore } from '../store/chatStore';
import type { SessionType } from '../types';

export default function WorkspacePage({ sessionType }: { sessionType: SessionType }) {
  const activeConversation = useChatStore((s) =>
    s.activeId == null ? undefined : s.conversations.find((conversation) => conversation.id === s.activeId)
  );
  const setActiveId = useChatStore((s) => s.setActiveId);
  const setSessionFilter = useChatStore((s) => s.setSessionFilter);

  useEffect(() => {
    setSessionFilter(sessionType);
    if (activeConversation && activeConversation.sessionType !== sessionType) {
      setActiveId(null);
    }
  }, [activeConversation, sessionType, setActiveId, setSessionFilter]);

  return <ChatPage />;
}
