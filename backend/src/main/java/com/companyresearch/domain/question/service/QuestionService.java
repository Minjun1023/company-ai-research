package com.companyresearch.domain.question.service;

import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.company.entity.Company;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.document.service.DocumentEmbeddingService;
import com.companyresearch.domain.question.dto.*;
import com.companyresearch.domain.question.entity.Question;
import com.companyresearch.domain.question.repository.QuestionRepository;
import com.companyresearch.domain.logging.service.ActivityLogService;
import com.companyresearch.infra.client.ai.AiServiceClient;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// 8단계 RAG: 질문 저장, 분류, 문서 검색, 프롬프트 구성, LLM 응답 생성.
@Service
public class QuestionService {

    private static final int DEFAULT_TOP_K = 5;
    private static final int MAX_TOP_K = 20;
    private static final int ANSWER_CONTEXT_MAX = 5;
    private static final int CONTEXT_SNIPPET_MAX_LENGTH = 1200;
    private static final int WELFARE_QUERY_TOP_K = 5;
    private static final String[] WELFARE_SOURCE_KEYWORDS = {
            "welfare",
            "benefit",
            "benefits",
            "culture",
            "people",
            "복지",
            "문화",
            "조직문화",
            "work-life",
            "워라밸",
            "워라벨",
            "연차",
            "육아휴직",
            "출산휴가",
            "복리후생",
            "worklife",
            "worklifebalance",
            "work-life balance",
            "wellness"
    };
    private static final String[] WELFARE_CONTENT_KEYWORDS = {
            "financial wellbeing",
            "time & refresh",
            "wellness",
            "work-life balance",
            "refresh",
            "culture",
            "people",
            "복지",
            "문화",
            "조직문화",
            "복리후생",
            "워라밸",
            "워라벨",
            "유연근무",
            "연차",
            "휴가",
            "육아휴직",
            "출산휴가",
            "근무환경"
    };
    private static final String[] WELFARE_QUESTION_KEYWORDS = {"복지", "워라밸", "워라벨", "혜택", "복리후생", "연차", "휴가", "유연근무", "근무환경"};
    private static final String[] WELFARE_SEARCH_QUERIES = {"복지", "benefits", "Financial Wellbeing", "Time & Refresh", "Wellness"};
    private static final String[] CAREERS_QUESTION_KEYWORDS = {"채용공고", "채용 공고", "채용정보", "채용 정보", "공고", "입사지원", "지원 방법", "채용 프로세스", "전형", "서류 전형", "지원하려면", "지원 자격", "모집 요강", "모집요강"};

    private final QuestionRepository questionRepository;
    private final CompanyRepository companyRepository;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final AiServiceClient aiServiceClient;
    private final ActivityLogService activityLogService;

    public QuestionService(QuestionRepository questionRepository,
                          CompanyRepository companyRepository,
                          DocumentEmbeddingService documentEmbeddingService,
                          AiServiceClient aiServiceClient,
                          ActivityLogService activityLogService) {
        this.questionRepository = questionRepository;
        this.companyRepository = companyRepository;
        this.documentEmbeddingService = documentEmbeddingService;
        this.aiServiceClient = aiServiceClient;
        this.activityLogService = activityLogService;
    }

    // 질문 저장 API: 분류만 수행한 뒤 DB에 질문만 저장한다.
    @Transactional
    public QuestionResponse createQuestion(Long companyId, CreateQuestionRequest request) {
        Company company = getCompanyOrThrow(companyId);
        String questionType = QuestionTypeClassifier.classify(request.getQuestionText());
        Question saved = questionRepository.save(Question.of(
                company.getId(),
                null,
                questionType,
                request.getQuestionText(),
                null,
                "company"
        ));
        return QuestionResponse.from(saved);
    }

    // 질문 + RAG: 문서 검색(top-k) → prompt 생성 → LLM 응답 호출.
    @Transactional
    public AskQuestionResponse answerQuestion(Long companyId, AskQuestionRequest request) {
        Company company = getCompanyOrThrow(companyId);
        String questionText = request.getQuestionText();
        String questionType = QuestionTypeClassifier.classify(questionText);
        int topK = normalizeTopK(request.getTopK());
        long start = System.currentTimeMillis();

        Question saved = questionRepository.save(Question.of(
                company.getId(),
                null,
                questionType,
                questionText,
                null,
                "document_search"
        ));

        boolean welfareQuestion = isWelfareQuestion(questionType, questionText);
        String sourceTypeFilter = isCareersQuestion(questionText) ? "careers" : null;
        List<DocumentSearchResponseItem> searchItems = searchQuestionDocuments(
                company.getId(),
                questionText,
                topK,
                welfareQuestion,
                sourceTypeFilter
        );
        List<RagContextItem> searchContexts = searchItems.stream()
                .map(RagContextItem::fromDocumentSearchItem)
                .toList();

        List<RagContextItem> filteredContexts = welfareQuestion ? filterWelfareContexts(searchContexts) : searchContexts;
        if (welfareQuestion && filteredContexts.isEmpty()) {
            filteredContexts = List.of();
        }

        List<RagContextItem> prioritizedContexts = prioritizeContexts(filteredContexts, welfareQuestion);
        activityLogService.logSearchResults(
                company.getId(),
                saved.getId(),
                ActivityLogService.REQUEST_TYPE_DOCUMENT_SEARCH,
                questionText,
                "document",
                searchItems
        );
        List<RagContextItem> contexts = prioritizedContexts.stream()
                .limit(ANSWER_CONTEXT_MAX)
                .toList();
        String ragPrompt = buildRagPrompt(company.getName(), questionType, questionText, contexts, request.getUserName());
        AiServiceClient.GenerateAnswerResult aiResult = aiServiceClient.generateAnswer(questionText, ragPrompt, contexts, company.getName(), company.getDartCorpCode());
        String answer = aiResult.answer();
        long latencyMs = System.currentTimeMillis() - start;
        saved.fillAnswer(answer);

        List<RagContextItem> externalContexts = resolveExternalContexts(
                aiResult.usedContexts(),
                contexts,
                welfareQuestion
        );

        activityLogService.logAiResponse(
                company.getId(),
                saved.getId(),
                ActivityLogService.REQUEST_TYPE_QUESTION_ASK,
                questionText,
                ragPrompt,
                answer,
                latencyMs
        );

        return new AskQuestionResponse(QuestionResponse.from(saved), ragPrompt, contexts, externalContexts);
    }

    // 회사별 질문 로그 조회: 추후 품질 개선/운영 지표에 사용.
    @Transactional(readOnly = true)
    public List<QuestionResponse> getQuestions(Long companyId) {
        getCompanyOrThrow(companyId);
        return questionRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)
                .stream()
                .map(QuestionResponse::from)
                .toList();
    }

    private Company getCompanyOrThrow(Long companyId) {
        return companyRepository.findById(companyId)
                .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + companyId));
    }

    private int normalizeTopK(Integer topK) {
        if (topK == null) {
            return DEFAULT_TOP_K;
        }
        if (topK < 1) {
            return 1;
        }
        return Math.min(topK, MAX_TOP_K);
    }

    private String buildRagPrompt(String companyName, String questionType, String question, List<RagContextItem> contexts, String userName) {
        StringBuilder builder = new StringBuilder();
        builder.append("당신은 회사 정보 분석 어시스턴트입니다.\n");
        builder.append(String.format(Locale.US, "회사명: %s\n", companyName));
        builder.append(String.format(Locale.US, "질문 유형: %s\n", questionType));
        if (userName != null && !userName.isBlank()) {
            builder.append(String.format(Locale.US, "사용자 이름: %s\n", userName));
            builder.append(String.format(Locale.US, "- 응답 시 사용자를 '%s 님'이라고 호칭한다.\n", userName));
        }
        builder.append("반드시 아래 제약을 지켜서 응답하세요.\n");
        builder.append("- 문서 콘텍스트에 있는 구체적인 항목명·제도명·표현을 그대로 사용해 답한다. 일반적인 표현으로 바꾸지 않는다.\n");
        builder.append("- 복지·문화 관련 질문은 문서에 명시된 항목(예: Financial Wellbeing, Time & Refresh, Wellness 등)을 항목별로 나열해 상세히 설명한다.\n");
        builder.append("- 연봉·재무 수치처럼 오류 시 문제가 되는 정보는 출처가 없으면 언급하지 않는다.\n");
        builder.append("- 문서·공식 출처에 없는 내용은 추측하거나 일반 지식으로 보완하지 않는다. 근거가 없으면 '확인된 정보 없음'으로 답한다.\n");
        builder.append("- 페이지 유형 우선순위: about > careers > culture > tech_blog > other\n\n");
        builder.append("질문: ").append(question == null ? "" : question).append("\n\n");
        builder.append("문서 콘텍스트:\n");

        for (int i = 0; i < contexts.size(); i++) {
            RagContextItem context = contexts.get(i);
            builder.append(String.format(Locale.US,
                    "[%d] source=%s sourceType=%s score=%s\n",
                    i + 1,
                    context.getSourceUrl(),
                    context.getSourceType(),
                    context.getScore()
            ));
            builder.append(context.getSnippet(CONTEXT_SNIPPET_MAX_LENGTH)).append("\n");
        }

        return builder.toString();
    }

    // 검색 결과를 페이지 유형 위주로 재정렬해 핵심 문맥 품질을 개선한다.
    private List<DocumentSearchResponseItem> searchQuestionDocuments(
            Long companyId,
            String questionText,
            int topK,
            boolean welfareQuestion,
            String sourceTypeFilter
    ) {
        List<DocumentSearchResponseItem> primary = documentEmbeddingService.searchSimilarEmbeddings(
                companyId,
                new DocumentSearchRequest(questionText, topK, sourceTypeFilter)
        );

        // careers 필터 적용 결과가 없으면, culture 문서만 제외하고 재검색 (fall-back)
        // 예) 네이버처럼 careers source_type 문서가 없는 회사 대응
        if (sourceTypeFilter != null && primary.isEmpty()) {
            List<DocumentSearchResponseItem> fallback = documentEmbeddingService.searchSimilarEmbeddings(
                    companyId,
                    new DocumentSearchRequest(questionText, topK)
            );
            primary = fallback.stream()
                    .filter(item -> !"culture".equals(item.getSourceType()))
                    .toList();
            // culture 제외 후에도 비어있으면 전체 결과 사용
            if (primary.isEmpty()) {
                primary = fallback;
            }
        }

        if (!welfareQuestion) {
            return primary;
        }

        Map<String, DocumentSearchResponseItem> merged = new LinkedHashMap<>();
        addSearchItems(merged, primary);

        for (String query : WELFARE_SEARCH_QUERIES) {
            addSearchItems(merged, documentEmbeddingService.searchSimilarEmbeddings(
                    companyId,
                    new DocumentSearchRequest(query, WELFARE_QUERY_TOP_K)
            ));
        }

        return new ArrayList<>(merged.values());
    }

    private void addSearchItems(
            Map<String, DocumentSearchResponseItem> merged,
            List<DocumentSearchResponseItem> items
    ) {
        for (DocumentSearchResponseItem item : items) {
            String key = item.getDocumentId() + ":" + item.getChunkIndex() + ":" + toText(item.getSourceUrl());
            merged.putIfAbsent(key, item);
        }
    }

    private List<RagContextItem> prioritizeContexts(List<RagContextItem> contexts, boolean welfareQuestion) {
        return contexts.stream()
                .sorted((first, second) -> {
                    if (welfareQuestion) {
                        int welfareDiff = Integer.compare(getWelfarePriority(second), getWelfarePriority(first));
                        if (welfareDiff != 0) {
                            return welfareDiff;
                        }
                    }

                    int sourceTypeDiff = Integer.compare(getSourceTypePriority(second.getSourceType()),
                            getSourceTypePriority(first.getSourceType()));
                    if (sourceTypeDiff != 0) {
                        return sourceTypeDiff;
                    }

                    double secondScore = second.getScore() == null ? Double.MIN_VALUE : second.getScore();
                    double firstScore = first.getScore() == null ? Double.MIN_VALUE : first.getScore();
                    return Double.compare(secondScore, firstScore);
                })
                .toList();
    }

    private int getWelfarePriority(RagContextItem context) {
        String sourceUrl = toText(context.getSourceUrl()).toLowerCase();
        String pageTitle = toText(context.getPageTitle()).toLowerCase();
        String content = toText(context.getContent()).toLowerCase();

        if (sourceUrl.contains("/benefits") || pageTitle.contains("benefits")) {
            return 3;
        }
        if (containsAny(content, WELFARE_CONTENT_KEYWORDS)) {
            return 2;
        }
        if (containsAny(sourceUrl, WELFARE_SOURCE_KEYWORDS) || containsAny(pageTitle, WELFARE_SOURCE_KEYWORDS)) {
            return 1;
        }
        return 0;
    }

    private int getSourceTypePriority(String sourceType) {
        if ("about".equals(sourceType)) {
            return 4;
        }
        if ("careers".equals(sourceType)) {
            return 3;
        }
        if ("culture".equals(sourceType)) {
            return 2;
        }
        if ("tech_blog".equals(sourceType)) {
            return 1;
        }
        return 0;
    }

    private boolean isCareersQuestion(String questionText) {
        if (questionText == null) {
            return false;
        }
        String normalized = questionText.toLowerCase();
        return containsAny(normalized, CAREERS_QUESTION_KEYWORDS);
    }

    private boolean isWelfareQuestion(String questionType, String questionText) {
        if ("welfare".equals(questionType)) {
            return true;
        }
        if (questionText == null) {
            return false;
        }
        String normalized = questionText.toLowerCase();
        return containsAny(normalized, WELFARE_QUESTION_KEYWORDS);
    }

    private List<RagContextItem> filterWelfareContexts(List<RagContextItem> contexts) {
        List<RagContextItem> welfareLikeContexts = contexts.stream()
                .filter(this::isWelfareLikeContext)
                .toList();
        if (!welfareLikeContexts.isEmpty()) {
            return welfareLikeContexts;
        }

        // Fallback: welfare-specific 키워드가 직접 잡히지 않아도
        // culture/about/careers 계열 문서는 조직문화/근무환경 질문에 유효한 근거가 된다.
        List<RagContextItem> cultureLikeContexts = contexts.stream()
                .filter(this::isCultureLikeContext)
                .toList();
        if (!cultureLikeContexts.isEmpty()) {
            return cultureLikeContexts;
        }

        return contexts;
    }

    private List<RagContextItem> resolveExternalContexts(
            List<Map<String, Object>> usedContexts,
            List<RagContextItem> fallbackContexts,
            boolean welfareQuestion
    ) {
        if (usedContexts == null) {
            usedContexts = List.of();
        }
        List<RagContextItem> converted = usedContexts.stream()
                .filter(context -> context.get("sourceUrl") != null && !String.valueOf(context.get("sourceUrl")).isBlank())
                .map(context -> {
                    String sourceUrl = String.valueOf(context.get("sourceUrl")).trim();
                    String sourceType = firstNonBlank(
                            toText(context.get("source_type")),
                            toText(context.get("sourceType"))
                    );
                    String content = toText(context.get("content"));
                    return new RagContextItem(null, null, sourceUrl, null, sourceType, content, null);
                })
                .toList();

        if (!welfareQuestion) {
            return converted;
        }

        List<RagContextItem> welfareFiltered = converted.stream()
                .filter(this::isWelfareLikeContext)
                .toList();
        if (!welfareFiltered.isEmpty()) {
            return welfareFiltered;
        }

        List<RagContextItem> fallback = fallbackContexts.stream()
                .filter(this::isWelfareLikeContext)
                .toList();
        return fallback.isEmpty() ? converted : fallback;
    }

    private boolean isWelfareLikeContext(RagContextItem context) {
        String sourceUrl = toText(context.getSourceUrl()).toLowerCase();
        String pageTitle = toText(context.getPageTitle()).toLowerCase();
        String content = toText(context.getContent()).toLowerCase();
        String sourceType = toText(context.getSourceType()).toLowerCase();

        if (isCultureSourceType(sourceType)) {
            return true;
        }

        if (containsAny(sourceUrl, WELFARE_SOURCE_KEYWORDS) || containsAny(pageTitle, WELFARE_SOURCE_KEYWORDS)) {
            return true;
        }

        return containsAny(content, WELFARE_CONTENT_KEYWORDS);
    }

    private boolean isCultureLikeContext(RagContextItem context) {
        String sourceType = toText(context.getSourceType()).toLowerCase();
        if (isCultureSourceType(sourceType)) {
            return true;
        }

        String sourceUrl = toText(context.getSourceUrl()).toLowerCase();
        String pageTitle = toText(context.getPageTitle()).toLowerCase();
        return sourceUrl.contains("culture")
                || sourceUrl.contains("people")
                || pageTitle.contains("문화")
                || pageTitle.contains("culture");
    }

    private boolean isCultureSourceType(String sourceType) {
        return "culture".equals(sourceType)
                || "about".equals(sourceType)
                || "careers".equals(sourceType);
    }

    private boolean containsAny(String text, String[] keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String toText(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }
}
