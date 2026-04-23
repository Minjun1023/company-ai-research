package com.companyresearch.domain.question.dto;

import com.companyresearch.domain.question.entity.Question;

import java.time.LocalDateTime;

// 질문 저장/응답 API의 공통 응답 DTO.
public class QuestionResponse {
    private final Long id;
    private final Long companyId;
    private final String userQuestionType;
    private final String questionText;
    private final String answerText;
    private final String sourceType;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    public QuestionResponse(Long id, Long companyId, String userQuestionType, String questionText, String answerText, String sourceType,
                           LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.companyId = companyId;
        this.userQuestionType = userQuestionType;
        this.questionText = questionText;
        this.answerText = answerText;
        this.sourceType = sourceType;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static QuestionResponse from(Question question) {
        return new QuestionResponse(
                question.getId(),
                question.getCompanyId(),
                question.getUserQuestionType(),
                question.getQuestionText(),
                question.getAnswerText(),
                question.getSourceType(),
                question.getCreatedAt(),
                question.getUpdatedAt()
        );
    }

    public Long getId() {
        return id;
    }

    public Long getCompanyId() {
        return companyId;
    }

    public String getUserQuestionType() {
        return userQuestionType;
    }

    public String getQuestionText() {
        return questionText;
    }

    public String getAnswerText() {
        return answerText;
    }

    public String getSourceType() {
        return sourceType;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}

