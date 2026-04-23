package com.companyresearch.infra.client.ai;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

// AI Service가 반환하는 문서 처리 결과 단위.
@JsonIgnoreProperties(ignoreUnknown = true)
public class CrawledDocument {
    @JsonAlias({"source_url", "sourceUrl"})
    private String sourceUrl;
    @JsonAlias({"page_title", "pageTitle"})
    private String pageTitle;
    @JsonAlias({"page_type", "pageType"})
    private String pageType;
    @JsonAlias({"raw_text", "rawText"})
    private String rawText;
    @JsonAlias({"cleaned_text", "cleanedText"})
    private String cleanedText;
    @JsonAlias({"chunks"})
    private List<String> chunks;

    public CrawledDocument() {
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public String getPageTitle() {
        return pageTitle;
    }

    public void setPageTitle(String pageTitle) {
        this.pageTitle = pageTitle;
    }

    public String getPageType() {
        return pageType;
    }

    public void setPageType(String pageType) {
        this.pageType = pageType;
    }

    public String getRawText() {
        return rawText;
    }

    public void setRawText(String rawText) {
        this.rawText = rawText;
    }

    public String getCleanedText() {
        return cleanedText;
    }

    public void setCleanedText(String cleanedText) {
        this.cleanedText = cleanedText;
    }

    public List<String> getChunks() {
        return chunks;
    }

    public void setChunks(List<String> chunks) {
        this.chunks = chunks;
    }
}
