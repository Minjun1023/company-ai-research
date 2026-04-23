import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { crawlCompany, chatRespond, getCompany } from '../api';
import { ArtifactPanel } from '../components/chat/ArtifactPanel';
import { ArtifactReader } from '../components/chat/ArtifactReader';
import { ChatBubble } from '../components/chat/ChatBubble';
import { CompanyContextPanel } from '../components/chat/CompanyContextPanel';
import { ProfileReadinessBanner } from '../components/chat/ProfileReadinessBanner';
import { WorkflowActionPanel } from '../components/chat/WorkflowActionPanel';
import { WorkspaceStarterForm } from '../components/chat/WorkspaceStarterForm';
import {
  artifactSessionType,
  MODE_LABELS,
  parseModeState,
  trim,
} from '../components/chat/chatShared';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import type { ConversationArtifact, SessionType } from '../types';
import { pathForSessionType } from '../utils/workspaceRouting';

const WORKSPACE_CONFIG: Record<
  SessionType,
  {
    headerTitle: string;
    emptyTitle: string;
    emptyDescription: string;
    placeholder: string;
    suggestions: Array<{ label: string; items: string[] }>;
  }
> = {
  general: {
    headerTitle: '통합 어시스턴트',
    emptyTitle: '무엇을 준비하고 싶으신가요?',
    emptyDescription: '기업 조사부터 면접 준비, 자기소개서, 연봉 협상까지 한 번에 시작할 수 있습니다.',
    placeholder: '회사명이나 궁금한 내용을 입력하세요...',
    suggestions: [
      {
        label: '기업 조사',
        items: ['카카오 심층 분석해줘', '네이버와 카카오 비교해줘'],
      },
      {
        label: '면접 준비',
        items: ['삼성전자 면접 준비해줘', '모의 면접 시작해줘'],
      },
      {
        label: '자기소개서',
        items: ['마케팅 직무 자소서 초안 써줘', '자소서 피드백 받고 싶어'],
      },
      {
        label: '연봉 협상',
        items: ['연봉 협상 전략 알려줘', '이직 연봉 협상 준비 도와줘'],
      },
    ],
  },
  research: {
    headerTitle: '기업 분석',
    emptyTitle: '조사할 회사를 입력해보세요',
    emptyDescription: '기업 개요, 성장성, 복지, 채용 신호, 최근 이슈까지 구조화된 리서치로 정리합니다.',
    placeholder: '예: 카카오 심층 분석해줘',
    suggestions: [
      {
        label: '심층 분석',
        items: ['카카오 심층 분석해줘', '삼성전자 기업 리서치 해줘'],
      },
      {
        label: '관심 포인트',
        items: ['현대자동차 복지와 근무환경 알려줘', '네이버 최근 이슈와 채용 분위기 알려줘'],
      },
    ],
  },
  compare: {
    headerTitle: '기업 비교',
    emptyTitle: '비교할 회사를 입력해보세요',
    emptyDescription: '연봉, 복지, 조직문화, 안정성, 성장성을 한 번에 비교하고 더 적합한 회사를 찾습니다.',
    placeholder: '예: 네이버와 카카오 비교해줘',
    suggestions: [
      {
        label: '기본 비교',
        items: ['네이버와 카카오 비교해줘', '삼성전자와 LG전자 비교해줘'],
      },
      {
        label: '조건별 비교',
        items: ['복지와 연봉 기준으로 비교해줘', '안정성과 성장성 기준으로 비교해줘'],
      },
    ],
  },
  interview: {
    headerTitle: '면접 준비',
    emptyTitle: '면접 준비를 시작해보세요',
    emptyDescription: '기업 맞춤 예상 질문, 답변 포인트, 모의 면접까지 실제 면접 흐름에 맞춰 준비할 수 있습니다.',
    placeholder: '예: CJ제일제당 면접 준비해줘',
    suggestions: [
      {
        label: '준비 모드',
        items: ['삼성전자 면접 준비해줘', '신입 마케팅 직무 면접 질문 정리해줘'],
      },
      {
        label: '실전 연습',
        items: ['카카오 모의 면접 시작해줘', '영업 직무 면접 답변 피드백 해줘'],
      },
    ],
  },
  coverletter: {
    headerTitle: '자기소개서',
    emptyTitle: '자기소개서 작업을 시작해보세요',
    emptyDescription: '초안 작성부터 첨삭, 수정 반복까지 하나의 작업 흐름으로 관리할 수 있습니다.',
    placeholder: '예: 현대자동차 지원 자소서 초안 써줘',
    suggestions: [
      {
        label: '초안 작성',
        items: ['현대자동차 지원 자소서 초안 써줘', '영업관리 직무 지원동기 작성해줘'],
      },
      {
        label: '피드백',
        items: ['내 자소서 피드백 해줘', '자소서 문장을 더 설득력 있게 고쳐줘'],
      },
    ],
  },
  salary: {
    headerTitle: '연봉 협상',
    emptyTitle: '연봉 협상 준비를 시작해보세요',
    emptyDescription: '현재 상황을 바탕으로 협상 전략, 핵심 논리, 실제로 쓸 수 있는 멘트를 정리합니다.',
    placeholder: '예: 이직 연봉 협상 준비 도와줘',
    suggestions: [
      {
        label: '협상 전략',
        items: ['이직 연봉 협상 전략 알려줘', '현재 연봉 5천인데 협상 포인트 정리해줘'],
      },
      {
        label: '실전 멘트',
        items: ['연봉 협상 멘트 예시 알려줘', '처우 협의 답변 문장 만들어줘'],
      },
    ],
  },
};

export default function ChatPage() {
  const {
    activeId,
    activeConversation,
    activeArtifacts,
    activeMessages,
    addMessage,
    applyRespondResult,
    createConversation,
    loadArtifacts,
    sessionFilter,
  } = useChatStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { careerLevel, desiredJob, techStack, desiredIndustry, resumeText } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const messages = activeMessages();
  const artifacts = activeArtifacts();
  const conversation = activeConversation();
  const workspaceType: SessionType =
    conversation?.sessionType ?? (sessionFilter === 'all' ? 'general' : sessionFilter);
  const workspaceConfig = WORKSPACE_CONFIG[workspaceType];
  const conversationMode = conversation?.mode ?? 'idle';
  const parsedModeState = parseModeState(conversation?.modeState);
  const stageLabel = MODE_LABELS[conversationMode] ?? '대기 중';
  const isActionableMode =
    conversationMode === 'company_selection' ||
    conversationMode === 'company_url_input' ||
    (conversationMode === 'coverletter_feedback' && parsedModeState.phase === 'awaiting_job_url');
  const composerPlaceholder = (() => {
    if (conversationMode === 'company_selection') {
      return '후보를 선택하거나 회사명을 직접 입력하세요...';
    }
    if (conversationMode === 'company_url_input') {
      return '공식 홈페이지 URL을 입력하세요...';
    }
    if (conversationMode === 'coverletter_feedback' && parsedModeState.phase === 'awaiting_job_url') {
      return '채용공고 URL을 입력하거나 건너뛰기를 선택하세요...';
    }
    return workspaceConfig.placeholder;
  })();
  const selectedCompanyId = conversation?.selectedCompanyId ?? null;
  const fallbackCompanyName =
    parsedModeState.companyName ??
    parsedModeState.targetCompanyName ??
    undefined;

  const relevantProfileFields = [
    { label: '경력 정보', filled: Boolean(careerLevel?.trim()) },
    { label: '희망 직무', filled: Boolean(desiredJob?.trim()) },
    { label: '기술 스택', filled: Boolean(techStack?.trim()) },
    { label: '희망 업종', filled: Boolean(desiredIndustry?.trim()) },
    { label: '이력서/자기소개서', filled: Boolean(resumeText?.trim()) },
  ];
  const profileScore = Math.round(
    (relevantProfileFields.filter((field) => field.filled).length / relevantProfileFields.length) * 100
  );
  const missingProfileItems = relevantProfileFields
    .filter((field) => !field.filled)
    .map((field) => field.label);

  const [input, setInput] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshingCompany, setRefreshingCompany] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ConversationArtifact | null>(null);

  const logRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const jobUrlHandledRef = useRef(false);
  const greetHandledRef = useRef(false);
  const handleSendRef = useRef<(text?: string) => Promise<boolean>>(async () => false);
  const highlightTimeoutRef = useRef<number | null>(null);

  const { data: selectedCompany } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => getCompany(selectedCompanyId as number),
    enabled: selectedCompanyId != null,
  });

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current != null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedArtifact) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedArtifact(null);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [selectedArtifact]);

  useEffect(() => {
    if (activeId == null) return;
    loadArtifacts(activeId).catch(() => {});
  }, [activeId, loadArtifacts]);

  useEffect(() => {
    setActionInput('');
  }, [conversationMode, conversation?.modeState, activeId]);

  useEffect(() => {
    if (jobUrlHandledRef.current) return;
    const company = searchParams.get('company');
    const jobUrl = searchParams.get('jobUrl');
    if (company) {
      jobUrlHandledRef.current = true;
      setSearchParams({}, { replace: true });
      const basePrompt = (() => {
        switch (workspaceType) {
          case 'research':
            return `${company} 심층 분석해줘`;
          case 'interview':
            return `${company} 면접 준비해줘`;
          case 'coverletter':
            return `${company} 자소서 써줘`;
          case 'salary':
            return `${company} 연봉 협상 도와줘`;
          default:
            return `${company} 분석해줘`;
        }
      })();
      const message = jobUrl ? `${basePrompt} (채용공고 참고: ${jobUrl})` : basePrompt;
      void handleSendRef.current(message);
    }
  }, [searchParams, setSearchParams, workspaceType]);

  useEffect(() => {
    if (greetHandledRef.current) return;
    const greetCompany = (location.state as { greetCompany?: string } | null)?.greetCompany;
    if (!greetCompany) return;
    greetHandledRef.current = true;
    window.history.replaceState({}, '');
    addMessage({ role: 'system', content: `${greetCompany}에 대해 무엇이 궁금하세요?` });
  }, [addMessage, location.state]);

  const sys = useCallback(
    (text: string) => addMessage({ role: 'system', content: text }),
    [addMessage]
  );

  const handleSend = async (text?: string): Promise<boolean> => {
    const message = trim(text ?? input);
    if (!message || loading) return false;

    if (message.length > 5000) {
      sys(`메시지가 너무 깁니다 (${message.length}자). 5000자 이내로 입력해 주세요.`);
      return false;
    }

    let conversationId = activeId;
    if (conversationId == null) {
      conversationId = await createConversation(sessionFilter === 'all' ? 'general' : sessionFilter);
    }
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const response = await chatRespond(conversationId, message, true);
      applyRespondResult(response);
      return true;
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errMsg =
        axErr?.response?.data?.message ||
        axErr?.response?.data?.error ||
        axErr?.message ||
        '알 수 없는 오류가 발생했습니다.';
      sys(errMsg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  handleSendRef.current = handleSend;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const focusComposer = () => {
    textareaRef.current?.focus();
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const highlightMessage = (messageId: number) => {
    if (highlightTimeoutRef.current != null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedMessageId(messageId);
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimeoutRef.current = null;
    }, 2200);
  };

  const handleOpenArtifact = (artifact: ConversationArtifact) => {
    setSelectedArtifact(artifact);
  };

  const handleContinueArtifact = (artifact: ConversationArtifact) => {
    setSelectedArtifact(null);
    setInput(`저장된 "${artifact.title}" 결과를 바탕으로 이어서 작업해줘.`);
    focusComposer();
  };

  const handleOpenArtifactMessage = (artifact: ConversationArtifact) => {
    setSelectedArtifact(null);
    const target = document.getElementById(`message-${artifact.sourceMessageId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightMessage(artifact.sourceMessageId);
      return;
    }
    setInput(`저장된 "${artifact.title}" 결과를 다시 보여주고 핵심만 요약해줘.`);
    focusComposer();
  };

  const handleWorkflowAction = async (value: string) => {
    const ok = await handleSend(value);
    if (ok) {
      setActionInput('');
    }
  };

  const handleRefreshCompany = async () => {
    if (selectedCompanyId == null || refreshingCompany) return;
    setRefreshingCompany(true);
    try {
      await crawlCompany(selectedCompanyId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['company', selectedCompanyId] }),
        queryClient.invalidateQueries({ queryKey: ['companies'] }),
      ]);
      sys(`${selectedCompany?.name ?? '회사'} 정보를 최신화했습니다.`);
    } catch {
      sys('회사 정보 최신화에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setRefreshingCompany(false);
    }
  };

  const handleDuplicateArtifact = async (artifact: ConversationArtifact) => {
    const targetSessionType = artifactSessionType(artifact.artifactType);
    const nextConversationId = await createConversation(targetSessionType);
    if (workspaceType !== targetSessionType) {
      navigate(pathForSessionType(targetSessionType));
    }

    setSelectedArtifact(null);
    setLoading(true);
    try {
      const snapshot = artifact.content.slice(0, 3600);
      const seedMessage =
        `새 세션을 시작합니다. 아래 저장된 결과를 바탕으로 현재 상태를 먼저 요약하고, 이어서 작업하기 좋은 다음 단계를 제안해줘.\n\n` +
        `[저장된 결과 제목]\n${artifact.title}\n\n` +
        `[저장된 결과 본문]\n${snapshot}`;
      const response = await chatRespond(nextConversationId, seedMessage, true);
      applyRespondResult(response);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errMsg =
        axErr?.response?.data?.message ||
        axErr?.response?.data?.error ||
        axErr?.message ||
        '새 세션 생성 중 오류가 발생했습니다.';
      sys(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <div className="flex-shrink-0 px-5 pb-3 pt-5 md:px-8">
        <div className="glass-card mx-auto flex w-full max-w-5xl flex-col gap-5 rounded-[30px] px-6 py-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">{workspaceConfig.headerTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-text-sub">
              {conversation?.title && conversation.title !== '새 대화'
                ? conversation.title
                : workspaceConfig.emptyDescription}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-[20px] border border-border bg-[rgba(255,255,255,0.16)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">현재 상태</p>
              <p className="mt-1 text-sm font-medium text-text">{stageLabel}</p>
            </div>
            <div className="rounded-[20px] border border-border bg-[rgba(255,255,255,0.16)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">메시지</p>
              <p className="mt-1 text-sm font-medium text-text">{messages.length}개</p>
            </div>
            <div className="rounded-[20px] border border-border bg-[rgba(255,255,255,0.16)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">저장 결과</p>
              <p className="mt-1 text-sm font-medium text-text">{artifacts.length}개</p>
            </div>
          </div>
        </div>
      </div>

      <CompanyContextPanel
        company={selectedCompany}
        fallbackName={fallbackCompanyName}
        refreshing={refreshingCompany}
        onRefresh={handleRefreshCompany}
        onOpenHub={() => selectedCompanyId != null && navigate(`/explore/${selectedCompanyId}`)}
      />

      <ProfileReadinessBanner
        workspaceType={workspaceType}
        missingItems={missingProfileItems}
        profileScore={profileScore}
        onOpenProfile={() => navigate('/settings/profile')}
      />

      {!hasMessages && (
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4 md:px-8">
          <div className="panel-card mx-auto grid min-h-[420px] w-full max-w-5xl items-start gap-8 rounded-[34px] px-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Start From Intent</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-text md:text-4xl">{workspaceConfig.emptyTitle}</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-text-sub">{workspaceConfig.emptyDescription}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-border bg-[rgba(255,255,255,0.16)] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">세션 타입</p>
                  <p className="mt-2 text-base font-medium text-text">{workspaceConfig.headerTitle}</p>
                </div>
                <div className="rounded-[22px] border border-border bg-[rgba(255,255,255,0.16)] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">작업 방식</p>
                  <p className="mt-2 text-base font-medium text-text">회사 중심 멀티스텝</p>
                </div>
              </div>
              <div className="mt-6">
                <WorkspaceStarterForm
                  key={workspaceType}
                  workspaceType={workspaceType}
                  loading={loading}
                  onSubmit={(prompt) => void handleSend(prompt)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {workspaceConfig.suggestions.map((category) => (
                <div key={category.label} className="glass-card rounded-[24px] p-4 text-left">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">{category.label}</p>
                  <div className="flex flex-col gap-2">
                    {category.items.map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setInput(item);
                          textareaRef.current?.focus();
                        }}
                        className="rounded-[18px] border border-transparent bg-[rgba(255,255,255,0.12)] px-3 py-3 text-left text-[0.84rem] leading-snug text-text-sub transition-colors hover:border-border hover:bg-hover hover:text-text"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasMessages && (
        <div ref={logRef} className="scrollbar-thin flex flex-1 flex-col gap-0 overflow-y-auto py-2 pb-8">
          <ArtifactPanel
            artifacts={artifacts}
            onOpenArtifact={handleOpenArtifact}
            onContinueArtifact={handleContinueArtifact}
          />
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              messageId={message.id}
              role={message.role}
              content={message.content}
              meta={message.meta}
              highlighted={highlightedMessageId === message.id}
            />
          ))}
          {loading && (
            <div className="mx-auto flex w-full max-w-5xl items-start gap-4 px-6 py-3">
              <div className="flex flex-1 items-center gap-1.5 pl-1 pt-1 text-sm text-muted">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="-mt-10 flex-shrink-0 bg-gradient-to-b from-transparent via-bg/75 to-bg pt-10">
        <div className="mx-auto flex w-full max-w-5xl flex-shrink-0 px-6 pb-5 pt-2">
          <div className="w-full">
            {isActionableMode && (
              <WorkflowActionPanel
                mode={conversationMode}
                modeState={parsedModeState}
                actionInput={actionInput}
                setActionInput={setActionInput}
                loading={loading}
                onSend={handleWorkflowAction}
              />
            )}
            <div className="glass-card flex items-end gap-2 rounded-[28px] px-4 py-3 transition-all focus-within:border-[rgba(16,163,127,0.22)] focus-within:shadow-[0_0_0_3px_rgba(16,163,127,0.08)]">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={composerPlaceholder}
                disabled={loading}
                className="max-h-[200px] flex-1 resize-none overflow-y-auto border-none bg-transparent py-0.5 font-sans text-[0.95rem] leading-[1.5] text-text outline-none placeholder:text-muted disabled:opacity-50"
              />
              {input.length > 4000 && (
                <span className={`self-end pb-1 text-[11px] ${input.length >= 5000 ? 'text-[#ff9090]' : 'text-muted'}`}>
                  {input.length}/5000
                </span>
              )}
              <button
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-accent text-white transition-all hover:bg-accent-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 14V2M8 2L3 7M8 2L13 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">
              AI는 실수할 수 있습니다. 중요한 정보는 공식 홈페이지에서 확인하세요.
            </p>
          </div>
        </div>
      </div>

      {selectedArtifact && (
        <ArtifactReader
          artifact={selectedArtifact}
          onClose={() => setSelectedArtifact(null)}
          onOpenOriginal={() => handleOpenArtifactMessage(selectedArtifact)}
          onContinue={() => handleContinueArtifact(selectedArtifact)}
          onDuplicate={() => void handleDuplicateArtifact(selectedArtifact)}
        />
      )}

      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease; }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .typing-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: var(--color-muted);
          animation: typingBounce 1.2s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
}
