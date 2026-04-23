package com.companyresearch.domain.company.service;

import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.document.service.DocumentEmbeddingService;
import com.companyresearch.domain.question.dto.RagContextItem;
import com.companyresearch.infra.client.ai.AiServiceClient;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

// 자기소개서 피드백·첨삭 서비스.
// 회사 인재상 데이터를 기반으로 자소서를 분석하고 개선 방향을 제시한다.
@Service
public class CoverLetterFeedbackService {

    private static final int FEEDBACK_TOP_K = 3;

    private final CompanyRepository companyRepository;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final AiServiceClient aiServiceClient;

    public CoverLetterFeedbackService(
            CompanyRepository companyRepository,
            DocumentEmbeddingService documentEmbeddingService,
            AiServiceClient aiServiceClient) {
        this.companyRepository = companyRepository;
        this.documentEmbeddingService = documentEmbeddingService;
        this.aiServiceClient = aiServiceClient;
    }

    public record FeedbackResponse(String answer, List<RagContextItem> externalContexts) {}

    public FeedbackResponse feedback(String message, Long companyId, String jobUrl) {
        String companyName = "";
        List<Map<String, Object>> companyContexts = List.of();

        if (companyId != null) {
            var company = companyRepository.findById(companyId).orElse(null);
            if (company != null) {
                companyName = company.getName();
                List<DocumentSearchResponseItem> items = documentEmbeddingService.searchSimilarEmbeddings(
                        companyId,
                        new DocumentSearchRequest(company.getName() + " 인재상 핵심가치 문화 채용", FEEDBACK_TOP_K)
                );
                companyContexts = items.stream()
                        .map(item -> {
                            Map<String, Object> ctx = new HashMap<>();
                            ctx.put("sourceUrl", item.getSourceUrl());
                            ctx.put("content", item.getContent());
                            ctx.put("source_type", item.getSourceType());
                            return ctx;
                        })
                        .toList();
            }
        }

        AiServiceClient.CoverLetterFeedbackResult result = aiServiceClient.coverLetterFeedback(
                message, companyName, companyContexts, "gpt-4o-mini", jobUrl != null ? jobUrl : ""
        );

        List<RagContextItem> externalContexts = result.contexts().stream()
                .filter(ctx -> ctx.get("sourceUrl") != null && !String.valueOf(ctx.get("sourceUrl")).isBlank())
                .map(ctx -> new RagContextItem(null, null, String.valueOf(ctx.get("sourceUrl")), null,
                        String.valueOf(ctx.get("source_type")), null, null))
                .toList();

        return new FeedbackResponse(result.answer(), externalContexts);
    }
}
