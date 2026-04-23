# Service Readiness Plan

이 문서는 현재 프로젝트를 개인 실험용 AI 앱에서 실제 서비스 운영이 가능한 구조로 전환하기 위한 리팩터링 계획을 정리합니다.

핵심 목표는 세 가지입니다.

- 토큰 비용을 줄인다.
- 응답 경로를 단순화한다.
- 운영 중 품질과 안정성을 통제할 수 있게 만든다.

---

## 1. 현재 상태 요약

현재 구조는 다음 요소를 이미 갖추고 있습니다.

- RAG: 회사 문서, DART, 뉴스 기반 컨텍스트 결합
- Agent/tool use: 문서 검색, DART 조회, 뉴스 검색 도구 호출
- Structured workflow: 질문 분류, 검색, 병합, 답변 생성 분기
- 기본 guardrail: 길이 제한, 일부 프롬프트 인젝션 차단, 수치 응답 제약

반면 서비스화 관점에서 부족한 부분은 다음과 같습니다.

- 모든 요청에 agent 수준의 비용을 쓰기 쉬운 구조
- 캐시 전략 부재
- 긴 컨텍스트를 그대로 주입하는 경향
- 프롬프트 의존도가 높은 guardrail
- 기능별 토큰/비용 측정 부재

즉, "잘 동작하는 AI 프로토타입"으로는 의미가 있지만, "비용 효율적인 서비스"로는 아직 정리가 필요합니다.

---

## 2. 목표 구조

서비스화 이후의 목표 구조는 다음과 같습니다.

1. 기본 질문은 경량 경로로 처리한다.
2. 복합 질문만 agent/tool 경로로 보낸다.
3. 회사별 요약 정보와 외부 API 응답을 캐시한다.
4. 긴 문서 원문 대신 압축된 facts/summary를 우선 사용한다.
5. 입력/출력/도구 호출에 대한 guardrail을 코드 레벨에서 강화한다.
6. 요청 유형별 비용과 실패율을 측정한다.

한 줄로 요약하면:

`모든 요청을 똑똑하게 처리하는 시스템`에서  
`대부분의 요청을 싸게 처리하고 일부만 깊게 처리하는 시스템`으로 전환하는 계획입니다.

---

## 3. 단계별 리팩터링 계획

### Phase 1. QA 경량화

목표:

- 모든 질문이 agent로 가지 않도록 분기한다.
- 단순 QA 비용을 즉시 줄인다.

대상 파일:

- `ai-service/app/services/qa/answer_service.py`
- `ai-service/app/services/agent/agent_service.py`
- `ai-service/app/services/intent/intent_classifier.py`

작업:

- 단순 질문용 `direct_answer` 경로 추가
- 질문 유형별로 `document`, `dart`, `news`, `agent` 경로 분리
- agent 사용 조건을 명시적으로 관리

완료 기준:

- 단순 회사 소개/복지 질문은 agent 없이 처리
- 복합 질문과 다중 소스 질문만 agent 사용

기대 효과:

- 평균 요청 비용 감소
- 응답 속도 개선
- agent 실패 경로 감소

---

### Phase 2. 외부 데이터 캐시

목표:

- 같은 회사에 대한 반복 조회 비용을 줄인다.
- 외부 API 의존성을 완화한다.

대상 파일:

- `ai-service/app/services/jobs/dart_service.py`
- `ai-service/app/services/news/naver_news_service.py`
- `ai-service/app/services/search/naver_search_service.py`
- 필요 시 `backend` 서비스 계층

작업:

- 메모리 TTL 캐시 추가
- DART 회사 정보 캐시
- 뉴스 검색 결과 캐시
- 회사 URL 검색 결과 캐시

완료 기준:

- 동일 회사 반복 질문 시 외부 API 재호출 빈도 감소
- 캐시 hit/miss 로그 확인 가능

기대 효과:

- 비용 절감
- 외부 API 지연 감소
- 동일 요청 응답 안정성 향상

---

### Phase 3. 컨텍스트 압축

목표:

- 입력 토큰을 줄인다.
- 긴 문서 주입을 줄이고 요약 중심 구조로 바꾼다.

대상 파일:

- `ai-service/app/services/graph/rag_graph.py`
- `ai-service/app/services/research/research_service.py`
- `ai-service/app/services/comparison/compare_service.py`
- `backend/src/main/java/com/companyresearch/domain/question/service/QuestionService.java`
- `backend/src/main/java/com/companyresearch/domain/document/service/DocumentEmbeddingService.java`

작업:

- topK 축소
- 청크 길이 재조정
- 회사별 summary/facts 레이어 추가
- 비교/리서치에는 원문 대신 요약 컨텍스트 우선 사용

완료 기준:

- 요청당 입력 토큰 감소
- 품질 하락 없이 응답 구조 유지

기대 효과:

- 비용 절감
- 긴 요청에서 모델 안정성 향상

---

### Phase 4. Guardrail 강화

목표:

- 프롬프트 의존을 줄이고 코드 레벨 통제를 강화한다.

대상 파일:

- `ai-service/app/api/qa.py`
- `ai-service/app/services/agent/tools.py`
- `ai-service/app/services/agent/agent_service.py`
- 필요 시 `backend` 입력 검증 계층

작업:

- 질문 유형별 허용 도구 제한
- 수치 응답은 DART 근거 여부 검증
- 출처 없는 응답 후처리
- 출력 길이와 형식 검증

완료 기준:

- 근거 없는 수치 응답 감소
- 불필요한 tool 호출 감소
- 잘못된 형식 응답 감소

기대 효과:

- 품질 안정성 향상
- 운영 리스크 감소

---

### Phase 5. 비용/품질 관측

목표:

- 어디서 비용이 새는지 보이게 만든다.
- 운영 전 기준 지표를 확보한다.

대상 파일:

- `backend/src/main/java/com/companyresearch/domain/question/service/QuestionService.java`
- `backend/src/main/java/com/companyresearch/domain/chat/controller/ChatController.java`
- `ai-service/app/services/agent/agent_service.py`
- `ai-service` 각 API 엔드포인트

작업:

- 요청 유형별 실행 시간 로그
- agent 호출 횟수 로그
- 캐시 hit/miss 로그
- 모델 호출 input/output token 로그

최소 추적 지표:

- 요청당 input/output token
- 기능별 평균 비용
- agent 진입률
- 캐시 hit rate
- 실패율

완료 기준:

- 기능별 비용 분석 가능
- 고비용 경로 식별 가능

기대 효과:

- 최적화 우선순위가 명확해짐
- 서비스 운영 판단 가능

---

## 4. 권장 실행 순서

실행 순서는 다음이 가장 현실적입니다.

1. QA 경량화
2. 외부 데이터 캐시
3. 컨텍스트 압축
4. Guardrail 강화
5. 비용/품질 관측

이 순서가 적절한 이유:

- 1~3단계만으로도 비용과 응답 속도에 즉시 효과가 있다.
- guardrail은 구조가 단순해진 뒤 넣는 편이 유지보수가 쉽다.
- 관측은 처음부터 있으면 좋지만, 최소한 위 구조 변경과 함께 들어가야 의미가 있다.

---

## 5. 서비스화 전환 기준

아래 기준을 만족하면 "프로토타입"에서 "서비스 후보"로 넘어갈 수 있습니다.

- 단순 QA가 agent 없이 안정적으로 동작한다.
- 반복 질문에서 캐시가 실제로 동작한다.
- 비교/리서치 요청의 입력 토큰이 관리 가능한 수준으로 줄어든다.
- 수치 응답이 근거 기반으로만 출력된다.
- 기능별 비용과 실패율을 추적할 수 있다.

---

## 6. 현재 프로젝트에 대한 판단

현재 프로젝트는 다음 상태로 볼 수 있습니다.

- RAG: 강함
- Agent/tool use: 있음
- Structured workflow: 꽤 잘 갖춰짐
- Caching: 약함
- Guardrails: 기본 수준
- Observability: 부족

따라서 다음 작업의 초점은 "새 기능 추가"보다 아래 두 가지에 맞춰야 합니다.

- 비용이 낮은 기본 경로 만들기
- 운영 가능한 통제 지점 만들기

이 문서는 서비스화 관련 리팩터링 작업의 기준 문서로 사용합니다.
