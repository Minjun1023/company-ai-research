package com.companyresearch.domain.company.service;

import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.company.entity.Company;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.document.service.DocumentEmbeddingService;
import com.companyresearch.domain.question.dto.RagContextItem;
import com.companyresearch.infra.client.ai.AiServiceClient;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

// 특정 회사 면접 준비 가이드를 생성하는 서비스.
@Service
public class InterviewService {

    private static final int INTERVIEW_TOP_K = 5;
    private static final String ANSWER_MODEL = "gpt-4o-mini";

    private final CompanyRepository companyRepository;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final AiServiceClient aiServiceClient;

    public InterviewService(
            CompanyRepository companyRepository,
            DocumentEmbeddingService documentEmbeddingService,
            AiServiceClient aiServiceClient) {
        this.companyRepository = companyRepository;
        this.documentEmbeddingService = documentEmbeddingService;
        this.aiServiceClient = aiServiceClient;
    }

    @Transactional
    public InterviewResponse prepareInterview(Long companyId, String resumeText) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + companyId));

        List<DocumentSearchResponseItem> searchItems = documentEmbeddingService.searchSimilarEmbeddings(
                company.getId(),
                new DocumentSearchRequest(company.getName() + " 채용 문화 복지 비전 인재상", INTERVIEW_TOP_K)
        );

        List<Map<String, Object>> contexts = searchItems.stream()
                .map(item -> {
                    Map<String, Object> ctx = new HashMap<>();
                    ctx.put("sourceUrl", item.getSourceUrl());
                    ctx.put("content", item.getContent());
                    ctx.put("source_type", item.getSourceType());
                    return ctx;
                })
                .toList();

        AiServiceClient.InterviewResult result = aiServiceClient.interviewPrep(
                company.getName(),
                company.getDartCorpCode() != null ? company.getDartCorpCode() : "",
                contexts,
                ANSWER_MODEL,
                resumeText != null ? resumeText : ""
        );

        List<RagContextItem> externalContexts = result.contexts().stream()
                .filter(ctx -> ctx.get("sourceUrl") != null && !String.valueOf(ctx.get("sourceUrl")).isBlank())
                .map(ctx -> new RagContextItem(null, null, String.valueOf(ctx.get("sourceUrl")), null,
                        String.valueOf(ctx.get("source_type")), null, null))
                .toList();

        return new InterviewResponse(company.getName(), result.answer(), externalContexts);
    }

    public record InterviewResponse(String companyName, String answer, List<RagContextItem> externalContexts) {}
}
