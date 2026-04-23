import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { logout } from '../api';
import { useIsMobile } from '../hooks/useIsMobile';
import { groupConversationsByDate } from '../utils/groupConversationsByDate';
import { pathForSessionFilter, pathForSessionType } from '../utils/workspaceRouting';
import type { SessionFilter } from '../types';
import BrandLogo from './BrandLogo';

const PINNED_KEY = 'pinnedConversationIds';
const SESSION_TABS: Array<{ value: SessionFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'general', label: '통합' },
  { value: 'research', label: '분석' },
  { value: 'compare', label: '비교' },
  { value: 'interview', label: '면접' },
  { value: 'coverletter', label: '자소서' },
  { value: 'salary', label: '연봉' },
];
const QUICK_STARTS = [
  { type: 'general', label: '통합 시작' },
  { type: 'research', label: '새 분석' },
  { type: 'compare', label: '새 비교' },
  { type: 'interview', label: '새 면접' },
  { type: 'coverletter', label: '새 자소서' },
  { type: 'salary', label: '새 연봉' },
] as const;

const SidebarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
    <line x1="6" y1="1.75" x2="6" y2="16.25" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const ExploreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 5.5L9 9L5.5 10.5L7 7L10.5 5.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M2.5 13.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="7" width="10" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M5 7V5a3 3 0 016 0v2"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

function loadPinned(): number[] {
  try {
    return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePinned(ids: number[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    conversations,
    activeId,
    sessionFilter,
    createConversation,
    setActiveId,
    setSessionFilter,
    deleteConversation,
    renameConversation,
    clearConversations,
  } =
    useChatStore();
  const queryClient = useQueryClient();
  const { name, clearAuth } = useAuthStore();
  const { sidebarOpen, toggleSidebar, isDark, toggleTheme } = useThemeStore();

  const isMobile = useIsMobile();

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [pinnedIds, setPinnedIds] = useState<number[]>(loadPinned);
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 편집 모드 진입 시 인풋 포커스
  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  const handleNewChat = async () => {
    const nextSessionType = sessionFilter === 'all' ? 'general' : sessionFilter;
    await createConversation(nextSessionType);
    navigate(pathForSessionFilter(sessionFilter));
    if (isMobile) toggleSidebar();
  };

  const handleSelectSessionFilter = (filter: SessionFilter) => {
    setSessionFilter(filter);
    navigate(pathForSessionFilter(filter));
  };

  const handleQuickStart = async (filter: Exclude<SessionFilter, 'all'>) => {
    setSessionFilter(filter);
    await createConversation(filter);
    navigate(pathForSessionType(filter));
    if (isMobile) toggleSidebar();
  };

  const handleSelectConversation = (id: number) => {
    if (editingId === id) return;
    const targetConversation = conversations.find((conversation) => conversation.id === id);
    setActiveId(id);
    navigate(pathForSessionType(targetConversation?.sessionType ?? 'general'));
    if (isMobile) toggleSidebar();
  };

  const handleConversationKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    id: number,
  ) => {
    if (editingId === id) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectConversation(id);
    }
  };

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async (id: number) => {
    setConfirmDeleteId(null);
    await deleteConversation(id);
    navigate(pathForSessionFilter(sessionFilter));
  };

  const handleStartRename = (id: number, title: string) => {
    setEditTitle(title);
    setEditingId(id);
    setOpenMenuId(null);
  };

  const handleRenameSubmit = async (id: number) => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversations.find((c) => c.id === id)?.title) {
      await renameConversation(id, trimmed);
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') handleRenameSubmit(id);
    if (e.key === 'Escape') setEditingId(null);
  };

  const handleTogglePin = (id: number) => {
    setOpenMenuId(null);
    const newPinned = pinnedIds.includes(id)
      ? pinnedIds.filter((p) => p !== id)
      : [id, ...pinnedIds];
    setPinnedIds(newPinned);
    savePinned(newPinned);
  };

  const handleLogout = () => {
    logout().catch(() => {});
    clearConversations();
    clearAuth();
    queryClient.clear();
    navigate('/');
  };

  const navItem = (label: string, path: string, icon: React.ReactNode) => {
    const active = location.pathname === path;
    return (
      <button
        key={path}
        onClick={() => navigate(path)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
          active
            ? 'bg-surface-2 text-text'
            : 'text-muted hover:bg-surface hover:text-text'
        }`}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
        <span>{label}</span>
      </button>
    );
  };

  const visibleConversations = useMemo(() => {
    if (sessionFilter === 'all') return conversations;
    return conversations.filter((conversation) => conversation.sessionType === sessionFilter);
  }, [conversations, sessionFilter]);

  const filteredConversations = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return visibleConversations;
    return visibleConversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(keyword)
    );
  }, [search, visibleConversations]);

  const conversationGroups = groupConversationsByDate(filteredConversations, pinnedIds);

  return (
    <aside
      className={`
        bg-sidebar-bg flex flex-col overflow-hidden backdrop-blur-xl
        transition-[width,transform] duration-200 ease-in-out
        ${isMobile
          ? `fixed inset-y-0 left-0 z-50 ${sidebarOpen ? 'w-[300px]' : 'w-0'}`
          : `flex-shrink-0 ${sidebarOpen ? 'w-[300px]' : 'w-0'}`
        }
      `}
      style={{ borderRight: sidebarOpen ? '1px solid var(--color-border)' : '0 solid transparent' }}
    >
      {sidebarOpen && (
        <>
          {/* Brand */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0">
            <div className="glass-card rounded-[24px] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <BrandLogo size="compact" subtitle="CAREER RESEARCH WORKSPACE" />
                  <p className="mt-3 text-xs leading-5 text-muted">
                    회사 리서치, 비교, 면접 준비를 한 화면에서 이어서 관리합니다.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleSidebar}
                    title="사이드바 접기"
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-text"
                  >
                    <SidebarIcon />
                  </button>
                  <button
                    onClick={handleNewChat}
                    title="새 대화"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-lg text-white transition-opacity hover:opacity-90"
                  >
                    ＋
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pt-0 pb-3 flex-shrink-0">
            <div className="glass-card rounded-[24px] px-4 py-4">
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Workstreams</p>
              </div>
            <div className="flex flex-wrap gap-1.5 px-0 pb-4">
              {SESSION_TABS.map((tab) => {
                const active = sessionFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => handleSelectSessionFilter(tab.value)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border border-[rgba(16,163,127,0.24)] bg-accent/10 text-text'
                        : 'bg-surface text-muted border border-transparent hover:text-text hover:border-surface-2'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 pb-4">
              {QUICK_STARTS.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleQuickStart(item.type)}
                  className="rounded-2xl border border-surface-2 bg-[rgba(255,255,255,0.22)] px-3 py-3 text-left text-[11px] font-medium text-text-sub transition-colors hover:bg-hover hover:text-text"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="relative flex items-center">
              <svg
                className="absolute left-3 w-3.5 h-3.5 text-muted pointer-events-none flex-shrink-0"
                viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="세션 검색"
                className="w-full rounded-2xl border border-transparent bg-input py-2.5 pl-9 pr-8 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-surface-2"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 text-muted hover:text-text transition-colors text-xs leading-none"
                >
                  ✕
                </button>
              )}
            </div>
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {filteredConversations.length === 0 && !search.trim() && (
              <div className="flex-1 px-4 py-4">
                <div className="glass-card flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-[24px] px-5 py-8 text-center">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted opacity-40">
                  <path d="M6 4h20a2 2 0 012 2v16a2 2 0 01-2 2H10l-6 4V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                  <line x1="11" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="11" y1="17" x2="17" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <p className="text-xs text-muted opacity-60 leading-relaxed whitespace-pre-line">
                  {sessionFilter === 'all'
                    ? '아직 대화가 없습니다.\n새 대화를 시작해보세요.'
                    : '이 워크스페이스에는 아직 세션이 없습니다.\n새 대화를 시작해보세요.'}
                </p>
              </div>
              </div>
            )}
            {search.trim() ? (
              (() => {
                return filteredConversations.length > 0 ? (
                  <div className="px-3 pt-1 pb-3 flex flex-col gap-1">
                    {filteredConversations.map((conv) => {
                      const isActive = conv.id === activeId && location.pathname === '/chat';
                      const isPinned = pinnedIds.includes(conv.id);
                      const isEditing = editingId === conv.id;
                      const isMenuOpen = openMenuId === conv.id;

                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv.id)}
                          onKeyDown={(e) => handleConversationKeyDown(e, conv.id)}
                          role="button"
                          tabIndex={0}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={`${conv.title} 대화 열기`}
                          className={`group relative flex items-center justify-between rounded-2xl px-3 py-3 cursor-pointer transition-colors ${
                            isActive
                              ? 'glass-card text-text'
                              : 'text-muted hover:bg-hover hover:text-text'
                          }`}
                        >
                          {isPinned && (
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="mr-1 flex-shrink-0 text-accent" xmlns="http://www.w3.org/2000/svg"><path d="M5 1h4l-1 4 2 2H4L6 5 5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><line x1="7" y1="7" x2="7" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          )}
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={() => handleRenameSubmit(conv.id)}
                              onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 min-w-0 bg-transparent text-sm text-text outline-none border-b border-accent"
                            />
                          ) : (
                            <span className="flex-1 min-w-0 text-sm truncate">{conv.title}</span>
                          )}
                          {!isEditing && (
                            <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(isMenuOpen ? null : conv.id);
                                }}
                                className={`ml-1 flex-shrink-0 rounded px-1 text-xs transition-colors ${
                                  isMenuOpen
                                    ? 'text-text'
                                    : isActive ? 'text-muted hover:text-text' : 'text-muted opacity-0 group-hover:opacity-100 hover:text-text'
                                }`}
                                title="옵션"
                              >
                                •••
                              </button>
                              {isMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-surface border border-border rounded-xl shadow-lg py-1 text-sm">
                                  {confirmDeleteId === conv.id ? (
                                    <div className="px-3 py-2 flex flex-col gap-1.5">
                                      <p className="text-[11px] text-[#ff9090] font-medium">삭제하시겠습니까?</p>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); setOpenMenuId(null); }}
                                          className="flex-1 px-2 py-1 rounded-lg text-[11px] text-muted border border-border hover:bg-surface-2 transition-colors"
                                        >
                                          취소
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleConfirmDelete(conv.id); setOpenMenuId(null); }}
                                          className="flex-1 px-2 py-1 rounded-lg text-[11px] text-[#ff9090] border border-[#ff9090]/30 hover:bg-[#ff9090]/10 transition-colors"
                                        >
                                          삭제
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleStartRename(conv.id, conv.title); }}
                                        className="w-full text-left px-3 py-2 text-text hover:bg-surface-2 transition-colors"
                                      >
                                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="inline-block mr-1.5 -mt-0.5" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>수정
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleTogglePin(conv.id); }}
                                        className="w-full text-left px-3 py-2 text-text hover:bg-surface-2 transition-colors"
                                      >
                                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="inline-block mr-1.5 -mt-0.5" xmlns="http://www.w3.org/2000/svg"><path d="M5 1h4l-1 4 2 2H4L6 5 5 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><line x1="7" y1="7" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>{isPinned ? '고정 해제' : '고정'}
                                      </button>
                                      <div className="border-t border-border my-1" />
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                                        className="w-full text-left px-3 py-2 text-[#ff9090] hover:bg-surface-2 transition-colors"
                                      >
                                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="inline-block mr-1.5 -mt-0.5" xmlns="http://www.w3.org/2000/svg"><polyline points="2,3 12,3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 3V2h4v1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M3 3l1 9h6l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>삭제
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-4 py-3 text-xs text-muted">검색 결과 없음</p>
                );
              })()
            ) : (
            conversationGroups.length > 0 && (
              <div className="px-3 pt-3 pb-4 flex flex-col gap-4">
                {conversationGroups.map((group) => (
                  <div key={group.label}>
                    <p className="px-2 text-[10px] text-muted uppercase tracking-[0.24em] mb-2">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-1">
                      {group.items.map((conv) => {
                        const isActive = conv.id === activeId && location.pathname === '/chat';
                        const isPinned = pinnedIds.includes(conv.id);
                        const isEditing = editingId === conv.id;
                        const isMenuOpen = openMenuId === conv.id;

                        return (
                          <div
                            key={conv.id}
                            onClick={() => handleSelectConversation(conv.id)}
                            onKeyDown={(e) => handleConversationKeyDown(e, conv.id)}
                            role="button"
                            tabIndex={0}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={`${conv.title} 대화 열기`}
                            className={`group relative flex items-center justify-between rounded-2xl px-3 py-3 cursor-pointer transition-colors ${
                              isActive
                                ? 'glass-card text-text'
                                : 'text-muted hover:bg-hover hover:text-text'
                            }`}
                          >
                            {isPinned && (
                              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" className="mr-1 flex-shrink-0 text-accent" xmlns="http://www.w3.org/2000/svg"><path d="M5 1h4l-1 4 2 2H4L6 5 5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><line x1="7" y1="7" x2="7" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                            )}

                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={() => handleRenameSubmit(conv.id)}
                                onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 min-w-0 bg-transparent text-sm text-text outline-none border-b border-accent"
                              />
                            ) : (
                              <span className="flex-1 min-w-0 text-sm truncate">{conv.title}</span>
                            )}

                            {!isEditing && (
                              <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(isMenuOpen ? null : conv.id);
                                  }}
                                  className={`ml-1 flex-shrink-0 px-1 rounded text-xs transition-colors ${
                                    isMenuOpen
                                      ? 'text-text'
                                      : isActive ? 'text-muted hover:text-text' : 'text-muted opacity-0 group-hover:opacity-100 hover:text-text'
                                  }`}
                                  title="옵션"
                                >
                                  •••
                                </button>

                                {isMenuOpen && (
                                  <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-surface border border-border rounded-xl shadow-lg py-1 text-sm">
                                    {confirmDeleteId === conv.id ? (
                                      <div className="px-3 py-2 flex flex-col gap-1.5">
                                        <p className="text-[11px] text-[#ff9090] font-medium">삭제하시겠습니까?</p>
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); setOpenMenuId(null); }}
                                            className="flex-1 px-2 py-1 rounded-lg text-[11px] text-muted border border-border hover:bg-surface-2 transition-colors"
                                          >
                                            취소
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleConfirmDelete(conv.id); setOpenMenuId(null); }}
                                            className="flex-1 px-2 py-1 rounded-lg text-[11px] text-[#ff9090] border border-[#ff9090]/30 hover:bg-[#ff9090]/10 transition-colors"
                                          >
                                            삭제
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartRename(conv.id, conv.title);
                                          }}
                                          className="w-full text-left px-3 py-2 text-text hover:bg-surface-2 transition-colors"
                                        >
                                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="inline-block mr-1.5 -mt-0.5" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>수정
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleTogglePin(conv.id);
                                          }}
                                          className="w-full text-left px-3 py-2 text-text hover:bg-surface-2 transition-colors"
                                        >
                                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="inline-block mr-1.5 -mt-0.5" xmlns="http://www.w3.org/2000/svg"><path d="M5 1h4l-1 4 2 2H4L6 5 5 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><line x1="7" y1="7" x2="7" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>{isPinned ? '고정 해제' : '고정'}
                                        </button>
                                        <div className="border-t border-border my-1" />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(conv.id);
                                          }}
                                          className="w-full text-left px-3 py-2 text-[#ff9090] hover:bg-surface-2 transition-colors"
                                        >
                                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="inline-block mr-1.5 -mt-0.5" xmlns="http://www.w3.org/2000/svg"><polyline points="2,3 12,3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 3V2h4v1" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M3 3l1 9h6l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>삭제
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
            )}
          </div>

          {/* 하단 고정 영역: 내비게이션 + 유저 정보 */}
          <div className="flex-shrink-0 border-t border-surface-2 px-4 pb-4 pt-3">
            <div className="glass-card mb-3 rounded-[24px] p-2">
              {navItem('관심 기업', '/explore', <ExploreIcon />)}
              {navItem('설정', '/settings', <SettingsIcon />)}
            </div>
            <div className="glass-card rounded-[24px] px-4 py-4">
              {name ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
                    <UserIcon />
                    <span className="truncate">
                      <span className="block text-[11px] uppercase tracking-[0.18em] text-muted">Account</span>
                      <span className="text-sm text-text">{name}</span>
                    </span>
                  </span>
                  <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={toggleTheme}
                      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-hover hover:text-text"
                    >
                      {isDark ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
                          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="text-xs text-muted transition-colors hover:text-[#ff9090]"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/login')}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-3 text-sm text-muted transition-colors hover:bg-hover hover:text-text"
                >
                  <LockIcon />
                  <span>로그인</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
