package com.companyresearch.infra.client.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Comparator;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

/**
 * FastAPI AI 서비스와 통신하는 전용 클라이언트.
 *
 * 백엔드 서비스 레이어는 이 클래스를 통해 AI 기능을 호출하고,
 * 실패 시 빈 응답/기본값으로 복구해 전체 요청이 바로 깨지지 않도록 한다.
 */
@Component
public class AiServiceClient {
    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);
    private static final String ANSWER_MODEL = "gpt-4o-mini";
    private static final Duration TIMEOUT_DEFAULT  = Duration.ofSeconds(15);
    private static final Duration TIMEOUT_CRAWL    = Duration.ofSeconds(90);
    private static final Duration TIMEOUT_ANSWER   = Duration.ofSeconds(60);
    private static final Duration TIMEOUT_EMBED    = Duration.ofSeconds(30);

    private final WebClient webClient;
    private final String baseUrl;
    private final ObjectMapper objectMapper;

    public AiServiceClient(WebClient webClient,
            @Value("${ai-service.base-url:http://ai-service:8000}") String baseUrl,
            ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.baseUrl = baseUrl;
        this.objectMapper = objectMapper;
    }

    /**
     * GPT를 이용해 사용자 메시지의 의도와 회사명을 동시에 분류/추출한다.
     * 반환: {"intent": "qa", "company_name": "배달의민족"} 형태의 Map
     * 실패 시 {"intent": "qa", "company_name": null} 반환.
     */
    public Map<String, Object> classifyIntent(String message) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("intent", "qa");
        fallback.put("company_name", null);

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/classify-intent")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("message", message))
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI intent classify failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .onErrorResume(throwable -> {
                        log.warn("Intent classification failed: {}", throwable.getMessage());
                        return Mono.empty();
                    })
                    .block(TIMEOUT_DEFAULT);

            if (responseText == null || responseText.isBlank())
                return fallback;

            JsonNode root = objectMapper.readTree(responseText);
            String intent = root.path("intent").asText("qa");
            String companyName = root.path("company_name").isNull() ? null : root.path("company_name").asText(null);

            List<String> companyNames = new ArrayList<>();
            JsonNode namesNode = root.path("company_names");
            if (namesNode.isArray()) {
                namesNode.forEach(n -> { if (n.isTextual()) companyNames.add(n.asText()); });
            }

            Map<String, Object> result = new HashMap<>();
            result.put("intent", intent.isBlank() ? "qa" : intent);
            result.put("company_name", companyName);
            result.put("company_names", companyNames);
            return result;
        } catch (Exception e) {
            // 인텐트 분류 실패 시에도 기본 QA 플로우는 계속 태울 수 있어야 한다.
            log.warn("classifyIntent error: {}", e.getMessage());
            return fallback;
        }
    }

    /**
     * 회사명으로 Naver Search API를 통해 실제 회사명과 공식 홈페이지 URL을 검색한다.
     * 반환: [actualName, url] 배열. 검색 실패 시 null 반환.
     */
    public String[] searchCompanyInfo(String companyName) {
        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/search/company-url")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("company_name", companyName))
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI search service call failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .onErrorResume(throwable -> {
                        log.warn("Company search failed for name={}: {}", companyName, throwable.getMessage());
                        return Mono.empty();
                    })
                    .block(TIMEOUT_DEFAULT);

            if (responseText == null || responseText.isBlank())
                return null;

            JsonNode root = objectMapper.readTree(responseText);
            JsonNode urlNode = root.path("url");
            if (!urlNode.isTextual()) return null;

            String url = urlNode.asText();
            JsonNode nameNode = root.path("company_name");
            String actualName = (nameNode.isTextual() && !nameNode.asText().isBlank())
                    ? nameNode.asText()
                    : companyName;

            return new String[]{actualName, url};
        } catch (Exception e) {
            log.warn("Failed to search company info for name={}: {}", companyName, e.getMessage());
            return null;
        }
    }

    /**
     * DART 법인 검색: 회사명 키워드로 등록 법인 목록을 반환한다.
     * 반환: [[name, corpCode], ...] 형태의 리스트. 실패 시 빈 리스트.
     */
    public List<String[]> searchCompaniesByDart(String query) {
        try {
            String encoded = java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8);
            String responseText = webClient.get()
                    .uri(java.net.URI.create(baseUrl + "/internal/search/companies?q=" + encoded))
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "DART company search failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .onErrorResume(throwable -> {
                        log.warn("DART company search failed for query={}: {}", query, throwable.getMessage());
                        return Mono.empty();
                    })
                    .block(TIMEOUT_DEFAULT);

            if (responseText == null || responseText.isBlank()) return List.of();

            JsonNode root = objectMapper.readTree(responseText);
            if (!root.isArray()) return List.of();

            List<String[]> results = new ArrayList<>();
            for (JsonNode item : root) {
                String name = item.path("name").asText(null);
                String corpCode = item.path("corp_code").asText(null);
                if (name != null) {
                    results.add(new String[]{name, corpCode != null ? corpCode : ""});
                }
            }
            return results;
        } catch (Exception e) {
            log.warn("searchCompaniesByDart error for query={}: {}", query, e.getMessage());
            return List.of();
        }
    }

    /**
     * URL만 필요한 경우를 위한 래퍼 (crawlCompany 등에서 사용).
     */
    public String searchCompanyUrl(String companyName) {
        String[] info = searchCompanyInfo(companyName);
        return info != null ? info[1] : null;
    }

    public record DartCorpInfo(String corpCode, String industry, String companyName) {}

    public DartCorpInfo getDartCorpCode(String companyName) {
        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/dart/corp-code")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("company_name", companyName))
                    .retrieve()
                    .bodyToMono(String.class)
                    .onErrorResume(e -> Mono.empty())
                    .block(TIMEOUT_DEFAULT);
            if (responseText == null) return null;
            JsonNode root = objectMapper.readTree(responseText);
            JsonNode codeNode = root.path("corp_code");
            JsonNode industryNode = root.path("industry");
            JsonNode nameNode = root.path("company_name");
            String corpCode = codeNode.isTextual() ? codeNode.asText() : null;
            String industry = industryNode.isTextual() ? industryNode.asText() : null;
            String dartName = (nameNode.isTextual() && !nameNode.asText().isBlank()) ? nameNode.asText() : null;
            return new DartCorpInfo(corpCode, industry, dartName);
        } catch (Exception e) {
            log.warn("getDartCorpCode failed for {}: {}", companyName, e.getMessage());
            return null;
        }
    }

    public CrawlResult crawlCompany(String companyUrl) {
        // 크롤링은 외부 사이트를 순회하므로 다른 AI 호출보다 타임아웃을 길게 잡는다.
        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/crawl")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("url", companyUrl))
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            String.format("AI crawl service call failed: status=%s body=%s",
                                                    response.statusCode(), errorBody == null ? "" : errorBody)))))
                    .bodyToMono(String.class)
                    .onErrorResume(
                            throwable -> Mono.error(new IllegalStateException("AI service call failed", throwable)))
                    .block(TIMEOUT_CRAWL);

            if (responseText == null || responseText.isBlank()) {
                log.warn("AI crawl response is blank for url={}", companyUrl);
                return createEmptyCrawlResult(companyUrl);
            }

            try {
                return objectMapper.readValue(responseText, CrawlResult.class);
            } catch (Exception parseException) {
                log.error("Failed to parse AI crawl response. url={}, responseBody={}", companyUrl, responseText,
                        parseException);
                return createEmptyCrawlResult(companyUrl);
            }
        } catch (IllegalStateException e) {
            log.error("Could not crawl company URL={} due to ai-service error: {}", companyUrl, e.getMessage());
            return createEmptyCrawlResult(companyUrl);
        } catch (Exception e) {
            log.error("Unexpected error during crawl API call for url={}", companyUrl, e);
            return createEmptyCrawlResult(companyUrl);
        }
    }

    private CrawlResult createEmptyCrawlResult(String companyUrl) {
        CrawlResult crawlResult = new CrawlResult();
        crawlResult.setSourceUrl(companyUrl);
        crawlResult.setLinks(List.of());
        crawlResult.setPageTypeMap(Map.of());
        Map<String, String> extractedText = new HashMap<>();
        extractedText.put(companyUrl, "");
        crawlResult.setExtractedText(extractedText);
        crawlResult.setDocuments(List.of());
        return crawlResult;
    }

    public List<List<Double>> generateEmbeddings(List<String> texts) {
        // 텍스트 청크 묶음을 AI Service 임베딩 API로 전달해 vector 반환을 받는다.
        List<String> normalizedTexts = (texts == null) ? List.of()
                : texts.stream()
                        .filter(text -> text != null && !text.isBlank())
                        .toList();

        if (normalizedTexts.isEmpty()) {
            return List.of();
        }

        EmbeddingRequest request = new EmbeddingRequest(
                normalizedTexts,
                "text-embedding-3-small");

        String responseText;
        try {
            responseText = webClient.post()
                    .uri(baseUrl + "/internal/embeddings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(request)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            String.format("AI embedding service call failed: status=%s body=%s",
                                                    response.statusCode(), errorBody == null ? "" : errorBody)))))
                    .bodyToMono(String.class)
                    .block(TIMEOUT_EMBED);
        } catch (Exception e) {
            log.error("Failed to call ai-service /internal/embeddings. texts={} firstTextLength={}",
                    normalizedTexts.size(),
                    normalizedTexts.isEmpty() ? 0 : normalizedTexts.get(0).length(), e);
            return List.of();
        }

        if (responseText == null || responseText.isBlank()) {
            return List.of();
        }

        return parseEmbeddingResponse(responseText);
    }

    public record GenerateAnswerResult(String answer, List<Map<String, Object>> usedContexts) {}

    public record CompareResult(String answer, List<Map<String, Object>> contexts) {}

    public record ResearchResult(String answer, List<Map<String, Object>> contexts) {}

    public record InterviewResult(String answer, List<Map<String, Object>> contexts) {}

    public record ResumeInterviewResult(String answer, List<Map<String, Object>> contexts) {}

    public record CoverLetterResult(String answer, List<Map<String, Object>> contexts) {}

    public record CoverLetterFeedbackResult(String answer, List<Map<String, Object>> contexts) {}

    public record SalaryGuideResult(String answer, List<Map<String, Object>> contexts) {}

    public record InterviewPracticeResult(String answer, boolean isComplete) {}

    public record SalaryNegotiationResult(String answer, boolean isComplete) {}

    public record CoverletterConsultResult(String answer, boolean isComplete) {}

    public record InterviewPrepConsultResult(String answer, boolean isComplete) {}

    public ResearchResult researchCompany(String companyName, String dartCorpCode, List<?> contexts, String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("dart_corp_code", dartCorpCode != null ? dartCorpCode : "");
        requestBody.put("contexts", contexts != null ? contexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/research")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI research service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(90));

            if (responseText == null || responseText.isBlank()) {
                return new ResearchResult("리포트를 생성할 수 없습니다.", List.of());
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("리포트를 생성할 수 없습니다.");
            List<Map<String, Object>> resContexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    resContexts.add(m);
                }
            }
            return new ResearchResult(answer, resContexts);
        } catch (Exception e) {
            log.error("researchCompany failed: {}", e.getMessage());
            return new ResearchResult("심층 분석 중 오류가 발생했습니다.", List.of());
        }
    }

    public InterviewResult interviewPrep(String companyName, String dartCorpCode, List<?> contexts, String model, String resumeText) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("dart_corp_code", dartCorpCode != null ? dartCorpCode : "");
        requestBody.put("contexts", contexts != null ? contexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");
        requestBody.put("resume_text", resumeText != null ? resumeText : "");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/interview")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI interview service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(90));

            if (responseText == null || responseText.isBlank()) {
                return new InterviewResult("면접 준비 가이드를 생성할 수 없습니다.", List.of());
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("면접 준비 가이드를 생성할 수 없습니다.");
            List<Map<String, Object>> resContexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    resContexts.add(m);
                }
            }
            return new InterviewResult(answer, resContexts);
        } catch (Exception e) {
            log.error("interviewPrep failed: {}", e.getMessage());
            return new InterviewResult("면접 준비 가이드 생성 중 오류가 발생했습니다.", List.of());
        }
    }

    public CoverLetterResult writeCoverLetter(String companyName, String jobRole, List<?> contexts, String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("job_role", jobRole != null ? jobRole : "");
        requestBody.put("contexts", contexts != null ? contexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/coverletter")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI coverletter service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(90));

            if (responseText == null || responseText.isBlank()) {
                return new CoverLetterResult("자기소개서를 생성할 수 없습니다.", List.of());
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("자기소개서를 생성할 수 없습니다.");
            List<Map<String, Object>> resContexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    resContexts.add(m);
                }
            }
            return new CoverLetterResult(answer, resContexts);
        } catch (Exception e) {
            log.error("writeCoverLetter failed: {}", e.getMessage());
            return new CoverLetterResult("자기소개서 작성 중 오류가 발생했습니다.", List.of());
        }
    }

    public CoverLetterFeedbackResult coverLetterFeedback(String message, String companyName, List<?> companyContexts, String model, String jobUrl) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("message", message != null ? message : "");
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("company_contexts", companyContexts != null ? companyContexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");
        requestBody.put("job_url", jobUrl != null ? jobUrl : "");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/coverletter-feedback")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI coverletter-feedback service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(60));

            if (responseText == null || responseText.isBlank()) {
                return new CoverLetterFeedbackResult("피드백을 생성할 수 없습니다.", List.of());
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("피드백을 생성할 수 없습니다.");
            List<Map<String, Object>> resContexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    resContexts.add(m);
                }
            }
            return new CoverLetterFeedbackResult(answer, resContexts);
        } catch (Exception e) {
            log.error("coverLetterFeedback failed: {}", e.getMessage());
            return new CoverLetterFeedbackResult("자소서 피드백 생성 중 오류가 발생했습니다.", List.of());
        }
    }

    public SalaryGuideResult salaryGuide(String companyName, String jobRole, String careerYears, List<?> contexts, String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("job_role", jobRole != null ? jobRole : "");
        requestBody.put("career_years", careerYears != null ? careerYears : "");
        requestBody.put("contexts", contexts != null ? contexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/salary")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI salary service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(60));

            if (responseText == null || responseText.isBlank()) {
                return new SalaryGuideResult("연봉 협상 가이드를 생성할 수 없습니다.", List.of());
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("연봉 협상 가이드를 생성할 수 없습니다.");
            List<Map<String, Object>> resContexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    resContexts.add(m);
                }
            }
            return new SalaryGuideResult(answer, resContexts);
        } catch (Exception e) {
            log.error("salaryGuide failed: {}", e.getMessage());
            return new SalaryGuideResult("연봉 협상 가이드 생성 중 오류가 발생했습니다.", List.of());
        }
    }

    public ResumeInterviewResult resumeInterview(String message, String companyName, List<?> companyContexts, String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("message", message != null ? message : "");
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("company_contexts", companyContexts != null ? companyContexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/resume-interview")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI resume-interview service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(60));

            if (responseText == null || responseText.isBlank()) {
                return new ResumeInterviewResult("면접 질문을 생성할 수 없습니다.", List.of());
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("면접 질문을 생성할 수 없습니다.");
            List<Map<String, Object>> resContexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    resContexts.add(m);
                }
            }
            return new ResumeInterviewResult(answer, resContexts);
        } catch (Exception e) {
            log.error("resumeInterview failed: {}", e.getMessage());
            return new ResumeInterviewResult("자소서 분석 중 오류가 발생했습니다.", List.of());
        }
    }

    public InterviewPracticeResult interviewPractice(
            List<Map<String, String>> messages,
            String companyName,
            List<?> companyContexts,
            String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("messages", messages != null ? messages : List.of());
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("company_contexts", companyContexts != null ? companyContexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/interview-practice")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI interview-practice service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(30));

            if (responseText == null || responseText.isBlank()) {
                return new InterviewPracticeResult("면접 진행 중 오류가 발생했습니다.", false);
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("면접 진행 중 오류가 발생했습니다.");
            boolean isComplete = root.path("is_complete").asBoolean(false);
            return new InterviewPracticeResult(answer, isComplete);
        } catch (Exception e) {
            log.error("interviewPractice failed: {}", e.getMessage());
            return new InterviewPracticeResult("면접 진행 중 오류가 발생했습니다.", false);
        }
    }

    public SalaryNegotiationResult salaryNegotiation(
            List<Map<String, String>> messages,
            String companyName,
            List<?> companyContexts,
            String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("messages", messages != null ? messages : List.of());
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("company_contexts", companyContexts != null ? companyContexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/salary-negotiation")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI salary-negotiation service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(30));

            if (responseText == null || responseText.isBlank()) {
                return new SalaryNegotiationResult("연봉 협상 상담 중 오류가 발생했습니다.", false);
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("연봉 협상 상담 중 오류가 발생했습니다.");
            boolean isComplete = root.path("is_complete").asBoolean(false);
            return new SalaryNegotiationResult(answer, isComplete);
        } catch (Exception e) {
            log.error("salaryNegotiation failed: {}", e.getMessage());
            return new SalaryNegotiationResult("연봉 협상 상담 중 오류가 발생했습니다.", false);
        }
    }

    public CoverletterConsultResult coverletterConsult(
            List<Map<String, String>> messages,
            String companyName,
            List<?> companyContexts,
            String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("messages", messages != null ? messages : List.of());
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("company_contexts", companyContexts != null ? companyContexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/coverletter-consult")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI coverletter-consult service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(30));

            if (responseText == null || responseText.isBlank()) {
                return new CoverletterConsultResult("자기소개서 상담 중 오류가 발생했습니다.", false);
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("자기소개서 상담 중 오류가 발생했습니다.");
            boolean isComplete = root.path("is_complete").asBoolean(false);
            return new CoverletterConsultResult(answer, isComplete);
        } catch (Exception e) {
            log.error("coverletterConsult failed: {}", e.getMessage());
            return new CoverletterConsultResult("자기소개서 상담 중 오류가 발생했습니다.", false);
        }
    }

    public InterviewPrepConsultResult interviewPrepConsult(
            List<Map<String, String>> messages,
            String companyName,
            List<?> companyContexts,
            String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("messages", messages != null ? messages : List.of());
        requestBody.put("company_name", companyName != null ? companyName : "");
        requestBody.put("company_contexts", companyContexts != null ? companyContexts : List.of());
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/interview-prep-consult")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI interview-prep-consult service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(30));

            if (responseText == null || responseText.isBlank()) {
                return new InterviewPrepConsultResult("면접 준비 상담 중 오류가 발생했습니다.", false);
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("면접 준비 상담 중 오류가 발생했습니다.");
            boolean isComplete = root.path("is_complete").asBoolean(false);
            return new InterviewPrepConsultResult(answer, isComplete);
        } catch (Exception e) {
            log.error("interviewPrepConsult failed: {}", e.getMessage());
            return new InterviewPrepConsultResult("면접 준비 상담 중 오류가 발생했습니다.", false);
        }
    }

    public CompareResult compareCompanies(String question, List<Map<String, Object>> companies, String model) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("question", question);
        requestBody.put("companies", companies);
        requestBody.put("model", model != null ? model : "gpt-4o-mini");

        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/compare")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI compare service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .block(TIMEOUT_ANSWER);

            if (responseText == null || responseText.isBlank()) {
                return new CompareResult("비교 답변을 생성할 수 없습니다.", List.of());
            }

            JsonNode root = objectMapper.readTree(responseText);
            String answer = root.path("answer").asText("비교 답변을 생성할 수 없습니다.");
            List<Map<String, Object>> contexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    contexts.add(m);
                }
            }
            return new CompareResult(answer, contexts);
        } catch (Exception e) {
            log.error("compareCompanies failed: {}", e.getMessage());
            return new CompareResult("비교 중 오류가 발생했습니다.", List.of());
        }
    }

    public GenerateAnswerResult generateAnswer(String question, String prompt, List<?> contexts, String companyName, String dartCorpCode) {
        // 백엔드 생성 context를 그대로 전달해 ai-service에서 응답을 생성한다.
        RAGAnswerRequest request = new RAGAnswerRequest(question, prompt, contexts, companyName, dartCorpCode);
        String responseText = webClient.post()
                .uri(baseUrl + "/internal/answer")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .onStatus(
                        status -> status.is4xxClientError() || status.is5xxServerError(),
                        response -> response.bodyToMono(String.class)
                                .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                        String.format("AI answer service call failed: status=%s body=%s",
                                                response.statusCode(), errorBody == null ? "" : errorBody)))))
                .bodyToMono(String.class)
                .onErrorResume(
                        throwable -> Mono.error(new IllegalStateException("AI answer service call failed", throwable)))
                .block(TIMEOUT_ANSWER);

        if (responseText == null || responseText.isBlank()) {
            return new GenerateAnswerResult("답변을 생성할 수 없습니다.", List.of());
        }

        return parseAnswerResult(responseText);
    }

    private GenerateAnswerResult parseAnswerResult(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (!root.isObject()) {
                return new GenerateAnswerResult("답변 포맷이 올바르지 않습니다.", List.of());
            }

            JsonNode answerNode = root.path("answer");
            String answer = answerNode.isTextual() ? answerNode.asText() : "답변을 생성하지 못했습니다.";

            List<Map<String, Object>> usedContexts = new ArrayList<>();
            JsonNode ctxsNode = root.path("used_contexts");
            if (ctxsNode.isArray()) {
                for (JsonNode ctx : ctxsNode) {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.path("sourceUrl").asText(null));
                    m.put("source_type", ctx.path("source_type").asText(null));
                    m.put("content", ctx.path("content").asText(null));
                    usedContexts.add(m);
                }
            }
            return new GenerateAnswerResult(answer, usedContexts);
        } catch (Exception e) {
            log.error("Failed to parse AI answer response", e);
            return new GenerateAnswerResult("응답 파싱에 실패했습니다.", List.of());
        }
    }

    private List<List<Double>> parseEmbeddingResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            if (!root.isObject()) {
                log.warn("Unexpected embedding response type from AI service: {}", responseBody);
                return List.of();
            }

            JsonNode directEmbeddings = root.path("embeddings");
            if (directEmbeddings.isArray() && directEmbeddings.size() > 0) {
                return parseVectorArray(directEmbeddings);
            }

            JsonNode dataNode = root.path("data");
            if (!dataNode.isArray()) {
                log.warn("Unexpected embedding response format from AI service: {}", responseBody);
                return List.of();
            }

            List<IndexedEmbedding> embeddings = new ArrayList<>();
            dataNode.forEach(item -> {
                int index = item.hasNonNull("index") ? item.get("index").asInt() : 0;
                JsonNode vectorNode = item.path("embedding");
                if (!vectorNode.isArray()) {
                    return;
                }

                embeddings.add(new IndexedEmbedding(index, parseSingleVector(vectorNode)));
            });

            return embeddings.stream()
                    .sorted(Comparator.comparingInt(IndexedEmbedding::index))
                    .map(IndexedEmbedding::vector)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to parse AI embedding response", e);
            return List.of();
        }
    }

    private List<List<Double>> parseVectorArray(JsonNode vectorNode) {
        if (!vectorNode.isArray()) {
            return List.of();
        }

        List<List<Double>> vectors = new ArrayList<>();
        if (vectorNode.isEmpty()) {
            return vectors;
        }

        if (vectorNode.get(0).isArray()) {
            for (JsonNode vector : vectorNode) {
                if (!vector.isArray()) {
                    continue;
                }
                vectors.add(parseSingleVector(vector));
            }
            return vectors;
        }

        vectors.add(parseSingleVector(vectorNode));
        return vectors;
    }

    private List<Double> parseSingleVector(JsonNode vectorNode) {
        if (!vectorNode.isArray()) {
            return List.of();
        }

        for (JsonNode vector : vectorNode) {
            if (!vector.isNumber()) {
                return List.of();
            }
        }
        List<Double> row = new ArrayList<>(vectorNode.size());
        vectorNode.forEach(value -> row.add(value.asDouble()));
        return row;
    }

    private static class IndexedEmbedding {
        private final int index;
        private final List<Double> vector;

        private IndexedEmbedding(int index, List<Double> vector) {
            this.index = index;
            this.vector = vector;
        }

        private int index() {
            return index;
        }

        private List<Double> vector() {
            return vector;
        }
    }

    private static class RAGAnswerRequest {
        private final String question;
        private final String prompt;
        private final String model;
        private final List<?> contexts;
        private final String companyName;
        private final String dartCorpCode;

        private RAGAnswerRequest(String question, String prompt, List<?> contexts, String companyName, String dartCorpCode) {
            this.question = question;
            this.prompt = prompt;
            this.model = ANSWER_MODEL;
            this.contexts = contexts == null ? List.of() : contexts;
            this.companyName = companyName == null ? "" : companyName;
            this.dartCorpCode = dartCorpCode == null ? "" : dartCorpCode;
        }

        @SuppressWarnings("unused")
        public String getQuestion() { return question; }

        @SuppressWarnings("unused")
        public String getPrompt() { return prompt; }

        @SuppressWarnings("unused")
        public String getModel() { return model; }

        @SuppressWarnings("unused")
        public List<?> getContexts() { return contexts; }

        @JsonProperty("company_name")
        public String getCompanyName() { return companyName; }

        @JsonProperty("dart_corp_code")
        public String getDartCorpCode() { return dartCorpCode; }
    }

    public String generalChat(String message) {
        try {
            String responseText = webClient.post()
                    .uri(baseUrl + "/internal/general-chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("message", message != null ? message : ""))
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI general-chat service failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .onErrorResume(throwable -> {
                        log.warn("generalChat failed: {}", throwable.getMessage());
                        return Mono.empty();
                    })
                    .block(TIMEOUT_ANSWER);

            if (responseText == null || responseText.isBlank()) {
                return "죄송합니다, 답변을 생성하지 못했습니다.";
            }

            JsonNode root = objectMapper.readTree(responseText);
            return root.path("answer").asText("죄송합니다, 답변을 생성하지 못했습니다.");
        } catch (Exception e) {
            log.error("generalChat failed: {}", e.getMessage());
            return "죄송합니다, 일시적인 오류가 발생했습니다.";
        }
    }

    /**
     * 회사명으로 네이버 업체 후보 목록을 조회한다. (동명 회사 disambiguation)
     * 반환: [{name, description, url}] 리스트. 실패 시 빈 리스트.
     */
    public List<Map<String, String>> searchCompanyCandidates(String companyName) {
        try {
            String encoded = java.net.URLEncoder.encode(companyName, java.nio.charset.StandardCharsets.UTF_8);
            String responseText = webClient.get()
                    .uri(java.net.URI.create(baseUrl + "/internal/search/company-candidates?name=" + encoded))
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(new IllegalStateException(
                                            "AI candidate search failed: " + errorBody))))
                    .bodyToMono(String.class)
                    .onErrorResume(throwable -> {
                        log.warn("searchCompanyCandidates error for name={}: {}", companyName, throwable.getMessage());
                        return Mono.empty();
                    })
                    .block(TIMEOUT_DEFAULT);

            if (responseText == null || responseText.isBlank()) return List.of();

            JsonNode arr = objectMapper.readTree(responseText);
            if (!arr.isArray()) return List.of();

            List<Map<String, String>> result = new ArrayList<>();
            for (JsonNode node : arr) {
                Map<String, String> item = new java.util.HashMap<>();
                item.put("name", node.path("name").asText(""));
                item.put("description", node.path("description").asText(""));
                JsonNode urlNode = node.path("url");
                item.put("url", urlNode.isNull() ? null : urlNode.asText());
                result.add(item);
            }
            return result;
        } catch (Exception e) {
            log.warn("searchCompanyCandidates failed for name={}: {}", companyName, e.getMessage());
            return List.of();
        }
    }

    public String parseResume(byte[] fileBytes, String filename, String contentType) {
        try {
            org.springframework.http.client.MultipartBodyBuilder builder =
                    new org.springframework.http.client.MultipartBodyBuilder();
            builder.part("file", new org.springframework.core.io.ByteArrayResource(fileBytes) {
                @Override public String getFilename() { return filename; }
            }).contentType(org.springframework.http.MediaType.parseMediaType(
                    contentType != null ? contentType : "application/octet-stream"));

            JsonNode result = webClient.post()
                    .uri(baseUrl + "/internal/parse-resume")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .bodyValue(builder.build())
                    .retrieve()
                    .onStatus(
                            status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class)
                                    .flatMap(errorBody -> Mono.error(
                                            new IllegalStateException("parse-resume failed: " + errorBody))))
                    .bodyToMono(JsonNode.class)
                    .block(Duration.ofSeconds(30));

            return result != null ? result.path("text").asText("") : "";
        } catch (Exception e) {
            log.error("parseResume failed: {}", e.getMessage());
            throw new IllegalStateException("파일 파싱에 실패했습니다: " + e.getMessage());
        }
    }
}
