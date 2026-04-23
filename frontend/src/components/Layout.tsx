import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useChatStore } from '../store/chatStore';
import { useThemeStore } from '../store/themeStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { pathForSessionFilter } from '../utils/workspaceRouting';

const SidebarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="6" y1="1.75" x2="6" y2="16.25" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export default function Layout() {
  const loadConversations = useChatStore((s) => s.loadConversations);
  const createConversation = useChatStore((s) => s.createConversation);
  const sessionFilter = useChatStore((s) => s.sessionFilter);
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useThemeStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 모바일 진입 시 사이드바 자동 닫기
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile, setSidebarOpen]);

  // 모바일에서 사이드바가 열리면 본문 스크롤 잠금
  useEffect(() => {
    if (!(isMobile && sidebarOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobile, sidebarOpen]);

  const handleNewChat = async () => {
    const nextSessionType = sessionFilter === 'all' ? 'general' : sessionFilter;
    await createConversation(nextSessionType);
    navigate(pathForSessionFilter(sessionFilter));
  };

  return (
    <div className="flex h-full overflow-hidden relative bg-bg">
      {/* 모바일 백드롭: 사이드바 열릴 때 뒤 영역 클릭 시 닫기 */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(16,20,22,0.38)] backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar />
      {!sidebarOpen && (
        <div className="absolute top-4 left-4 z-50 flex flex-row gap-2">
          <button
            onClick={toggleSidebar}
            title="사이드바 열기"
            className="glass-card flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:text-text hover:bg-hover"
          >
            <SidebarIcon />
          </button>
          <button
            onClick={handleNewChat}
            title="새 대화"
            className="glass-card flex h-10 w-10 items-center justify-center rounded-xl text-lg text-muted transition-colors hover:text-text hover:bg-hover"
          >
            ＋
          </button>
        </div>
      )}
      <div className="relative flex flex-1 overflow-hidden p-2 md:p-3">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[8%] top-8 h-28 w-28 rounded-full bg-[rgba(213,159,78,0.12)] blur-3xl" />
          <div className="absolute bottom-10 right-[8%] h-40 w-40 rounded-full bg-[rgba(39,122,96,0.12)] blur-3xl" />
        </div>
        <div className="panel-card relative flex min-h-0 flex-1 overflow-hidden rounded-[28px]">
        <Outlet />
        </div>
      </div>
    </div>
  );
}
