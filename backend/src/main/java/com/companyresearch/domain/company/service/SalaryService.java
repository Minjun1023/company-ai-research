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

// 연봉 협상 가이드 생성 서비스.
// 회사 공시·크롤링 데이터를 기반으로 협상 전략을 제시한다.
@Service
public class SalaryService {

    private static final int SALARY_TOP_K = 5;

    private final CompanyRepository companyRepository;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final AiServiceClient aiServiceClient;

    public SalaryService(
            CompanyRepository companyRepository,
            DocumentEmbeddingService documentEmbeddingService,
            AiServiceClient aiServiceClient) {
        this.companyRepository = companyRepository;
        this.documentEmbeddingService = documentEmbeddingService;
        this.aiServiceClient = aiServiceClient;
    }

    public record SalaryGuideResponse(String companyName, String answer, List<RagContextItem> externalContexts) {}

    @Transactional
    public SalaryGuideResponse getSalaryGuide(Long companyId, String jobRole, String careerYears) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + companyId));

        List<DocumentSearchResponseItem> searchItems = documentEmbeddingService.searchSimilarEmbeddings(
                company.getId(),
                new DocumentSearchRequest(company.getName() + " 연봉 복지 급여 처우 보상", SALARY_TOP_K)
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

        AiServiceClient.SalaryGuideResult result = aiServiceClient.salaryGuide(
                company.getName(),
                jobRole != null ? jobRole : "",
                careerYears != null ? careerYears : "",
                contexts,
                "gpt-4o-mini"
        );

        List<RagContextItem> externalContexts = result.contexts().stream()
                .filter(ctx -> ctx.get("sourceUrl") != null && !String.valueOf(ctx.get("sourceUrl")).isBlank())
                .map(ctx -> new RagContextItem(null, null, String.valueOf(ctx.get("sourceUrl")), null,
                        String.valueOf(ctx.get("source_type")), null, null))
                .toList();

        return new SalaryGuideResponse(company.getName(), result.answer(), externalContexts);
    }
}
