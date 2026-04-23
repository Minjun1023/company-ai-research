package com.companyresearch.infra.client.ai;

import java.util.List;

// AI Service 임베딩 API 입력 DTO.
public class EmbeddingRequest {
    private List<String> texts;
    private String model;

    public EmbeddingRequest() {
    }

    public EmbeddingRequest(List<String> texts, String model) {
        this.texts = texts;
        this.model = model;
    }

    public List<String> getTexts() {
        return texts;
    }

    public void setTexts(List<String> texts) {
        this.texts = texts;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }
}
