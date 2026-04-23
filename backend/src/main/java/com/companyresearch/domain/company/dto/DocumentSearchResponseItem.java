package com.companyresearch.domain.company.dto;

// 문서 임베딩 검색 응답 DTO (유사도 순 내림차순은 클라이언트에서 정렬 가능).
public class DocumentSearchResponseItem {
    private final Long documentId;
    private final Integer chunkIndex;
    private final String sourceUrl;
    private final String sourceType;
    private final String pageTitle;
    private final String content;
    private final Double score;

    public DocumentSearchResponseItem(Long documentId,
                                     Integer chunkIndex,
                                     String sourceUrl,
                                     String sourceType,
                                     String pageTitle,
                                     String content,
                                     Double score) {
        this.documentId = documentId;
        this.chunkIndex = chunkIndex;
        this.sourceUrl = sourceUrl;
        this.sourceType = sourceType;
        this.pageTitle = pageTitle;
        this.content = content;
        this.score = score;
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

    public String getSourceType() {
        return sourceType;
    }

    public String getPageTitle() {
        return pageTitle;
    }

    public String getContent() {
        return content;
    }

    public Double getScore() {
        return score;
    }
}
