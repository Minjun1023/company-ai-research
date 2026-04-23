package com.companyresearch.domain.chat.service;

import com.companyresearch.domain.chat.entity.Conversation;
import com.companyresearch.domain.chat.entity.ConversationArtifact;
import com.companyresearch.domain.chat.entity.ConversationMessage;
import com.companyresearch.domain.chat.entity.ConversationMode;
import com.companyresearch.domain.chat.entity.ConversationSessionType;
import com.companyresearch.domain.chat.repository.ConversationMessageRepository;
import com.companyresearch.domain.chat.repository.ConversationRepository;
import com.companyresearch.domain.company.dto.CompanyCrawlResponse;
import com.companyresearch.domain.company.dto.CompanyResponse;
import com.companyresearch.domain.company.dto.CompanySearchResult;
import com.companyresearch.domain.company.dto.CreateCompanyRequest;
import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.company.entity.Company;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.company.service.CompanyService;
import com.companyresearch.domain.company.service.CoverLetterFeedbackService;
import com.companyresearch.domain.company.service.InterviewService;
import com.companyresearch.domain.company.service.ResearchService;
import com.companyresearch.domain.document.service.DocumentEmbeddingService;
import com.companyresearch.domain.question.dto.AskQuestionRequest;
import com.companyresearch.domain.question.dto.AskQuestionResponse;
import com.companyresearch.domain.question.dto.RagContextItem;
import com.companyresearch.domain.question.service.QuestionService;
import com.companyresearch.domain.user.entity.User;
import com.companyresearch.domain.user.repository.UserRepository;
import com.companyresearch.infra.client.ai.AiServiceClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class ChatRespondService {

    private static final int DEFAULT_TOP_K = 10;
    private static final int COMPANY_CONTEXT_TOP_K = 3;
    private static final DateTimeFormatter ISO_DATE_TIME = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final Pattern NEWS_PATTERN = Pattern.compile("뉴스|동향|채용\\s*시장|업계\\s*소식|트렌드|이슈");
    private static final Pattern TRAILING_PUNCTUATION_PATTERN = Pattern.compile("[?.!]+$");
    private static final Set<String> PLACEHOLDER_NAMES = Set.of("회사명", "회사명a", "회사명b", "직군", "[회사명]", "[직군]");

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository conversationMessageRepository;
    private final ConversationService conversationService;
    private final ConversationArtifactService conversationArtifactService;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final CompanyService companyService;
    private final QuestionService questionService;
    private final ComparisonService comparisonService;
    private final ResearchService researchService;
    private final InterviewService interviewService;
    private final CoverLetterFeedbackService coverLetterFeedbackService;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;

    public ChatRespondService(
            ConversationRepository conversationRepository,
            ConversationMessageRepository conversationMessageRepository,
            ConversationService conversationService,
            ConversationArtifactService conversationArtifactService,
            UserRepository userRepository,
            CompanyRepository companyRepository,
            CompanyService companyService,
            QuestionService questionService,
            ComparisonService comparisonService,
            ResearchService researchService,
            InterviewService interviewService,
            CoverLetterFeedbackService coverLetterFeedbackService,
            DocumentEmbeddingService documentEmbeddingService,
            AiServiceClient aiServiceClient,
            ObjectMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.conversationMessageRepository = conversationMessageRepository;
        this.conversationService = conversationService;
        this.conversationArtifactService = conversationArtifactService;
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.companyService = companyService;
        this.questionService = questionService;
        this.comparisonService = comparisonService;
        this.researchService = researchService;
        this.interviewService = interviewService;
        this.coverLetterFeedbackService = coverLetterFeedbackService;
        this.documentEmbeddingService = documentEmbeddingService;
        this.aiServiceClient = aiServiceClient;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ChatRespondResult respond(Long conversationId, String message, boolean persistUserMessage) {
        User user = getCurrentUser();
        Conversation conversation = getConversation(conversationId, user.getId());

        ConversationMessage userMessage = persistUserMessage
                ? conversationService.addMessage(conversationId, "user", message, null)
                : null;
        String transientUserMessage = persistUserMessage ? null : message;
        RouteResult routeResult = routeConversation(conversation, user, message, transientUserMessage);

        String modeState = routeResult.modeState() == null ? "" : routeResult.modeState();
        Conversation updatedConversation = conversationService.updateConversation(
                conversationId,
                null,
                null,
                routeResult.selectedCompanyId(),
                routeResult.mode(),
                modeState
        );
        ConversationMessage assistantMessage = conversationService.addMessage(
                conversationId,
                "assistant",
                routeResult.answer(),
                routeResult.meta()
        );
        ConversationArtifact artifact = conversationArtifactService.saveFromAssistantMessage(updatedConversation, assistantMessage);

        Conversation finalConversation = conversationRepository.findById(updatedConversation.getId())
                .orElse(updatedConversation);
        return new ChatRespondResult(finalConversation, userMessage, assistantMessage, artifact);
    }

    private RouteResult routeConversation(Conversation conversation, User user, String message, String transientUserMessage) {
        String currentMode = ConversationMode.normalize(conversation.getMode());
        if (isContinuationMode(currentMode)) {
            IntentRoute intentRoute = refineContinuationIntent(currentMode, message, resolveIntentRoute(conversation, message));
            if (shouldInterruptContinuation(currentMode, message, intentRoute)) {
                return startConversationFlow(
                        conversation,
                        user,
                        message,
                        intentRoute.intent(),
                        intentRoute.companyName(),
                        intentRoute.companyNames()
                );
            }
            return continueConversation(conversation, user, message, transientUserMessage);
        }
        return startConversationFlow(conversation, user, message);
    }

    private IntentRoute refineContinuationIntent(String currentMode, String message, IntentRoute intentRoute) {
        if (ConversationMode.COVERLETTER_CONSULT.value().equals(currentMode)
                && isCoverletterFeedbackCue(message)
                && !"feedback".equals(defaultString(intentRoute.intent()))) {
            return new IntentRoute("feedback", intentRoute.companyName(), intentRoute.companyNames());
        }
        return intentRoute;
    }

    private boolean isContinuationMode(String mode) {
        return switch (ConversationMode.normalize(mode)) {
            case "compare",
                 "interview_prep",
                 "interview_practice",
                 "coverletter_consult",
                 "coverletter_feedback",
                 "salary_consult",
                 "company_selection",
                 "company_url_input" -> true;
            default -> false;
        };
    }

    private RouteResult continueConversation(Conversation conversation, User user, String message, String transientUserMessage) {
        String mode = ConversationMode.normalize(conversation.getMode());
        JsonNode state = readState(conversation.getModeState());

        return switch (mode) {
            case "compare" -> continueCompare(conversation, user, message, state);
            case "interview_prep" -> continueInterviewPrep(conversation, user, state, transientUserMessage);
            case "interview_practice" -> continueInterviewPractice(conversation, state, transientUserMessage);
            case "coverletter_consult" -> continueCoverletterConsult(conversation, user, state, transientUserMessage);
            case "coverletter_feedback" -> continueCoverletterFeedback(conversation, state, message);
            case "salary_consult" -> continueSalaryConsult(conversation, user, state, transientUserMessage);
            case "company_selection" -> continueCompanySelection(conversation, user, message, state);
            case "company_url_input" -> continueCompanyUrlInput(conversation, user, message, state);
            default -> startConversationFlow(conversation, user, message);
        };
    }

    private RouteResult startConversationFlow(Conversation conversation, User user, String message) {
        IntentRoute intentRoute = resolveIntentRoute(conversation, message);
        return startConversationFlow(
                conversation,
                user,
                message,
                intentRoute.intent(),
                intentRoute.companyName(),
                intentRoute.companyNames()
        );
    }

    private RouteResult startConversationFlow(
            Conversation conversation,
            User user,
            String message,
            String intent,
            String companyName,
            List<String> companyNames
    ) {
        PreflightResult preflightResult = preflightCompanies(conversation, user, message, intent, companyName, companyNames);
        if (preflightResult.routeResult() != null) {
            return preflightResult.routeResult();
        }
        companyName = preflightResult.companyName();
        companyNames = preflightResult.companyNames();

        return switch (intent) {
            case "compare" -> startCompare(conversation, user, message, companyNames);
            case "research" -> startResearch(conversation, user, companyName);
            case "interview" -> startInterviewPrep(conversation, user, companyName);
            case "interview_practice" -> startInterviewPractice(conversation, user, companyName);
            case "coverletter" -> startCoverletterConsult(conversation, user, companyName);
            case "feedback" -> startCoverletterFeedback(conversation, user, message, companyName);
            case "salary" -> startSalaryConsult(conversation, user, message, companyName);
            case "crawl" -> refreshCompanyInfo(conversation, user, companyName);
            default -> startQaOrGeneral(conversation, user, message, companyName);
        };
    }

    private IntentRoute resolveIntentRoute(Conversation conversation, String message) {
        IntentRoute classified = classifyIntentRoute(message);
        String sessionType = conversation.getSessionType();

        if (ConversationSessionType.GENERAL.value().equals(sessionType)) {
            return classified;
        }

        return switch (sessionType) {
            case "research" -> resolveResearchIntentRoute(conversation, classified);
            case "compare" -> new IntentRoute("compare", classified.companyName(), classified.companyNames());
            case "interview" -> resolveInterviewIntentRoute(classified);
            case "coverletter" -> resolveCoverletterIntentRoute(classified, message);
            case "salary" -> new IntentRoute("salary", classified.companyName(), classified.companyNames());
            default -> classified;
        };
    }

    private IntentRoute resolveResearchIntentRoute(Conversation conversation, IntentRoute classified) {
        String intent = defaultString(classified.intent());
        if ("crawl".equals(intent)) {
            return classified;
        }
        if ("research".equals(intent)) {
            return new IntentRoute("research", classified.companyName(), classified.companyNames());
        }
        if (conversation.getSelectedCompanyId() == null) {
            return new IntentRoute("research", classified.companyName(), classified.companyNames());
        }
        return new IntentRoute("qa", classified.companyName(), classified.companyNames());
    }

    private IntentRoute resolveInterviewIntentRoute(IntentRoute classified) {
        if ("interview_practice".equals(defaultString(classified.intent()))) {
            return new IntentRoute("interview_practice", classified.companyName(), classified.companyNames());
        }
        return new IntentRoute("interview", classified.companyName(), classified.companyNames());
    }

    private IntentRoute resolveCoverletterIntentRoute(IntentRoute classified, String message) {
        if ("feedback".equals(defaultString(classified.intent())) || isCoverletterFeedbackCue(message)) {
            return new IntentRoute("feedback", classified.companyName(), classified.companyNames());
        }
        return new IntentRoute("coverletter", classified.companyName(), classified.companyNames());
    }

    private IntentRoute classifyIntentRoute(String message) {
        Map<String, Object> intentResult = aiServiceClient.classifyIntent(message);
        String intent = String.valueOf(intentResult.getOrDefault("intent", "qa"));
        String companyName = trimToNull((String) intentResult.get("company_name"));
        List<String> companyNames = intentResult.get("company_names") instanceof List<?>
                ? ((List<?>) intentResult.get("company_names")).stream().map(String::valueOf).toList()
                : List.of();
        return new IntentRoute(intent, companyName, companyNames);
    }

    private boolean shouldInterruptContinuation(String currentMode, String message, IntentRoute intentRoute) {
        if ("company_url_input".equals(currentMode)) {
            String trimmed = trimToNull(message);
            if (trimmed != null && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
                return false;
            }
        }
        if ("company_selection".equals(currentMode)) {
            String trimmed = defaultString(message).trim();
            if (isAffirmative(message) || isNegative(message) || wantsDirectUrlInput(message) || trimmed.matches("\\d+")) {
                return false;
            }
        }
        if (ConversationMode.COMPARE.value().equals(currentMode)
                && "qa".equals(defaultString(intentRoute.intent()))
                && !hasModeSwitchCue(message)) {
            return false;
        }

        String nextMode = modeForIntent(intentRoute.intent(), intentRoute.companyName(), intentRoute.companyNames(), message);
        if (nextMode == null || nextMode.equals(currentMode)) {
            return false;
        }
        return isExplicitNewTaskRequest(message, intentRoute);
    }

    private String modeForIntent(String intent, String companyName, List<String> companyNames, String message) {
        return switch (defaultString(intent)) {
            case "compare" -> ConversationMode.COMPARE.value();
            case "research" -> ConversationMode.RESEARCH.value();
            case "interview" -> ConversationMode.INTERVIEW_PREP.value();
            case "interview_practice" -> ConversationMode.INTERVIEW_PRACTICE.value();
            case "coverletter" -> ConversationMode.COVERLETTER_CONSULT.value();
            case "feedback" -> ConversationMode.COVERLETTER_FEEDBACK.value();
            case "salary" -> ConversationMode.SALARY_CONSULT.value();
            case "crawl", "qa" -> {
                if (sanitizeCompanyName(companyName) != null) {
                    yield ConversationMode.QA.value();
                }
                if (companyNames != null && companyNames.size() >= 2) {
                    yield ConversationMode.COMPARE.value();
                }
                if (NEWS_PATTERN.matcher(defaultString(message)).find()) {
                    yield ConversationMode.NEWS_AGENT.value();
                }
                yield ConversationMode.GENERAL.value();
            }
            default -> null;
        };
    }

    private boolean isExplicitNewTaskRequest(String message, IntentRoute intentRoute) {
        String intent = defaultString(intentRoute.intent());
        if (hasModeSwitchCue(message)) {
            return true;
        }
        return switch (intent) {
            case "compare",
                 "research",
                 "interview",
                 "interview_practice",
                 "coverletter",
                 "feedback",
                 "salary",
                 "crawl" -> true;
            case "qa" -> sanitizeCompanyName(intentRoute.companyName()) != null || NEWS_PATTERN.matcher(defaultString(message)).find();
            default -> false;
        };
    }

    private boolean hasModeSwitchCue(String message) {
        String normalized = normalize(message);
        return normalized.contains("말고")
                || normalized.contains("대신")
                || normalized.contains("이제")
                || normalized.contains("바꿔")
                || normalized.contains("전환")
                || normalized.contains("새로")
                || normalized.contains("다른모드")
                || normalized.contains("중단")
                || normalized.contains("그만");
    }

    private boolean isCoverletterFeedbackCue(String message) {
        String normalized = normalize(message);
        return normalized.contains("피드백")
                || normalized.contains("첨삭")
                || normalized.contains("교정")
                || normalized.contains("검토");
    }

    private PreflightResult preflightCompanies(
            Conversation conversation,
            User user,
            String originalMessage,
            String intent,
            String companyName,
            List<String> companyNames
    ) {
        if ("compare".equals(intent)) {
            List<String> normalizedNames = new ArrayList<>();
            for (String rawName : companyNames) {
                EnsureCompanyResult ensured = ensureCompanyReadyOrPrompt(conversation, user, originalMessage, intent, rawName);
                if (ensured.routeResult() != null) {
                    return new PreflightResult(ensured.routeResult(), companyName, companyNames);
                }
                if (ensured.company() != null) {
                    normalizedNames.add(ensured.company().getName());
                }
            }
            return new PreflightResult(null, companyName, normalizedNames);
        }

        if (needsCompanyPreflight(intent)) {
            String extractedName = sanitizeCompanyName(companyName);
            if (extractedName != null) {
                EnsureCompanyResult ensured = ensureCompanyReadyOrPrompt(conversation, user, originalMessage, intent, extractedName);
                if (ensured.routeResult() != null) {
                    return new PreflightResult(ensured.routeResult(), companyName, companyNames);
                }
                if (ensured.company() != null) {
                    companyName = ensured.company().getName();
                }
            }
        }

        return new PreflightResult(null, companyName, companyNames);
    }

    private boolean needsCompanyPreflight(String intent) {
        return switch (defaultString(intent)) {
            case "research",
                 "interview",
                 "interview_practice",
                 "coverletter",
                 "feedback",
                 "salary",
                 "crawl",
                 "qa" -> true;
            default -> false;
        };
    }

    private EnsureCompanyResult ensureCompanyReadyOrPrompt(
            Conversation conversation,
            User user,
            String originalMessage,
            String intent,
            String rawCompanyName
    ) {
        String companyName = sanitizeCompanyName(rawCompanyName);
        if (companyName == null) {
            return new EnsureCompanyResult(null, null);
        }
        if (isPlaceholderName(companyName)) {
            return new EnsureCompanyResult(
                    null,
                    simpleResult(
                            "'" + companyName + "'은(는) 실제 회사명이 아닙니다. 회사명을 다시 입력해 주세요. 예) 카카오",
                            ConversationMode.IDLE.value(),
                            null,
                            null,
                            conversation.getSelectedCompanyId()
                    )
            );
        }

        Company existing = resolveCompanyByName(user.getId(), companyName);
        if (existing != null) {
            ensureCompanyCrawledIfNeeded(existing);
            return new EnsureCompanyResult(existing, null);
        }

        List<CompanySearchResult> candidates = effectiveCandidates(companyName);
        String normalizedName = normalize(companyName);

        if (candidates.isEmpty()) {
            return new EnsureCompanyResult(null, buildCompanyUrlInputPrompt(conversation, originalMessage, intent, companyName));
        }

        if (candidates.size() == 1 && normalize(candidates.get(0).getName()).equals(normalizedName)) {
            Company created = createAndCrawlCompany(user.getId(), candidates.get(0).getName(), defaultString(candidates.get(0).getWebsite()));
            if (created != null) {
                return new EnsureCompanyResult(created, null);
            }
            return new EnsureCompanyResult(null, buildCompanyUrlInputPrompt(conversation, originalMessage, intent, companyName));
        }

        return new EnsureCompanyResult(null, buildCompanySelectionPrompt(conversation, originalMessage, intent, companyName, candidates));
    }

    private RouteResult startCompare(Conversation conversation, User user, String message, List<String> companyNames) {
        if (companyNames.size() < 2) {
            return simpleResult(
                    "비교할 회사 이름을 2개 이상 포함해 주세요. 예) \"카카오와 네이버 복지를 비교해줘\"",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    null
            );
        }

        List<Company> companies = resolveCompanies(user.getId(), companyNames);
        if (companies.size() < 2) {
            return simpleResult(
                    "등록된 회사 기준으로 비교 대상을 모두 찾지 못했습니다. 먼저 관심 회사에 추가하거나 회사명을 다시 확인해 주세요.",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    null
            );
        }

        companies.forEach(this::ensureCompanyCrawledIfNeeded);

        ComparisonService.CompareResponse result = comparisonService.compare(
                companies.stream().map(Company::getId).toList(),
                withProfile(user, message, true)
        );

        ObjectNode modeState = objectMapper.createObjectNode();
        ArrayNode ids = modeState.putArray("companyIds");
        ArrayNode names = modeState.putArray("companyNames");
        for (Company company : companies) {
            ids.add(company.getId());
            names.add(company.getName());
        }

        return new RouteResult(
                result.answer(),
                buildMeta(
                        companies.stream().map(Company::getName).reduce((a, b) -> a + " vs " + b).orElse("비교"),
                        "compare",
                        result.externalContexts(),
                        null
                ),
                ConversationMode.COMPARE.value(),
                modeState.toString(),
                conversation.getSelectedCompanyId()
        );
    }

    private RouteResult continueCompare(Conversation conversation, User user, String message, JsonNode state) {
        List<Long> companyIds = longValues(state.path("companyIds"));
        if (companyIds.size() < 2) {
            return simpleResult(
                    "비교 대상을 복원하지 못했습니다. 다시 비교 요청을 시작해 주세요.",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        ComparisonService.CompareResponse result = comparisonService.compare(companyIds, withProfile(user, message, true));
        List<Company> companies = companyRepository.findAllById(companyIds).stream()
                .sorted(Comparator.comparingInt(c -> companyIds.indexOf(c.getId())))
                .toList();

        return new RouteResult(
                result.answer(),
                buildMeta(
                        companies.stream().map(Company::getName).reduce((a, b) -> a + " vs " + b).orElse("비교"),
                        "compare",
                        result.externalContexts(),
                        null
                ),
                ConversationMode.COMPARE.value(),
                state.toString(),
                conversation.getSelectedCompanyId()
        );
    }

    private RouteResult startResearch(Conversation conversation, User user, String companyName) {
        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        if (company == null) {
            return simpleResult(
                    "분석할 회사명을 입력해 주세요. 예) 카카오 심층 분석해줘",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        ensureCompanyCrawledIfNeeded(company);
        ResearchService.ResearchResponse result = researchService.research(company.getId());

        return new RouteResult(
                result.answer(),
                buildMeta(company.getName() + " 심층 분석", "research", result.externalContexts(), company),
                ConversationMode.QA.value(),
                buildSingleCompanyState(company, "qa"),
                company.getId()
        );
    }

    private RouteResult startInterviewPrep(Conversation conversation, User user, String companyName) {
        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        if (company == null) {
            return simpleResult(
                    "면접 준비할 회사명을 입력해 주세요. 예) 카카오 면접 준비해줘",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        ensureCompanyCrawledIfNeeded(company);
        InterviewService.InterviewResponse result = interviewService.prepareInterview(company.getId(), defaultString(user.getResumeText()));

        return new RouteResult(
                result.answer(),
                buildMeta(company.getName() + " 면접 준비", "interview", result.externalContexts(), company),
                ConversationMode.INTERVIEW_PREP.value(),
                buildSingleCompanyState(company, "in_progress"),
                company.getId()
        );
    }

    private RouteResult continueInterviewPrep(Conversation conversation, User user, JsonNode state, String transientUserMessage) {
        Company company = resolveCompanyFromState(conversation, state);
        List<Map<String, String>> history = buildConversationHistory(conversation.getId(), user, true, transientUserMessage);
        List<Map<String, Object>> contexts = company != null
                ? loadCompanyContexts(company.getId(), company.getName() + " 인재상 문화 면접", COMPANY_CONTEXT_TOP_K)
                : List.of();

        AiServiceClient.InterviewPrepConsultResult result = aiServiceClient.interviewPrepConsult(
                history,
                company != null ? company.getName() : "",
                contexts,
                "gpt-4o-mini"
        );

        String nextMode = result.isComplete() ? ConversationMode.IDLE.value() : ConversationMode.INTERVIEW_PREP.value();
        String nextState = result.isComplete() ? null : state.toString();

        return new RouteResult(
                result.answer(),
                buildMeta((company != null ? company.getName() : "면접") + " 면접 준비", "interview", List.of(), company),
                nextMode,
                nextState,
                company != null ? company.getId() : conversation.getSelectedCompanyId()
        );
    }

    private RouteResult startInterviewPractice(Conversation conversation, User user, String companyName) {
        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        if (company == null) {
            return simpleResult(
                    "모의 면접을 진행할 회사명을 입력해 주세요. 예) 카카오 모의 면접 해줘",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        ensureCompanyCrawledIfNeeded(company);
        List<Map<String, String>> history = buildConversationHistory(conversation.getId(), user, false, null);
        AiServiceClient.InterviewPracticeResult result = aiServiceClient.interviewPractice(
                history,
                company.getName(),
                loadCompanyContexts(company.getId(), company.getName() + " 인재상 핵심가치 문화 채용", COMPANY_CONTEXT_TOP_K),
                "gpt-4o-mini"
        );

        String nextMode = result.isComplete() ? ConversationMode.IDLE.value() : ConversationMode.INTERVIEW_PRACTICE.value();
        String nextState = result.isComplete() ? null : buildSingleCompanyState(company, "in_progress");

        return new RouteResult(
                result.answer(),
                buildMeta(company.getName() + " 모의 면접", "interview", List.of(), company),
                nextMode,
                nextState,
                company.getId()
        );
    }

    private RouteResult continueInterviewPractice(Conversation conversation, JsonNode state, String transientUserMessage) {
        Company company = resolveCompanyFromState(conversation, state);
        List<Map<String, String>> history = buildConversationHistory(conversation.getId(), null, false, transientUserMessage);
        AiServiceClient.InterviewPracticeResult result = aiServiceClient.interviewPractice(
                history,
                company != null ? company.getName() : "",
                company != null ? loadCompanyContexts(company.getId(), company.getName() + " 인재상 핵심가치 문화 채용", COMPANY_CONTEXT_TOP_K) : List.of(),
                "gpt-4o-mini"
        );

        String nextMode = result.isComplete() ? ConversationMode.IDLE.value() : ConversationMode.INTERVIEW_PRACTICE.value();
        String nextState = result.isComplete() ? null : state.toString();

        return new RouteResult(
                result.answer(),
                buildMeta((company != null ? company.getName() : "모의 면접") + " 모의 면접", "interview", List.of(), company),
                nextMode,
                nextState,
                company != null ? company.getId() : conversation.getSelectedCompanyId()
        );
    }

    private RouteResult startCoverletterConsult(Conversation conversation, User user, String companyName) {
        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        if (company != null) {
            ensureCompanyCrawledIfNeeded(company);
        }

        List<Map<String, String>> history = buildConversationHistory(conversation.getId(), user, true, null);
        AiServiceClient.CoverletterConsultResult result = aiServiceClient.coverletterConsult(
                history,
                company != null ? company.getName() : "",
                company != null ? loadCompanyContexts(company.getId(), company.getName() + " 인재상 문화 복지 직무", COMPANY_CONTEXT_TOP_K) : List.of(),
                "gpt-4o-mini"
        );

        ObjectNode state = companyStateNode(company, result.isComplete() ? "revising" : "collecting_info");

        return new RouteResult(
                result.answer(),
                buildMeta((company != null ? company.getName() : "자기소개서") + " 자기소개서 작성", "coverletter", List.of(), company),
                ConversationMode.COVERLETTER_CONSULT.value(),
                state.toString(),
                company != null ? company.getId() : conversation.getSelectedCompanyId()
        );
    }

    private RouteResult continueCoverletterConsult(Conversation conversation, User user, JsonNode state, String transientUserMessage) {
        Company company = resolveCompanyFromState(conversation, state);
        List<Map<String, String>> history = buildConversationHistory(conversation.getId(), user, true, transientUserMessage);
        AiServiceClient.CoverletterConsultResult result = aiServiceClient.coverletterConsult(
                history,
                company != null ? company.getName() : "",
                company != null ? loadCompanyContexts(company.getId(), company.getName() + " 인재상 문화 복지 직무", COMPANY_CONTEXT_TOP_K) : List.of(),
                "gpt-4o-mini"
        );

        ObjectNode nextState = companyStateNode(company, result.isComplete() ? "revising" : "collecting_info");

        return new RouteResult(
                result.answer(),
                buildMeta((company != null ? company.getName() : "자기소개서") + " 자기소개서 작성", "coverletter", List.of(), company),
                ConversationMode.COVERLETTER_CONSULT.value(),
                nextState.toString(),
                company != null ? company.getId() : conversation.getSelectedCompanyId()
        );
    }

    private RouteResult startCoverletterFeedback(Conversation conversation, User user, String message, String companyName) {
        String feedbackMessage = message;
        if (message.length() < 100) {
            if (user.getResumeText() != null && user.getResumeText().trim().length() >= 100) {
                feedbackMessage = message + "\n\n[자기소개서]\n" + user.getResumeText();
            } else {
                return simpleResult(
                        "피드백할 자기소개서 내용을 함께 입력해 주세요. 예) 아래 자소서 피드백해줘: [자소서 본문]",
                        ConversationMode.IDLE.value(),
                        null,
                        null,
                        conversation.getSelectedCompanyId()
                );
            }
        }

        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        ObjectNode state = companyStateNode(company, "awaiting_job_url");
        state.put("pendingFeedbackMessage", feedbackMessage);

        return new RouteResult(
                "어떤 채용공고에 지원하시나요? 채용공고 URL을 붙여넣어 주세요. 없으면 \"건너뛰기\"라고 입력해 주세요.",
                buildMeta((company != null ? company.getName() : "자소서") + " 자소서 피드백", "feedback", List.of(), company),
                ConversationMode.COVERLETTER_FEEDBACK.value(),
                state.toString(),
                company != null ? company.getId() : conversation.getSelectedCompanyId()
        );
    }

    private RouteResult continueCoverletterFeedback(Conversation conversation, JsonNode state, String message) {
        String phase = state.path("phase").asText("");
        Company company = resolveCompanyFromState(conversation, state);

        if ("awaiting_job_url".equals(phase)) {
            String trimmed = defaultString(message).trim();
            boolean isSkip = trimmed.matches("(?i).*건너뛰기.*|.*없어.*|.*없음.*|.*괜찮.*|skip");
            boolean isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://");
            if (!isSkip && !isUrl) {
                return new RouteResult(
                        "채용공고 URL을 붙여넣거나 \"건너뛰기\"라고 입력해 주세요.",
                        buildMeta((company != null ? company.getName() : "자소서") + " 자소서 피드백", "feedback", List.of(), company),
                        ConversationMode.COVERLETTER_FEEDBACK.value(),
                        state.toString(),
                        company != null ? company.getId() : conversation.getSelectedCompanyId()
                );
            }

            String pendingFeedbackMessage = state.path("pendingFeedbackMessage").asText("");
            CoverLetterFeedbackService.FeedbackResponse result = coverLetterFeedbackService.feedback(
                    pendingFeedbackMessage,
                    company != null ? company.getId() : null,
                    isUrl ? trimmed : ""
            );

            return new RouteResult(
                    result.answer(),
                    buildMeta((company != null ? company.getName() : "자소서") + " 자소서 피드백", "feedback", result.externalContexts(), company),
                    ConversationMode.IDLE.value(),
                    null,
                    company != null ? company.getId() : conversation.getSelectedCompanyId()
            );
        }

        return simpleResult(
                "피드백 세션을 복원하지 못했습니다. 다시 피드백 요청을 시작해 주세요.",
                ConversationMode.IDLE.value(),
                null,
                null,
                conversation.getSelectedCompanyId()
        );
    }

    private RouteResult startSalaryConsult(Conversation conversation, User user, String message, String companyName) {
        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        if (company != null) {
            ensureCompanyCrawledIfNeeded(company);
        }

        List<Map<String, String>> history = buildConversationHistory(conversation.getId(), user, true, null);
        AiServiceClient.SalaryNegotiationResult result = aiServiceClient.salaryNegotiation(
                history,
                company != null ? company.getName() : "",
                company != null ? loadCompanyContexts(company.getId(), company.getName() + " 연봉 복지 처우 보상", COMPANY_CONTEXT_TOP_K) : List.of(),
                "gpt-4o-mini"
        );

        String nextMode = result.isComplete() ? ConversationMode.IDLE.value() : ConversationMode.SALARY_CONSULT.value();
        String nextState = result.isComplete() ? null : buildSingleCompanyState(company, "in_progress");

        return new RouteResult(
                result.answer(),
                buildMeta((company != null ? company.getName() : "연봉") + " 연봉 협상 상담", "salary", List.of(), company),
                nextMode,
                nextState,
                company != null ? company.getId() : conversation.getSelectedCompanyId()
        );
    }

    private RouteResult continueSalaryConsult(Conversation conversation, User user, JsonNode state, String transientUserMessage) {
        Company company = resolveCompanyFromState(conversation, state);
        List<Map<String, String>> history = buildConversationHistory(conversation.getId(), user, true, transientUserMessage);
        AiServiceClient.SalaryNegotiationResult result = aiServiceClient.salaryNegotiation(
                history,
                company != null ? company.getName() : "",
                company != null ? loadCompanyContexts(company.getId(), company.getName() + " 연봉 복지 처우 보상", COMPANY_CONTEXT_TOP_K) : List.of(),
                "gpt-4o-mini"
        );

        String nextMode = result.isComplete() ? ConversationMode.IDLE.value() : ConversationMode.SALARY_CONSULT.value();
        String nextState = result.isComplete() ? null : state.toString();

        return new RouteResult(
                result.answer(),
                buildMeta((company != null ? company.getName() : "연봉") + " 연봉 협상 상담", "salary", List.of(), company),
                nextMode,
                nextState,
                company != null ? company.getId() : conversation.getSelectedCompanyId()
        );
    }

    private RouteResult continueCompanySelection(Conversation conversation, User user, String message, JsonNode state) {
        String targetCompanyName = trimToNull(state.path("targetCompanyName").asText(null));
        String pendingMessage = defaultString(state.path("pendingMessage").asText(""));
        String pendingIntent = defaultString(state.path("pendingIntent").asText(""));
        List<CompanyCandidateOption> candidates = readCandidateOptions(state.path("candidates"));

        if (targetCompanyName == null || pendingMessage.isBlank() || candidates.isEmpty()) {
            return simpleResult(
                    "회사 선택 상태를 복원하지 못했습니다. 처음 요청부터 다시 입력해 주세요.",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        CompanyCandidateOption selectedCandidate;
        if (candidates.size() == 1) {
            if (isAffirmative(message)) {
                selectedCandidate = candidates.get(0);
            } else if (isNegative(message)) {
                return buildCompanyUrlInputPrompt(conversation, pendingMessage, pendingIntent, targetCompanyName);
            } else {
                return simpleResult(
                        "후보가 1개입니다. '예' 또는 '아니오'로 답해 주세요.",
                        ConversationMode.COMPANY_SELECTION.value(),
                        state.toString(),
                        null,
                        conversation.getSelectedCompanyId()
                );
            }
        } else {
            selectedCandidate = selectCandidateFromMessage(message, candidates);
            if (selectedCandidate == null) {
                if (wantsDirectUrlInput(message)) {
                    return buildCompanyUrlInputPrompt(conversation, pendingMessage, pendingIntent, targetCompanyName);
                }
                return simpleResult(
                        "번호나 회사명을 다시 입력해 주세요. 목록에 없으면 'URL 직접 입력'이라고 보내 주세요.",
                        ConversationMode.COMPANY_SELECTION.value(),
                        state.toString(),
                        null,
                        conversation.getSelectedCompanyId()
                );
            }
        }

        Company company = createAndCrawlCompany(user.getId(), selectedCandidate.name(), enrichWebsite(selectedCandidate));
        if (company == null) {
            return buildCompanyUrlInputPrompt(conversation, pendingMessage, pendingIntent, selectedCandidate.name());
        }

        return resumePendingMessage(conversation, user, pendingMessage, targetCompanyName, company.getName());
    }

    private RouteResult continueCompanyUrlInput(Conversation conversation, User user, String message, JsonNode state) {
        String targetCompanyName = trimToNull(state.path("targetCompanyName").asText(null));
        String pendingMessage = defaultString(state.path("pendingMessage").asText(""));

        if (targetCompanyName == null || pendingMessage.isBlank()) {
            return simpleResult(
                    "회사 URL 입력 상태를 복원하지 못했습니다. 처음 요청부터 다시 입력해 주세요.",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        String url = trimToNull(message);
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return simpleResult(
                    "회사 홈페이지 URL을 `http://` 또는 `https://` 형식으로 입력해 주세요.",
                    ConversationMode.COMPANY_URL_INPUT.value(),
                    state.toString(),
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        Company company = createAndCrawlCompany(user.getId(), targetCompanyName, url);
        if (company == null) {
            return simpleResult(
                    "입력한 URL로 회사 정보를 가져오지 못했습니다. 공식 홈페이지 URL을 다시 입력해 주세요.",
                    ConversationMode.COMPANY_URL_INPUT.value(),
                    state.toString(),
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        return resumePendingMessage(conversation, user, pendingMessage, targetCompanyName, company.getName());
    }

    private RouteResult refreshCompanyInfo(Conversation conversation, User user, String companyName) {
        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        if (company == null) {
            return simpleResult(
                    "최신화할 회사 이름을 포함해 주세요.",
                    ConversationMode.IDLE.value(),
                    null,
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        companyService.crawlCompany(company.getId());
        return new RouteResult(
                company.getName() + " 정보 최신화가 완료되었습니다.",
                null,
                ConversationMode.QA.value(),
                buildSingleCompanyState(company, "qa"),
                company.getId()
        );
    }

    private RouteResult startQaOrGeneral(Conversation conversation, User user, String message, String companyName) {
        Company company = resolveSingleCompany(user.getId(), companyName, conversation.getSelectedCompanyId());
        if (company != null) {
            ensureCompanyCrawledIfNeeded(company);
            AskQuestionRequest request = new AskQuestionRequest(message, DEFAULT_TOP_K);
            request.setUserName(user.getName());
            AskQuestionResponse result = questionService.answerQuestion(company.getId(), request);
            String answer = result.getQuestion() != null ? result.getQuestion().getAnswerText() : "답변을 생성하지 못했습니다.";
            return new RouteResult(
                    answer,
                    buildMeta("회사: " + company.getName(), "qa", result.getExternalContexts(), company),
                    ConversationMode.QA.value(),
                    buildSingleCompanyState(company, "qa"),
                    company.getId()
            );
        }

        if (NEWS_PATTERN.matcher(message).find()) {
            AiServiceClient.GenerateAnswerResult result = aiServiceClient.generateAnswer(withProfile(user, message, true), "", List.of(), "", "");
            return new RouteResult(
                    result.answer(),
                    buildMeta("뉴스 검색", "news_search", mapContexts(result.usedContexts()), null),
                    ConversationMode.NEWS_AGENT.value(),
                    null,
                    conversation.getSelectedCompanyId()
            );
        }

        return new RouteResult(
                aiServiceClient.generalChat(message),
                null,
                ConversationMode.GENERAL.value(),
                null,
                conversation.getSelectedCompanyId()
        );
    }

    private List<Map<String, String>> buildConversationHistory(Long conversationId, User user, boolean includeProfile, String transientUserMessage) {
        List<ConversationMessage> messages = conversationMessageRepository.findAllByConversationIdOrderByCreatedAtAsc(conversationId);
        List<Map<String, String>> history = new ArrayList<>();
        if (includeProfile && user != null) {
            String profile = buildProfileContext(user, true);
            if (!profile.isBlank()) {
                history.add(Map.of("role", "user", "content", profile));
            }
        }
        for (ConversationMessage message : messages) {
            if (!"user".equals(message.getRole()) && !"assistant".equals(message.getRole())) {
                continue;
            }
            history.add(Map.of(
                    "role", message.getRole(),
                    "content", defaultString(message.getContent())
            ));
        }
        if (transientUserMessage != null && !transientUserMessage.isBlank()) {
            history.add(Map.of("role", "user", "content", transientUserMessage));
        }
        return history;
    }

    private List<Map<String, Object>> loadCompanyContexts(Long companyId, String query, int topK) {
        List<DocumentSearchResponseItem> items = documentEmbeddingService.searchSimilarEmbeddings(
                companyId,
                new DocumentSearchRequest(query, topK)
        );
        return items.stream()
                .map(item -> {
                    Map<String, Object> ctx = new LinkedHashMap<>();
                    ctx.put("sourceUrl", item.getSourceUrl());
                    ctx.put("content", item.getContent());
                    ctx.put("source_type", item.getSourceType());
                    return ctx;
                })
                .toList();
    }

    private List<CompanySearchResult> effectiveCandidates(String companyName) {
        List<CompanySearchResult> candidates = companyService.getCompanyCandidates(companyName);
        String normalized = normalize(companyName);
        List<CompanySearchResult> distinct = candidates.stream()
                .filter(candidate -> {
                    String candidateNorm = normalize(candidate.getName());
                    return candidateNorm.contains(normalized) || normalized.contains(candidateNorm);
                })
                .toList();
        return distinct.isEmpty() ? candidates : distinct;
    }

    private RouteResult buildCompanySelectionPrompt(
            Conversation conversation,
            String pendingMessage,
            String pendingIntent,
            String targetCompanyName,
            List<CompanySearchResult> candidates
    ) {
        ObjectNode state = objectMapper.createObjectNode();
        state.put("pendingIntent", defaultString(pendingIntent));
        state.put("pendingMessage", pendingMessage);
        state.put("targetCompanyName", targetCompanyName);
        ArrayNode items = state.putArray("candidates");
        for (CompanySearchResult candidate : candidates) {
            ObjectNode item = items.addObject();
            item.put("name", defaultString(candidate.getName()));
            item.put("website", defaultString(candidate.getWebsite()));
            item.put("description", defaultString(candidate.getDescription()));
        }

        String answer;
        if (candidates.size() == 1) {
            answer = "'" + targetCompanyName + "'을(를) 찾을 수 없습니다. 혹시 '" + candidates.get(0).getName()
                    + "'을(를) 말씀하신 건가요?\n\n맞으면 '예', 아니면 '아니오'라고 입력해 주세요.";
        } else {
            StringBuilder builder = new StringBuilder();
            builder.append("'").append(targetCompanyName)
                    .append("'라는 이름의 회사가 여러 개 검색됐습니다. 번호나 회사명을 입력해 주세요.\n\n");
            for (int i = 0; i < candidates.size(); i++) {
                CompanySearchResult candidate = candidates.get(i);
                builder.append(i + 1).append(". ").append(candidate.getName());
                if (candidate.getDescription() != null && !candidate.getDescription().isBlank()) {
                    builder.append(" - ").append(candidate.getDescription());
                }
                builder.append("\n");
            }
            builder.append("\n목록에 없으면 'URL 직접 입력'이라고 보내 주세요.");
            answer = builder.toString();
        }

        return simpleResult(
                answer,
                ConversationMode.COMPANY_SELECTION.value(),
                state.toString(),
                null,
                conversation.getSelectedCompanyId()
        );
    }

    private RouteResult buildCompanyUrlInputPrompt(
            Conversation conversation,
            String pendingMessage,
            String pendingIntent,
            String targetCompanyName
    ) {
        ObjectNode state = objectMapper.createObjectNode();
        state.put("pendingIntent", defaultString(pendingIntent));
        state.put("pendingMessage", pendingMessage);
        state.put("targetCompanyName", targetCompanyName);

        return simpleResult(
                "'" + targetCompanyName + "' 회사 정보를 찾지 못했습니다. 공식 홈페이지 URL을 입력해 주세요. 예) https://example.com",
                ConversationMode.COMPANY_URL_INPUT.value(),
                state.toString(),
                null,
                conversation.getSelectedCompanyId()
        );
    }

    private List<CompanyCandidateOption> readCandidateOptions(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<CompanyCandidateOption> candidates = new ArrayList<>();
        for (JsonNode item : node) {
            candidates.add(new CompanyCandidateOption(
                    defaultString(item.path("name").asText("")),
                    trimToNull(item.path("website").asText(null)),
                    trimToNull(item.path("description").asText(null))
            ));
        }
        return candidates.stream().filter(candidate -> !candidate.name().isBlank()).toList();
    }

    private CompanyCandidateOption selectCandidateFromMessage(String message, List<CompanyCandidateOption> candidates) {
        String trimmed = defaultString(message).trim();
        if (trimmed.isBlank()) {
            return null;
        }

        String digits = trimmed.replaceAll("\\D+", "");
        if (!digits.isBlank()) {
            try {
                int index = Integer.parseInt(digits) - 1;
                if (index >= 0 && index < candidates.size()) {
                    return candidates.get(index);
                }
            } catch (NumberFormatException ignored) {
                // fall through to name matching
            }
        }

        String normalized = normalize(trimmed);
        for (CompanyCandidateOption candidate : candidates) {
            if (normalize(candidate.name()).equals(normalized)) {
                return candidate;
            }
        }
        for (CompanyCandidateOption candidate : candidates) {
            String candidateNorm = normalize(candidate.name());
            if (candidateNorm.contains(normalized) || normalized.contains(candidateNorm)) {
                return candidate;
            }
        }
        return null;
    }

    private RouteResult resumePendingMessage(
            Conversation conversation,
            User user,
            String pendingMessage,
            String originalCompanyName,
            String resolvedCompanyName
    ) {
        String rewrittenMessage = rewriteCompanyName(pendingMessage, originalCompanyName, resolvedCompanyName);
        return startConversationFlow(conversation, user, rewrittenMessage);
    }

    private Company createAndCrawlCompany(Long userId, String companyName, String website) {
        Company existing = resolveCompanyByName(userId, companyName);
        if (existing != null) {
            if ((existing.getWebsite() == null || existing.getWebsite().isBlank())
                    && website != null && !website.isBlank()) {
                existing.updateWebsite(website);
            }
            ensureCompanyCrawledIfNeeded(existing);
            return existing;
        }

        Long createdCompanyId = null;
        try {
            CompanyResponse created = companyService.createCompany(new CreateCompanyRequest(companyName, trimToNull(website), ""));
            createdCompanyId = created.getId();
            CompanyCrawlResponse crawlResponse = companyService.crawlCompany(createdCompanyId);
            if (crawlResponse == null || crawlResponse.getSavedDocumentCount() == null || crawlResponse.getSavedDocumentCount() == 0) {
                companyService.deleteCompany(createdCompanyId);
                return null;
            }
            return companyRepository.findByIdAndUserId(createdCompanyId, userId).orElse(null);
        } catch (Exception e) {
            if (createdCompanyId != null) {
                try {
                    companyService.deleteCompany(createdCompanyId);
                } catch (Exception ignored) {
                    // ignore cleanup failure
                }
            }
            return null;
        }
    }

    private String enrichWebsite(CompanyCandidateOption candidate) {
        if (candidate.website() != null && !candidate.website().isBlank()) {
            return candidate.website();
        }
        if (candidate.description() == null || candidate.description().isBlank()) {
            return "";
        }
        String categoryPart = candidate.description().split("·")[0].trim();
        String subCategory = categoryPart.contains(">") ? categoryPart.substring(categoryPart.lastIndexOf('>') + 1) : categoryPart;
        String cleanCategory = subCategory.replaceAll("[,>·\\s]+", "").trim();
        if (cleanCategory.isBlank()) {
            return "";
        }
        String found = companyService.findCompanyUrl(candidate.name() + " " + cleanCategory);
        return found == null ? "" : found;
    }

    private Company resolveSingleCompany(Long userId, String companyName, Long fallbackCompanyId) {
        if (companyName != null && !companyName.isBlank()) {
            Company resolved = resolveCompanyByName(userId, companyName);
            if (resolved != null) {
                return resolved;
            }
        }
        if (fallbackCompanyId != null) {
            return companyRepository.findByIdAndUserId(fallbackCompanyId, userId).orElse(null);
        }
        return null;
    }

    private List<Company> resolveCompanies(Long userId, List<String> companyNames) {
        List<Company> companies = new ArrayList<>();
        for (String companyName : companyNames) {
            Company company = resolveCompanyByName(userId, companyName);
            if (company != null && companies.stream().noneMatch(existing -> existing.getId().equals(company.getId()))) {
                companies.add(company);
            }
        }
        return companies;
    }

    private Company resolveCompanyByName(Long userId, String companyName) {
        String normalized = normalize(companyName);
        if (normalized.isBlank()) {
            return null;
        }

        List<Company> companies = companyRepository.findAllByUserId(userId);
        for (Company company : companies) {
            if (normalize(company.getName()).equals(normalized)) {
                return company;
            }
        }
        for (Company company : companies) {
            String companyNorm = normalize(company.getName());
            if (companyNorm.contains(normalized) || normalized.contains(companyNorm)) {
                return company;
            }
        }
        return null;
    }

    private void ensureCompanyCrawledIfNeeded(Company company) {
        if (company.getLastCrawledAt() == null) {
            companyService.crawlCompany(company.getId());
        }
    }

    private Company resolveCompanyFromState(Conversation conversation, JsonNode state) {
        long companyId = state.path("companyId").asLong(0L);
        if (companyId > 0L) {
            return companyRepository.findById(companyId).orElse(null);
        }
        if (conversation.getSelectedCompanyId() != null) {
            return companyRepository.findById(conversation.getSelectedCompanyId()).orElse(null);
        }
        return null;
    }

    private String buildSingleCompanyState(Company company, String phase) {
        if (company == null) {
            return null;
        }
        return companyStateNode(company, phase).toString();
    }

    private ObjectNode companyStateNode(Company company, String phase) {
        ObjectNode state = objectMapper.createObjectNode();
        state.put("phase", phase);
        if (company != null) {
            state.put("companyId", company.getId());
            state.put("companyName", company.getName());
        }
        return state;
    }

    private String buildMeta(String label, String type, List<RagContextItem> contexts, Company company) {
        if ((label == null || label.isBlank()) && (contexts == null || contexts.isEmpty()) && company == null) {
            return null;
        }

        ObjectNode meta = objectMapper.createObjectNode();
        meta.put("label", defaultString(label));
        meta.put("type", type);
        ArrayNode sources = meta.putArray("sources");

        Map<String, RagContextItem> deduped = new LinkedHashMap<>();
        for (RagContextItem ctx : contexts) {
            if (ctx.getSourceUrl() == null || ctx.getSourceUrl().isBlank()) {
                continue;
            }
            deduped.putIfAbsent(ctx.getSourceUrl(), ctx);
        }
        for (RagContextItem ctx : deduped.values()) {
            ObjectNode src = sources.addObject();
            src.put("url", defaultString(ctx.getSourceUrl()));
            src.put("sourceType", defaultString(ctx.getSourceType()));
        }

        if (company != null) {
            if (company.getLastCrawledAt() != null) {
                meta.put("lastCrawledAt", company.getLastCrawledAt().format(ISO_DATE_TIME));
            } else {
                meta.putNull("lastCrawledAt");
            }
        }
        return meta.toString();
    }

    private List<RagContextItem> mapContexts(List<Map<String, Object>> contexts) {
        return contexts.stream()
                .map(ctx -> new RagContextItem(
                        null,
                        null,
                        String.valueOf(ctx.getOrDefault("sourceUrl", "")),
                        null,
                        String.valueOf(ctx.getOrDefault("source_type", "")),
                        String.valueOf(ctx.getOrDefault("content", "")),
                        null
                ))
                .toList();
    }

    private RouteResult simpleResult(String answer, String mode, String modeState, String meta, Long selectedCompanyId) {
        return new RouteResult(answer, meta, mode, modeState, selectedCompanyId);
    }

    private JsonNode readState(String raw) {
        if (raw == null || raw.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(raw);
        } catch (Exception ignored) {
            return objectMapper.createObjectNode();
        }
    }

    private List<Long> longValues(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<Long> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.canConvertToLong()) {
                values.add(item.asLong());
            }
        }
        return values;
    }

    private User getCurrentUser() {
        String email = (String) org.springframework.security.core.context.SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("인증된 사용자를 찾을 수 없습니다."));
    }

    private Conversation getConversation(Long conversationId, Long userId) {
        return conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found id=" + conversationId));
    }

    private String withProfile(User user, String message, boolean includeResume) {
        String profileContext = buildProfileContext(user, includeResume);
        if (profileContext.isBlank()) {
            return message;
        }
        return profileContext + "\n\n" + message;
    }

    private String buildProfileContext(User user, boolean includeResume) {
        if (user == null) {
            return "";
        }

        List<String> parts = new ArrayList<>();
        if (user.getCareerLevel() != null && !user.getCareerLevel().isBlank()) {
            parts.add("경력: " + user.getCareerLevel());
        }
        if (user.getDesiredJob() != null && !user.getDesiredJob().isBlank()) {
            parts.add("희망 직군: " + user.getDesiredJob());
        }
        if (user.getTechStack() != null && !user.getTechStack().isBlank()) {
            parts.add("보유 역량/툴: " + user.getTechStack());
        }
        if (user.getDesiredIndustry() != null && !user.getDesiredIndustry().isBlank()) {
            parts.add("희망 업종: " + user.getDesiredIndustry());
        }

        StringBuilder builder = new StringBuilder();
        if (!parts.isEmpty()) {
            builder.append("[사용자 프로필: ").append(String.join(", ", parts)).append("]");
        }
        if (includeResume && user.getResumeText() != null && !user.getResumeText().isBlank()) {
            if (!builder.isEmpty()) {
                builder.append("\n");
            }
            builder.append("[자기소개서/이력서]\n").append(user.getResumeText());
        }
        return builder.toString();
    }

    private String normalize(String value) {
        return defaultString(value).toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    private String sanitizeCompanyName(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        return trimToNull(TRAILING_PUNCTUATION_PATTERN.matcher(trimmed).replaceAll(""));
    }

    private boolean isPlaceholderName(String value) {
        return PLACEHOLDER_NAMES.contains(normalize(value));
    }

    private boolean isAffirmative(String value) {
        String normalized = normalize(value);
        return normalized.equals("예")
                || normalized.equals("네")
                || normalized.equals("응")
                || normalized.equals("맞아")
                || normalized.equals("맞습니다")
                || normalized.equals("yes");
    }

    private boolean isNegative(String value) {
        String normalized = normalize(value);
        return normalized.equals("아니오")
                || normalized.equals("아니")
                || normalized.equals("아니요")
                || normalized.equals("no")
                || wantsDirectUrlInput(value);
    }

    private boolean wantsDirectUrlInput(String value) {
        String normalized = normalize(value);
        return normalized.contains("url직접입력")
                || normalized.contains("직접입력")
                || normalized.contains("홈페이지입력")
                || normalized.contains("목록에없")
                || normalized.contains("없어요")
                || normalized.contains("none");
    }

    private String rewriteCompanyName(String message, String from, String to) {
        if (message == null || from == null || to == null || from.equals(to)) {
            return message;
        }
        return message.replaceAll(Pattern.quote(from), java.util.regex.Matcher.quoteReplacement(to));
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    public record ChatRespondResult(
            Conversation conversation,
            ConversationMessage userMessage,
            ConversationMessage assistantMessage,
            ConversationArtifact artifact
    ) {}

    private record IntentRoute(String intent, String companyName, List<String> companyNames) {}

    private record EnsureCompanyResult(Company company, RouteResult routeResult) {}

    private record PreflightResult(RouteResult routeResult, String companyName, List<String> companyNames) {}

    private record CompanyCandidateOption(String name, String website, String description) {}

    private record RouteResult(
            String answer,
            String meta,
            String mode,
            String modeState,
            Long selectedCompanyId
    ) {}
}
