package com.companyresearch.domain.logging.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

// 검색 단계(문서/리뷰 검색) 이력을 저장하는 로그 엔티티.
@Entity
@Table(name = "search_logs")
public class SearchLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "question_id")
    private Long questionId;

    @Column(name = "request_type", nullable = false, length = 80)
    private String requestType;

    @Column(name = "query_text", nullable = false, columnDefinition = "TEXT")
    private String queryText;

    @Column(name = "source_type", nullable = false, length = 100)
    private String sourceType;

    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "score")
    private Double score;

    @Column(name = "rank_order")
    private Integer rankOrder;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    protected SearchLog() {
    }

    private SearchLog(Long companyId,
                      Long questionId,
                      String requestType,
                      String queryText,
                      String sourceType,
                      Long sourceId,
                      Double score,
                      Integer rankOrder) {
        this.companyId = companyId;
        this.questionId = questionId;
        this.requestType = requestType;
        this.queryText = queryText;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.score = score;
        this.rankOrder = rankOrder;
    }

    public static SearchLog of(Long companyId,
                              Long questionId,
                              String requestType,
                              String queryText,
                              String sourceType,
                              Long sourceId,
                              Double score,
                              Integer rankOrder) {
        return new SearchLog(
                companyId,
                questionId,
                requestType,
                queryText,
                sourceType,
                sourceId,
                score,
                rankOrder
        );
    }

    @PrePersist
    // 검색 로그는 기록 시각을 즉시 저장한다.
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getCompanyId() {
        return companyId;
    }

    public Long getQuestionId() {
        return questionId;
    }

    public String getRequestType() {
        return requestType;
    }

    public String getQueryText() {
        return queryText;
    }

    public String getSourceType() {
        return sourceType;
    }

    public Long getSourceId() {
        return sourceId;
    }

    public Double getScore() {
        return score;
    }

    public Integer getRankOrder() {
        return rankOrder;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
