# FRONTEND.md — 프론트엔드 구현 가이드

React 앱의 폴더 구조, 상태 관리, API 레이어, 컴포넌트 작성 규칙을 정의합니다.

---

## 1. 기술 스택

| 항목 | 버전/라이브러리 |
|------|----------------|
| UI 프레임워크 | React 19 |
| 언어 | TypeScript |
| 빌드 도구 | Vite |
| 스타일링 | Tailwind CSS + CSS 변수 |
| 상태 관리 | Zustand |
| API 통신 | Axios |
| 마크다운 렌더링 | react-markdown + remark-gfm |
| 라우팅 | React Router v6 |

---

## 2. 폴더 구조

```
frontend/src/
├── api/
│   └── index.ts          # 모든 API 함수 (axios 기반)
├── components/
│   ├── Layout.tsx         # 사이드바 + 아웃렛 레이아웃
│   ├── Sidebar.tsx        # 대화 목록, 회사 선택, 테마 토글
│   └── ProfileFormFields.tsx
├── hooks/
│   └── useIsMobile.ts
├── pages/
│   ├── ChatPage.tsx       # 메인 채팅 페이지
│   ├── CompanyDetailPage.tsx  # 회사 상세
│   ├── ExplorePage.tsx    # 회사 목록/검색
│   ├── LandingPage.tsx    # 랜딩 (비로그인)
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── KakaoCallbackPage.tsx
│   ├── NaverCallbackPage.tsx
│   ├── SocialSetupPage.tsx
│   ├── SettingsPage.tsx
│   ├── ProfileDetailPage.tsx
│   └── WithdrawPage.tsx
├── store/
│   ├── authStore.ts       # 인증 상태 (JWT, email, name)
│   ├── chatStore.ts       # 대화 목록, 메시지, 선택 회사
│   └── themeStore.ts      # 다크/라이트 테마
├── types/
│   └── index.ts           # 공유 타입 정의
├── utils/
│   ├── authUtils.ts
│   ├── extractConversationTags.ts
│   ├── groupConversationsByDate.ts
│   └── profileOptions.ts
├── App.tsx                # 라우팅 설정
├── main.tsx               # 진입점
└── index.css              # CSS 변수 + Tailwind 베이스
```

---

## 3. 라우팅

`App.tsx` 기준 라우트 구조:

| 경로 | 컴포넌트 | 인증 필요 |
|------|----------|----------|
| `/` | `LandingPage` | 없음 |
| `/login` | `LoginPage` | 없음 |
| `/register` | `RegisterPage` | 없음 |
| `/forgot-password` | `ForgotPasswordPage` | 없음 |
| `/auth/kakao/callback` | `KakaoCallbackPage` | 없음 |
| `/auth/naver/callback` | `NaverCallbackPage` | 없음 |
| `/social-setup` | `SocialSetupPage` | 없음 |
| `/chat` | `Layout > ChatPage` | 있음 |
| `/explore` | `Layout > ExplorePage` | 있음 |
| `/explore/:id` | `Layout > CompanyDetailPage` | 있음 |
| `/settings` | `Layout > SettingsPage` | 있음 |
| `/settings/profile` | `Layout > ProfileDetailPage` | 있음 |
| `/withdraw` | `Layout > WithdrawPage` | 있음 |

인증 가드: 현재는 `useAuthStore().name` 존재 여부를 기준으로 보호 라우트를 통과시킵니다.

---

## 4. 상태 관리 (Zustand)

### 4-1. authStore

```typescript
interface AuthState {
  token: string | null;
  email: string | null;
  name: string | null;
  setAuth: (token, email, name) => void;
  clearAuth: () => void;
}
```

- `persist` 미들웨어로 인증 상태를 저장
- API 요청 시 인증 정보와 쿠키 기반 로그인 상태를 함께 사용

### 4-2. chatStore

```typescript
interface Conversation {
  id: number;
  title: string;
  messages: ChatMessage[];
  selectedCompanyId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  conversations: Conversation[];
  activeId: number | null;
  companies: Company[];     // 사이드바 회사 목록
  topK: number;             // 임베딩 검색 결과 수 (기본 10)
  // ... actions
}
```

**주요 액션**:
- `loadConversations()`: 서버에서 전체 대화 목록 로드
- `createConversation()`: 새 대화 생성 (서버 저장 후 local state 반영)
- `addMessage(msg)`: 메시지 저장 (서버 → local 반영)
- `setSelectedCompanyId(id)`: 현재 대화의 선택 회사 변경

### 4-3. themeStore

`localStorage['crm-theme']`에 `'dark' | 'light'` 저장.
`html` 태그에 `light` 클래스를 토글하여 테마 전환.

---

## 5. API 레이어

`src/api/index.ts`에 모든 API 함수가 집중됩니다.

**설계 원칙**:
- 함수 1개 = API 엔드포인트 1개
- 반환 타입은 `types/index.ts`의 인터페이스 사용
- 에러는 호출 측에서 try/catch 처리

**Base URL**: 환경변수 또는 기본값 `http://localhost:8080`

**인증**: axios interceptor로 자동 주입 (별도 설정 불필요)

```typescript
// 올바른 사용 예
const result = await askQuestion(companyId, questionText, topK);

// API 함수 시그니처 패턴
export const askQuestion = (
  companyId: number,
  questionText: string,
  topK: number,
): Promise<AskQuestionResponse> =>
  api.post(...).then((r) => r.data);
```

### 주요 API 함수 목록

| 함수 | 메서드 | 엔드포인트 |
|------|--------|-----------|
| `getCompanies` | GET | `/companies` |
| `searchCompanies(q)` | GET | `/companies/search?q=` |
| `createCompany(body)` | POST | `/companies` |
| `crawlCompany(id)` | POST | `/companies/:id/crawl` |
| `chatRespond(...)` | POST | `/chat/respond` |
| `getConversations` | GET | `/conversations` |
| `createConversationApi` | POST | `/conversations` |
| `addMessageApi(...)` | POST | `/conversations/:id/messages` |
| `login(email, pw)` | POST | `/auth/login` |
| `register(...)` | POST | `/auth/register` |
| `socialLogin(provider, body)` | POST | `/auth/social/:provider` |

---

## 6. 타입 시스템

`src/types/index.ts`에서 모든 공유 타입을 관리합니다.

### 핵심 타입

```typescript
// 채팅 메시지
interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  meta?: string;           // JSON 문자열: MsgMeta
  createdAt: string;
}

// meta 필드 파싱 결과
interface MsgMeta {
  label: string;           // 답변 라벨 (예: "카카오 심층분석")
  type: 'qa' | 'research' | 'compare';
  sources: Array<{ url: string; sourceType: string }>;
}

// AI 답변 출처
interface AnswerContext {
  sourceUrl: string | null;
  content?: string;
  source_type?: string;    // 'document' | 'news' | 'dart_info'
}

```

---

## 7. ChatPage 핵심 로직

### 인텐트 분기 흐름

```
사용자 입력
  └→ chatRespond(conversationId, message, true)
        └→ server가 intent 분류 + company preflight + 응답 생성 처리
```

### meta 직렬화

메시지 저장 시 출처를 `meta` JSON 문자열로 직렬화합니다:

```typescript
function buildMeta(
  type: 'qa' | 'research' | 'compare',
  label: string,
  contexts: AnswerContext[]
): string {
  const sources = contexts
    .filter((c) => c.sourceUrl)
    .map((c) => ({ url: c.sourceUrl!, sourceType: c.source_type ?? 'document' }));
  return JSON.stringify({ label, type, sources });
}
```

### meta 파싱

이전 plain 문자열 형식도 하위 호환 처리:

```typescript
function parseMeta(meta?: string): MsgMeta | null {
  if (!meta) return null;
  try {
    const parsed = JSON.parse(meta);
    if (parsed.type && parsed.sources) return parsed;
  } catch {}
  return null;  // 구형 형식은 null 반환
}
```

---

## 8. 컴포넌트 작성 규칙

### DO

```tsx
// CSS 변수 활용
<div className="bg-[var(--color-surface)] text-[var(--color-text)]">

// 타입 명시
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { ... }

// 조건부 클래스 (ternary)
className={`px-4 py-2 ${isActive ? 'bg-accent' : 'bg-surface'}`}
```

### DON'T

```tsx
// 인라인 스타일 지양 (테마 전환 불가)
<div style={{ backgroundColor: '#212121' }}>

// any 사용 금지
const data: any = response.data;

// 콘솔 로그 커밋 금지
console.log('debug:', data);
```

---

## 9. 로컬 개발

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

백엔드 URL 변경: `localStorage.setItem('crm-demo-api-base', 'http://localhost:8080')`

빌드:
```bash
npm run build     # dist/ 생성
npm run preview   # 빌드 결과 로컬 미리보기
```
