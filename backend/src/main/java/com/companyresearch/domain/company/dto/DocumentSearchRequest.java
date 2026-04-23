package com.companyresearch.domain.company.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

// 회사 문서 유사도 검색 요청 DTO.
public class DocumentSearchRequest {
    @jakarta.validation.constraints.NotBlank
    private String query;

    @Min(1)
    @Max(20)
    private Integer topK;

    // null 이면 source_type 제한 없이 전체 검색. "careers" 등으로 지정하면 해당 타입만 검색.
    private String sourceTypeFilter;

    protected DocumentSearchRequest() {
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public DocumentSearchRequest(String query, Integer topK) {
        this.query = query;
        this.topK = topK;
    }

    public DocumentSearchRequest(String query, Integer topK, String sourceTypeFilter) {
        this.query = query;
        this.topK = topK;
        this.sourceTypeFilter = sourceTypeFilter;
    }

    public String getQuery() {
        return query;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }

    public String getSourceTypeFilter() {
        return sourceTypeFilter;
    }

    public void setSourceTypeFilter(String sourceTypeFilter) {
        this.sourceTypeFilter = sourceTypeFilter;
    }
}
