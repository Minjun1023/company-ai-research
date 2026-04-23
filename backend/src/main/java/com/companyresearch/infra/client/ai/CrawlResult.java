package com.companyresearch.infra.client.ai;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;
import java.util.Map;

// 크롤링 결과를 백엔드에 전달받아 도메인으로 전달하기 위한 DTO.
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CrawlResult {
    private String sourceUrl;
    private List<String> links;
    private Map<String, List<String>> pageTypeMap;
    private Map<String, String> extractedText;
    private List<CrawledDocument> documents;

    public CrawlResult() {
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public List<String> getLinks() {
        return links;
    }

    public void setLinks(List<String> links) {
        this.links = links;
    }

    public Map<String, List<String>> getPageTypeMap() {
        return pageTypeMap;
    }

    public void setPageTypeMap(Map<String, List<String>> pageTypeMap) {
        this.pageTypeMap = pageTypeMap;
    }

    public Map<String, String> getExtractedText() {
        return extractedText;
    }

    public void setExtractedText(Map<String, String> extractedText) {
        this.extractedText = extractedText;
    }

    public List<CrawledDocument> getDocuments() {
        return documents;
    }

    public void setDocuments(List<CrawledDocument> documents) {
        this.documents = documents;
    }
}
