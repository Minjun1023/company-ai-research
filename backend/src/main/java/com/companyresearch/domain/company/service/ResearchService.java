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

// 단일 회사 심층 리서치 리포트 생성 서비스.
@Service
public class ResearchService {

    private static final int RESEARCH_TOP_K = 5;
    private static final String ANSWER_MODEL = "gpt-4o-mini";

    private final CompanyRepository companyRepository;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final AiServiceClient aiServiceClient;

    public ResearchService(
            CompanyRepository companyRepository,
            DocumentEmbeddingService documentEmbeddingService,
            AiServiceClient aiServiceClient) {
        this.companyRepository = companyRepository;
        this.documentEmbeddingService = documentEmbeddingService;
        this.aiServiceClient = aiServiceClient;
    }

    @Transactional
    public ResearchResponse research(Long companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + companyId));

        // 회사명을 쿼리로 써서 가장 관련성 높은 문서 수집
        List<DocumentSearchResponseItem> searchItems = documentEmbeddingService.searchSimilarEmbeddings(
                company.getId(),
                new DocumentSearchRequest(company.getName() + " 회사 정보 문화 채용 복지", RESEARCH_TOP_K)
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

        AiServiceClient.ResearchResult result = aiServiceClient.researchCompany(
                company.getName(),
                company.getDartCorpCode() != null ? company.getDartCorpCode() : "",
                contexts,
                ANSWER_MODEL
        );

        // URL → pageTitle 매핑 (출처 표시용)
        Map<String, String> urlToTitle = searchItems.stream()
                .filter(item -> item.getSourceUrl() != null && item.getPageTitle() != null)
                .collect(java.util.stream.Collectors.toMap(
                        DocumentSearchResponseItem::getSourceUrl,
                        DocumentSearchResponseItem::getPageTitle,
                        (a, b) -> a));

        List<RagContextItem> externalContexts = result.contexts().stream()
                .filter(ctx -> ctx.get("sourceUrl") != null && !String.valueOf(ctx.get("sourceUrl")).isBlank())
                .map(ctx -> {
                    String url = String.valueOf(ctx.get("sourceUrl"));
                    String title = urlToTitle.getOrDefault(url, null);
                    return new RagContextItem(null, null, url, title,
                            String.valueOf(ctx.get("source_type")), null, null);
                })
                .toList();

        return new ResearchResponse(company.getName(), result.answer(), externalContexts);
    }

    public record ResearchResponse(String companyName, String answer, List<RagContextItem> externalContexts) {}
}