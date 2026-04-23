package com.companyresearch.domain.question.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

// 회사 질문을 저장하고 RAG 응답 이력을 남기는 엔티티.
@Entity
@Table(name = "questions")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_question_type", length = 40)
    private String userQuestionType;

    @Column(name = "question_text", nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "source_type", length = 100)
    private String sourceType;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected Question() {
    }

    private Question(Long companyId, Long userId, String userQuestionType, String questionText, String answerText, String sourceType) {
        this.companyId = companyId;
        this.userId = userId;
        this.userQuestionType = userQuestionType;
        this.questionText = questionText;
        this.answerText = answerText;
        this.sourceType = sourceType;
    }

    public static Question of(Long companyId, Long userId, String userQuestionType, String questionText, String answerText, String sourceType) {
        return new Question(companyId, userId, userQuestionType, questionText, answerText, sourceType);
    }

    @PrePersist
    // 최초 저장일 때 생성/수정 시각을 함께 기록한다.
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    // 답변이 갱신되는 경우 updatedAt을 최신화한다.
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public void fillAnswer(String answerText) {
        this.answerText = answerText;
    }

    public Long getId() {
        return id;
    }

    public Long getCompanyId() {
        return companyId;
    }

    public Long getUserId() {
        return userId;
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

