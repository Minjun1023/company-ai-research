package com.companyresearch.domain.company.dto;

import com.companyresearch.infra.client.ai.CrawlResult;

import java.util.List;
import java.util.Map;

// 백엔드의 회사 크롤링 API 응답 DTO.
// AI Service에서 받아온 링크/텍스트 추출 결과를 그대로 전달한다.
public class CompanyCrawlResponse {
    private final Long companyId;
    private final String sourceUrl;
    private final List<String> links;
    private final Map<String, List<String>> pageTypeMap;
    private final Map<String, String> extractedText;
    private final Integer savedDocumentCount;
    private final Integer totalChunkCount;
    private final Integer embeddedChunkCount;

    public CompanyCrawlResponse(Long companyId,
                               String sourceUrl,
                               List<String> links,
                               Map<String, List<String>> pageTypeMap,
                               Map<String, String> extractedText,
                               Integer savedDocumentCount,
                               Integer totalChunkCount,
                               Integer embeddedChunkCount) {
        this.companyId = companyId;
        this.sourceUrl = sourceUrl;
        this.links = links;
        this.pageTypeMap = pageTypeMap;
        this.extractedText = extractedText;
        this.savedDocumentCount = savedDocumentCount;
        this.totalChunkCount = totalChunkCount;
        this.embeddedChunkCount = embeddedChunkCount;
    }

    public static CompanyCrawlResponse from(Long companyId, CrawlResult crawlResult, int savedDocumentCount, int embeddedChunkCount) {
        int chunkCount = crawlResult.getDocuments() == null ? 0
                : crawlResult.getDocuments().stream()
                .mapToInt(document -> document.getChunks() == null ? 0 : document.getChunks().size())
                .sum();

        return new CompanyCrawlResponse(
                companyId,
                crawlResult.getSourceUrl(),
                crawlResult.getLinks(),
                crawlResult.getPageTypeMap(),
                crawlResult.getExtractedText(),
                savedDocumentCount,
                chunkCount,
                embeddedChunkCount
        );
    }

    public Long getCompanyId() {
        return companyId;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public List<String> getLinks() {
        return links;
    }

    public Map<String, List<String>> getPageTypeMap() {
        return pageTypeMap;
    }

    public Map<String, String> getExtractedText() {
        return extractedText;
    }

    public Integer getSavedDocumentCount() {
        return savedDocumentCount;
    }

    public Integer getTotalChunkCount() {
        return totalChunkCount;
    }

    public Integer getEmbeddedChunkCount() {
        return embeddedChunkCount;
    }
}
