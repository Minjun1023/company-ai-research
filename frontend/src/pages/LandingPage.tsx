import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect } from 'react';
import BrandLogo from '../components/BrandLogo';

const FEATURE_COLUMNS = [
  {
    eyebrow: 'Research',
    title: '회사 정보를 문서처럼 읽게 만듭니다',
    body: '공식 홈페이지, 공시, 뉴스 맥락을 모아 기업 개요부터 복지와 채용 신호까지 한 번에 정리합니다.',
  },
  {
    eyebrow: 'Workflow',
    title: '분석, 비교, 면접 준비를 같은 작업 흐름으로 잇습니다',
    body: '회사 선택 후 심층 분석, 기업 비교, 면접 준비, 자기소개서와 연봉 상담까지 같은 워크스페이스에서 이어집니다.',
  },
  {
    eyebrow: 'Profile',
    title: '내 프로필과 이력서를 기준으로 답합니다',
    body: '희망 직군, 경력, 이력서 내용을 바탕으로 더 현실적인 답변과 문서 초안을 생성합니다.',
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: '회사 선택과 정보 수집',
    body: '공식 홈페이지와 공개 정보를 기준으로 회사를 고르고, 최신 수집 상태를 먼저 확인합니다.',
  },
  {
    step: '02',
    title: '워크스페이스별 작업 시작',
    body: '심층 분석, 비교, 면접 준비, 자기소개서, 연봉 상담 중 필요한 흐름으로 바로 들어갑니다.',
  },
  {
    step: '03',
    title: '결과 저장 후 이어서 작업',
    body: '리포트와 초안을 아티팩트로 저장하고, 같은 결과를 바탕으로 다음 작업을 계속 이어갑니다.',
  },
];

const OUTCOME_CARDS = [
  {
    label: '심층 분석',
    title: '회사 개요, 조직 문화, 채용 시그널을 한 문서로',
  },
  {
    label: '면접 준비',
    title: '회사와 직무에 맞춘 예상 질문과 답변 포인트',
  },
  {
    label: '자기소개서',
    title: '초안 작성부터 피드백까지 같은 흐름 안에서',
  },
  {
    label: '연봉 상담',
    title: '현재 상황에 맞는 협상 포인트와 실전 문장 정리',
  },
];

const SAMPLE_PROMPTS = [
  '카카오 심층 분석해줘',
  '네이버와 카카오 복지를 비교해줘',
  '토스 면접 준비해줘',
  '이직 연봉 협상 전략 정리해줘',
];

export default function LandingPage() {
  const navigate = useNavigate();
  const name = useAuthStore((s) => s.name);

  useEffect(() => {
    if (name) navigate('/chat', { replace: true });
  }, [name, navigate]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-[-5%] h-72 w-72 rounded-full bg-[rgba(213,159,78,0.18)] blur-3xl" />
        <div className="absolute right-[-3rem] top-[12%] h-80 w-80 rounded-full bg-[rgba(39,122,96,0.16)] blur-3xl" />
        <div className="absolute bottom-[-5rem] left-[28%] h-80 w-80 rounded-full bg-[rgba(16,163,127,0.1)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-5 pb-16 pt-6 md:px-8 md:pt-8">
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size="panel" className="w-full max-w-[28rem]" />
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 rounded-full border border-border px-4 py-2 text-sm text-text transition-colors hover:bg-hover sm:flex-none"
            >
              로그인
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:flex-none"
            >
              시작하기
            </button>
          </div>
        </header>

        <main className="grid min-h-[calc(100vh-7rem)] items-center gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-14">
          <section className="max-w-2xl">
            <p className="mb-4 text-[11px] uppercase tracking-[0.32em] text-muted">Company-first AI for job seekers</p>
            <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-text md:text-6xl">
              회사 조사부터
              <br />
              면접 준비까지
              <br />
              하나의 작업 공간에서.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-text-sub md:text-lg">
              회사를 찾고, 정보를 수집하고, 비교하고, 내 이력서 기준으로 준비하는 흐름을
              일반 챗봇이 아니라 워크스페이스처럼 다룹니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/register')}
                className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                워크스페이스 시작
              </button>
              <button
                onClick={() => navigate('/login')}
                className="rounded-full border border-border px-5 py-3 text-sm font-medium text-text transition-colors hover:bg-hover"
              >
                기존 계정 로그인
              </button>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {SAMPLE_PROMPTS.map((prompt) => (
                <div
                  key={prompt}
                  className="glass-card rounded-[22px] px-4 py-4 text-sm text-text-sub"
                >
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted">Sample Prompt</p>
                  <p className="mt-2 leading-6">{prompt}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-card overflow-hidden rounded-[32px]">
            <div className="border-b border-border px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted">Workspace Preview</p>
                  <p className="mt-1 text-lg font-semibold text-text">회사 중심 작업 보드</p>
                </div>
                <span className="rounded-full border border-[rgba(16,163,127,0.24)] bg-accent/10 px-3 py-1 text-[11px] font-medium text-text">
                  Live Workflow
                </span>
              </div>
            </div>

            <div className="grid gap-4 px-6 py-6">
              <div className="rounded-[24px] border border-border bg-[rgba(255,255,255,0.18)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Selected Company</p>
                    <p className="mt-1 text-xl font-semibold text-text">카카오</p>
                    <p className="mt-2 text-sm leading-6 text-text-sub">심층 분석, 면접 준비, 자소서 초안, 연봉 상담으로 바로 이어지는 허브</p>
                  </div>
                  <span className="rounded-2xl bg-accent/15 px-3 py-2 text-sm font-medium text-accent">수집 완료</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {FEATURE_COLUMNS.map((item) => (
                  <article key={item.title} className="rounded-[24px] border border-border bg-[rgba(255,255,255,0.2)] p-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{item.eyebrow}</p>
                    <h3 className="mt-2 text-lg font-semibold leading-7 text-text">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-text-sub">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>

        <section className="mt-6 grid gap-4 border-t border-border/70 py-10 md:grid-cols-3">
          {FEATURE_COLUMNS.map((item) => (
            <article key={item.title} className="glass-card rounded-[28px] p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{item.eyebrow}</p>
              <h3 className="mt-3 text-xl font-semibold leading-8 text-text">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-sub">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="max-w-xl">
            <p className="text-[11px] uppercase tracking-[0.26em] text-muted">How It Flows</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-text md:text-4xl">
              첫 화면 아래에는
              <br />
              실제 작업 흐름이 이어져야 합니다.
            </h3>
            <p className="mt-4 text-sm leading-7 text-text-sub md:text-base">
              랜딩은 소개에서 끝나는 게 아니라, 사용자가 어떤 순서로 서비스를 쓰게 되는지 바로 이해시켜야 합니다.
              그래서 회사 선택부터 결과 저장까지 아래 섹션으로 연결했습니다.
            </p>
          </div>

          <div className="grid gap-4">
            {WORKFLOW_STEPS.map((item) => (
              <article key={item.step} className="panel-card rounded-[28px] px-5 py-5">
                <div className="flex items-start gap-4">
                  <span className="rounded-[18px] bg-accent/12 px-3 py-2 text-sm font-semibold text-accent">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-text">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-text-sub">{item.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="py-8">
          <div className="panel-card rounded-[34px] px-6 py-7 md:px-8 md:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.26em] text-muted">Outputs</p>
                <h3 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-text md:text-4xl">
                  결과는 채팅 로그가 아니라
                  <br />
                  다시 열 수 있는 작업 결과물입니다.
                </h3>
              </div>
              <button
                onClick={() => navigate('/register')}
                className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                바로 시작하기
              </button>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {OUTCOME_CARDS.map((item) => (
                <article key={item.title} className="rounded-[24px] border border-border bg-[rgba(255,255,255,0.18)] p-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted">{item.label}</p>
                  <p className="mt-3 text-lg font-semibold leading-7 text-text">{item.title}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
