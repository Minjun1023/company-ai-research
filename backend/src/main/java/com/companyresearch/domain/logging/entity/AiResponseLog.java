package com.companyresearch.domain.logging.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

// AI 응답 단계를 감시하기 위한 로그 엔티티.
@Entity
@Table(name = "ai_response_logs")
public class AiResponseLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "question_id")
    private Long questionId;

    @Column(name = "request_type", nullable = false, length = 80)
    private String requestType;

    @Column(name = "request_text", nullable = false, columnDefinition = "TEXT")
    private String requestText;

    @Column(name = "prompt", nullable = false, columnDefinition = "TEXT")
    private String prompt;

    @Column(name = "answer_text", nullable = false, columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "provider", length = 80)
    private String provider;

    @Column(name = "latency_ms")
    private Long latencyMs;

    @Column(name = "source_type", length = 100)
    private String sourceType;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    protected AiResponseLog() {
    }

    private AiResponseLog(Long companyId, Long questionId, String requestType, String requestText,
                          String prompt, String answerText, String provider, Long latencyMs, String sourceType) {
        this.companyId = companyId;
        this.questionId = questionId;
        this.requestType = requestType;
        this.requestText = requestText;
        this.prompt = prompt;
        this.answerText = answerText;
        this.provider = provider;
        this.latencyMs = latencyMs;
        this.sourceType = sourceType;
    }

    public static AiResponseLog of(Long companyId,
                                  Long questionId,
                                  String requestType,
                                  String requestText,
                                  String prompt,
                                  String answerText,
                                  String provider,
                                  Long latencyMs,
                                  String sourceType) {
        return new AiResponseLog(
                companyId,
                questionId,
                requestType,
                requestText,
                prompt,
                answerText,
                provider,
                latencyMs,
                sourceType
        );
    }

    @PrePersist
    // AI 응답 로그 시각을 정확하게 남긴다.
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

    public String getRequestText() {
        return requestText;
    }

    public String getPrompt() {
        return prompt;
    }

    public String getAnswerText() {
        return answerText;
    }

    public String getProvider() {
        return provider;
    }

    public Long getLatencyMs() {
        return latencyMs;
    }

    public String getSourceType() {
        return sourceType;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
