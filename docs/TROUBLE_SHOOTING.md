# 트러블슈팅 & 개선 기록

---

## 2026-04-06 ~ 2026-04-08

### [버그] React StrictMode에서 챗봇 안내 메시지 중복 출력

**문제**
관심 기업 카드 클릭 시 챗봇으로 이동하면 "회사명에 대해 무엇이 궁금하세요?" 메시지가 두 번 출력됨

**원인**
React StrictMode 환경에서 `useEffect`가 마운트 시 두 번 실행되는 특성 때문에 `addMessage`가 두 번 호출됨

**해결**
`useRef`로 실행 여부를 추적하는 가드 추가

```typescript
const greetHandledRef = useRef(false);

useEffect(() => {
  if (greetHandledRef.current) return;
  const greetCompany = (location.state as { greetCompany?: string } | null)?.greetCompany;
  if (!greetCompany) return;
  greetHandledRef.current = true;
  window.history.replaceState({}, '');
  addMessage({ role: 'system', content: `${greetCompany}에 대해 무엇이 궁금하세요?` });
}, []);
```

**파일**
- `frontend/src/pages/ChatPage.tsx`

---

### [개선] 관심 기업 페이지 UX 개선

#### 1. 가나다순 자동 정렬
**배경**
기업이 추가된 순서대로 표시되어 원하는 기업을 찾기 불편함

**해결**
`localeCompare('ko')`를 사용해 항상 가나다순으로 정렬

```typescript
const filtered = companies
  .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
```

#### 2. 더 보기 버튼 (10개 단위 표시)
**배경**
기업이 많아질 경우 한 화면에 전부 나열되면 스크롤이 길어짐. 페이지네이션은 클릭 부담이 있고, 개인 관심 기업 특성상 수십 개 이상으로 늘어날 가능성이 낮아 "더 보기" 방식 선택

**해결**
- 초기 10개만 표시
- "더 보기 (N개 남음)" 버튼 클릭 시 10개씩 추가
- 검색어 입력 시 visibleCount 초기화

#### 3. 카드 클릭 시 해당 회사 챗봇 연동
**배경**
관심 기업 카드를 클릭해도 아무 동작이 없었음. 상세 페이지를 별도로 만드는 방안도 검토했으나, 크롤링된 데이터는 이미 챗봇 RAG로 활용되고 있어 별도 뷰어 페이지는 불필요하다고 판단

**해결**
카드 클릭 시 React Router `state`로 회사명을 전달해 챗봇 페이지로 이동, 자동 분석 대신 안내 메시지만 표시해 사용자가 원하는 질문을 직접 입력하도록 유도

```typescript
// ExplorePage: 카드 클릭
onClick={() => navigate('/chat', { state: { greetCompany: company.name } })}

// ChatPage: 안내 메시지 표시
addMessage({ role: 'system', content: `${greetCompany}에 대해 무엇이 궁금하세요?` });
```

**파일**
- `frontend/src/pages/ExplorePage.tsx`
- `frontend/src/pages/ChatPage.tsx`

---

### [개선] Agent 시스템 프롬프트에서 미사용 도구 제거

**배경**
`tools.py`에서 `search_news` 도구가 이미 제거되어 있었으나, `agent_service.py`의 시스템 프롬프트에는 해당 도구 설명이 남아있었음. GPT가 존재하지 않는 도구를 호출하려 할 수 있어 혼란 유발 가능성 있음

**해결**
시스템 프롬프트에서 `search_news` 관련 설명 및 도구 선택 원칙 항목 제거

**파일**
- `ai-service/app/services/agent/agent_service.py`

---

## 2026-04-20

### [버그] `questions/ask`가 문서 검색 결과가 있어도 빈 컨텍스트로 응답하던 문제

**문제**
- `POST /companies/{companyId}/questions/ask` 호출 시 `200 OK`는 반환되지만, `contexts`가 비어 있고
- 답변도 `"먼저 회사 정보 수집(크롤링)을 진행해주세요."`로 떨어지는 경우가 있었음
- 같은 시점에 `POST /companies/{companyId}/documents/search`는 실제 문화 문서를 정상 반환하고 있었음

**원인**
- `QuestionService`에서 복지/조직문화 질문을 별도 처리할 때, 문맥 필터가 너무 공격적으로 동작하고 있었음
- `culture`, `about`, `careers` 문서가 실제로는 조직문화 질문에 유효한데도, 복지 전용 키워드에 직접 매칭되지 않으면 필터링 단계에서 제외됨
- 결과적으로 검색 결과는 존재해도 `questions/ask` 경로 안에서만 `contexts=[]`가 되어 RAG 프롬프트에 근거 문서가 안 들어갔음

**해결**
- 복지 관련 키워드에 `culture`, `people`, `문화`, `조직문화`를 추가
- 복지 키워드가 직접 잡히지 않아도 `culture/about/careers` 문서는 fallback 컨텍스트로 허용
- `sourceType`이 `culture/about/careers`인 경우도 복지성 문맥으로 인정하도록 보완

```java
private List<RagContextItem> filterWelfareContexts(List<RagContextItem> contexts) {
    List<RagContextItem> welfareLikeContexts = contexts.stream()
            .filter(this::isWelfareLikeContext)
            .toList();
    if (!welfareLikeContexts.isEmpty()) {
        return welfareLikeContexts;
    }

    List<RagContextItem> cultureLikeContexts = contexts.stream()
            .filter(this::isCultureLikeContext)
            .toList();
    if (!cultureLikeContexts.isEmpty()) {
        return cultureLikeContexts;
    }

    return contexts;
}
```

**검증**
- 수정 전:
  - `POST /companies/138/questions/ask` → `200`
  - 응답: `contexts=[]`
  - 답변: `"먼저 회사 정보 수집(크롤링)을 진행해주세요."`
- 수정 후:
  - 로컬 백엔드 재기동
  - 같은 요청 재호출
  - `prompt`에 `sourceType=culture` 문맥이 포함됨
  - 답변도 카카오 조직문화 항목을 실제 문서 기반으로 생성함

**파일**
- `backend/src/main/java/com/companyresearch/domain/question/service/QuestionService.java`

---

### [개선] 인증 실패 응답을 `400`에서 `401`로 정리

**문제**
- 잘못된 비밀번호로 로그인할 때 `POST /auth/login`이 `400`을 반환하고 있었음
- 로그아웃 후 `GET /auth/me` 호출도 `401`이 아니라 `400 "사용자를 찾을 수 없습니다."`로 내려오고 있었음

**원인**
- 로그인 실패와 비인증 상태를 `IllegalArgumentException`으로 처리하고 있었음
- 전역 예외 핸들러에서 `IllegalArgumentException`은 모두 `400 BAD_REQUEST`로 매핑되고 있어
- 인증 실패와 일반 요청 오류가 HTTP 레벨에서 구분되지 않았음

**해결**
- 인증 실패 전용 `UnauthorizedException`을 추가
- 전역 예외 핸들러에서 `UnauthorizedException`을 `401 UNAUTHORIZED`로 매핑
- `UserService.login()`의 로그인 실패와 `UserService.getCurrentUser()`의 비로그인/anonymous 상태를 `UnauthorizedException`으로 변경

```java
@ExceptionHandler(UnauthorizedException.class)
public ResponseEntity<ApiErrorResponse> handleUnauthorized(UnauthorizedException e) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ApiErrorResponse("UNAUTHORIZED", e.getMessage(), null));
}
```

**검증**
- 수정 전:
  - `POST /auth/login` 잘못된 비밀번호 → `400`
  - `POST /auth/logout` 후 `GET /auth/me` → `400`
- 수정 후:
  - `POST /auth/login` 잘못된 비밀번호 → `401`
  - `POST /auth/logout` 후 `GET /auth/me` → `401`

**파일**
- `backend/src/main/java/com/companyresearch/common/exception/UnauthorizedException.java`
- `backend/src/main/java/com/companyresearch/common/exception/GlobalExceptionHandler.java`
- `backend/src/main/java/com/companyresearch/domain/user/service/UserService.java`
- `backend/src/main/java/com/companyresearch/domain/user/controller/AuthController.java`
