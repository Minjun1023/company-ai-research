package com.companyresearch.domain.question.dto;

import jakarta.validation.constraints.NotBlank;

// 질문 저장 API의 입력 스키마.
public class CreateQuestionRequest {

    @NotBlank
    private String questionText;

    protected CreateQuestionRequest() {
    }

    public CreateQuestionRequest(String questionText) {
        this.questionText = questionText;
    }

    public String getQuestionText() {
        return questionText;
    }

    public void setQuestionText(String questionText) {
        this.questionText = questionText;
    }
}

