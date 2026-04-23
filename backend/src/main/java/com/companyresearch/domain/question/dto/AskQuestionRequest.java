package com.companyresearch.domain.question.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

// 질문 기반 RAG 질의의 입력 스키마.
public class AskQuestionRequest {

    @NotBlank
    private String questionText;

    @Min(1)
    @Max(20)
    private Integer topK;

    private String userName;

    protected AskQuestionRequest() {
    }

    public AskQuestionRequest(String questionText, Integer topK) {
        this.questionText = questionText;
        this.topK = topK;
    }

    public String getQuestionText() {
        return questionText;
    }

    public void setQuestionText(String questionText) {
        this.questionText = questionText;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }
}

