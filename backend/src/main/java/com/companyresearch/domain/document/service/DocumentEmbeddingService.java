package com.companyresearch.domain.document.service;

import com.companyresearch.domain.document.entity.CompanyDocument;
import com.companyresearch.domain.document.repository.CompanyDocumentRepository;
import com.companyresearch.domain.document.repository.DocumentEmbeddingJdbcRepository;
import com.companyresearch.domain.document.repository.DocumentEmbeddingJdbcRepository.DocumentEmbeddingSearchRow;
import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.infra.client.ai.AiServiceClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.companyresearch.domain.logging.service.ActivityLogService;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

// 크롤링 문서의 chunk 임베딩을 생성하고 document_embeddings를 쓰고 읽는다.
@Service
public class DocumentEmbeddingService {

    private static final int MAX_TOP_K = 20;
    private static final int MIN_TOP_K = 1;

    private final CompanyDocumentRepository companyDocumentRepository;
    private final DocumentEmbeddingJdbcRepository documentEmbeddingJdbcRepository;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;
    private final ActivityLogService activityLogService;

    public DocumentEmbeddingService(CompanyDocumentRepository companyDocumentRepository,
                                  DocumentEmbeddingJdbcRepository documentEmbeddingJdbcRepository,
                                  AiServiceClient aiServiceClient,
                                  ObjectMapper objectMapper,
                                  ActivityLogService activityLogService) {
        this.companyDocumentRepository = companyDocumentRepository;
        this.documentEmbeddingJdbcRepository = documentEmbeddingJdbcRepository;
        this.aiServiceClient = aiServiceClient;
        this.objectMapper = objectMapper;
        this.activityLogService = activityLogService;
    }

    // 회사 단위로 모든 크롤링 chunk를 임베딩하고 document_embeddings에 적재한다.
    @Transactional
    public int generateAndStoreEmbeddings(Long companyId) {
        List<CompanyDocument> documents = companyDocumentRepository.findByCompanyId(companyId);

        if (documents.isEmpty()) {
            return 0;
        }

        List<Long> documentIds = documents.stream()
                .map(CompanyDocument::getId)
                .toList();
        documentEmbeddingJdbcRepository.deleteByDocumentIds(documentIds);

        int savedCount = 0;

        for (CompanyDocument document : documents) {
            List<String> chunks = parseChunks(document.getMeta());
            if (chunks.isEmpty()) {
                continue;
            }

            List<List<Double>> embeddings = aiServiceClient.generateEmbeddings(chunks);
            int limit = Math.min(chunks.size(), embeddings.size());

            for (int i = 0; i < limit; i++) {
                String vector = toPgVector(embeddings.get(i));
                String metadata = buildMetadata(document, i, chunks.get(i));

                documentEmbeddingJdbcRepository.insertEmbedding(
                        document.getId(),
                        i,
                        chunks.get(i),
                        vector,
                        metadata
                );
                savedCount++;
            }
        }

        return savedCount;
    }

    // 질문 텍스트를 임베딩해 top-k 유사 chunk를 반환한다 (벡터 + 키워드 하이브리드 검색).
    @Transactional
    public List<DocumentSearchResponseItem> searchSimilarEmbeddings(Long companyId, DocumentSearchRequest request) {
        String query = request.getQuery();
        int topK = normalizeTopK(request.getTopK());
        List<List<Double>> queryEmbeddings = aiServiceClient.generateEmbeddings(List.of(query));

        if (queryEmbeddings.isEmpty()) {
            return List.of();
        }

        String queryVector = toPgVector(queryEmbeddings.get(0));
        String keywordPattern = "%" + query + "%";
        String sourceTypeFilter = request.getSourceTypeFilter();

        List<DocumentEmbeddingSearchRow> rows = documentEmbeddingJdbcRepository.searchByCompanyIdHybrid(
                companyId,
                queryVector,
                keywordPattern,
                topK,
                sourceTypeFilter
        );

        List<DocumentSearchResponseItem> items = rows.stream()
                .map(row -> new DocumentSearchResponseItem(
                        row.documentId(),
                        row.chunkIndex(),
                        row.sourceUrl(),
                        row.sourceType(),
                        row.pageTitle(),
                        row.content(),
                        row.distance()
                ))
                .toList();

        activityLogService.logSearchResults(
                companyId,
                null,
                ActivityLogService.REQUEST_TYPE_DOCUMENT_SEARCH,
                query,
                "document",
                items
        );
        return items;
    }

    private int normalizeTopK(Integer topK) {
        if (topK == null) {
            return 5;
        }
        if (topK < MIN_TOP_K) {
            return MIN_TOP_K;
        }
        if (topK > MAX_TOP_K) {
            return MAX_TOP_K;
        }
        return topK;
    }

    private String toPgVector(List<Double> vector) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < vector.size(); i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append(String.format(Locale.US, "%.8f", vector.get(i)));
        }
        builder.append(']');
        return builder.toString();
    }

    private String buildMetadata(CompanyDocument document, int chunkIndex, String chunkText) {
        return String.format(
                Locale.US,
                "{\"document_id\":%d,\"chunk_index\":%d,\"source_type\":\"%s\",\"page_title\":\"%s\",\"chunk_length\":%d}",
                document.getId(),
                chunkIndex,
                escape(document.getSourceType()),
                escape(document.getPageTitle()),
                chunkText != null ? chunkText.length() : 0
        );
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private List<String> parseChunks(String meta) {
        if (meta == null || meta.isBlank()) {
            return List.of();
        }

        try {
            JsonNode root = objectMapper.readTree(meta);
            JsonNode chunks = root.path("chunks");
            if (!chunks.isArray()) {
                return List.of();
            }

            List<String> chunkTexts = new ArrayList<>();
            chunks.forEach(chunkNode -> {
                if (chunkNode.isTextual()) {
                    String text = chunkNode.asText().trim();
                    if (!text.isBlank()) {
                        chunkTexts.add(text);
                    }
                }
            });
            return chunkTexts;
        } catch (Exception e) {
            return List.of();
        }
    }
}
