package com.companyresearch.domain.question.dto;

import java.util.List;

// 질문 응답 + 검색 콘텍스트 + prompt 정보를 반환하는 DTO.
public class AskQuestionResponse {
    private final QuestionResponse question;
    private final String prompt;
    private final List<RagContextItem> contexts;
    private final List<RagContextItem> externalContexts;

    public AskQuestionResponse(QuestionResponse question, String prompt, List<RagContextItem> contexts, List<RagContextItem> externalContexts) {
        this.question = question;
        this.prompt = prompt;
        this.contexts = contexts;
        this.externalContexts = externalContexts;
    }

    public QuestionResponse getQuestion() {
        return question;
    }

    public String getPrompt() {
        return prompt;
    }

    public List<RagContextItem> getContexts() {
        return contexts;
    }

    public List<RagContextItem> getExternalContexts() {
        return externalContexts;
    }
}

