package com.companyresearch.infra.client.ai;

import com.fasterxml.jackson.annotation.JsonAlias;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

// AI Service 임베딩 API 응답 DTO.
public class EmbeddingResponse {
    private String model;
    @JsonAlias("embeddings")
    private List<List<Double>> embeddings;

    @JsonAlias("data")
    private List<EmbeddingData> data;

    private Map<String, Object> metadata;

    public EmbeddingResponse() {
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public List<List<Double>> getEmbeddings() {
        if (embeddings != null) {
            return embeddings;
        }

        if (data == null || data.isEmpty()) {
            return List.of();
        }

        return data.stream()
                .sorted(Comparator.comparingInt(EmbeddingData::getIndex))
                .map(EmbeddingData::getEmbedding)
                .toList();
    }

    public void setEmbeddings(List<List<Double>> embeddings) {
        this.embeddings = embeddings;
    }

    public List<EmbeddingData> getData() {
        return data;
    }

    public void setData(List<EmbeddingData> data) {
        this.data = data;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public static class EmbeddingData {
        private Integer index;
        private List<Double> embedding;

        public EmbeddingData() {
        }

        public Integer getIndex() {
            return index;
        }

        public void setIndex(Integer index) {
            this.index = index;
        }

        public List<Double> getEmbedding() {
            return embedding;
        }

        public void setEmbedding(List<Double> embedding) {
            this.embedding = embedding;
        }
    }
}
