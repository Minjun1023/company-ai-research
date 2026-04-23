package com.companyresearch.domain.question.dto;

// 검색된 문서 청크를 LLM 호출에 전달할 때 쓰는 최소한의 문맥 표현.
public class RagContextItem {
    private final Long documentId;
    private final Integer chunkIndex;
    private final String sourceUrl;
    private final String pageTitle;
    private final String sourceType;
    private final String content;
    private final Double score;

    public RagContextItem(Long documentId, Integer chunkIndex, String sourceUrl, String pageTitle, String sourceType, String content, Double score) {
        this.documentId = documentId;
        this.chunkIndex = chunkIndex;
        this.sourceUrl = sourceUrl;
        this.pageTitle = pageTitle;
        this.sourceType = sourceType;
        this.content = content;
        this.score = score;
    }

    public static RagContextItem fromDocumentSearchItem(com.companyresearch.domain.company.dto.DocumentSearchResponseItem item) {
        return new RagContextItem(
                item.getDocumentId(),
                item.getChunkIndex(),
                item.getSourceUrl(),
                item.getPageTitle(),
                item.getSourceType(),
                item.getContent(),
                item.getScore()
        );
    }

    public Long getDocumentId() {
        return documentId;
    }

    public Integer getChunkIndex() {
        return chunkIndex;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public String getPageTitle() {
        return pageTitle;
    }

    public String getSourceType() {
        return sourceType;
    }

    public String getContent() {
        return content;
    }

    public Double getScore() {
        return score;
    }

    public String getSnippet(int maxLength) {
        if (content == null) {
            return "";
        }
        String normalized = content.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength) + "...";
    }
}
