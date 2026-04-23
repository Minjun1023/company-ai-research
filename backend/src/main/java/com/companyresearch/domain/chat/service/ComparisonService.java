package com.companyresearch.domain.chat.service;

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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// 멀티 회사 비교 에이전트: 각 회사의 문서를 수집하고 AI 비교 답변을 생성한다.
@Service
public class ComparisonService {

    private static final int COMPARE_TOP_K = 3;
    private static final String ANSWER_MODEL = "gpt-4o-mini";

    private final CompanyRepository companyRepository;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final AiServiceClient aiServiceClient;

    public ComparisonService(
            CompanyRepository companyRepository,
            DocumentEmbeddingService documentEmbeddingService,
            AiServiceClient aiServiceClient) {
        this.companyRepository = companyRepository;
        this.documentEmbeddingService = documentEmbeddingService;
        this.aiServiceClient = aiServiceClient;
    }

    @Transactional
    public CompareResponse compare(List<Long> companyIds, String question) {
        if (companyIds == null || companyIds.size() < 2) {
            return new CompareResponse("비교할 회사를 2개 이상 지정해주세요.", List.of());
        }

        List<Map<String, Object>> companyPayloads = new ArrayList<>();

        for (Long companyId : companyIds) {
            Company company = companyRepository.findById(companyId)
                    .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + companyId));

            List<DocumentSearchResponseItem> searchItems = documentEmbeddingService.searchSimilarEmbeddings(
                    company.getId(),
                    new DocumentSearchRequest(question, COMPARE_TOP_K)
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

            Map<String, Object> payload = new HashMap<>();
            payload.put("name", company.getName());
            payload.put("dart_corp_code", company.getDartCorpCode() != null ? company.getDartCorpCode() : "");
            payload.put("contexts", contexts);
            companyPayloads.add(payload);
        }

        AiServiceClient.CompareResult result = aiServiceClient.compareCompanies(question, companyPayloads, ANSWER_MODEL);

        List<RagContextItem> externalContexts = result.contexts().stream()
                .filter(ctx -> ctx.get("sourceUrl") != null && !String.valueOf(ctx.get("sourceUrl")).isBlank())
                .map(ctx -> new RagContextItem(null, null, String.valueOf(ctx.get("sourceUrl")), null,
                        String.valueOf(ctx.get("source_type")), null, null))
                .toList();

        return new CompareResponse(result.answer(), externalContexts);
    }

    public record CompareResponse(String answer, List<RagContextItem> externalContexts) {}
}