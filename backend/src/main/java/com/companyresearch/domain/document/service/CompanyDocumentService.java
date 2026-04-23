package com.companyresearch.domain.document.service;

import com.companyresearch.domain.document.entity.CompanyDocument;
import com.companyresearch.domain.document.repository.CompanyDocumentRepository;
import com.companyresearch.infra.client.ai.CrawledDocument;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

// 크롤링 결과 문서를 company_documents 테이블에 적재한다.
@Service
public class CompanyDocumentService {

    private final CompanyDocumentRepository companyDocumentRepository;
    private final ObjectMapper objectMapper;

    public CompanyDocumentService(CompanyDocumentRepository companyDocumentRepository,
                                 ObjectMapper objectMapper) {
        this.companyDocumentRepository = companyDocumentRepository;
        this.objectMapper = objectMapper;
    }

    // 동일 회사 재크롤링 시 기존 문서를 교체해 최신 상태를 유지한다.
    @Transactional
    public int replaceDocuments(Long companyId, List<CrawledDocument> crawledDocuments) {
        companyDocumentRepository.deleteByCompanyId(companyId);

        if (crawledDocuments == null || crawledDocuments.isEmpty()) {
            return 0;
        }

        List<CompanyDocument> entities = crawledDocuments.stream()
                .map(document -> CompanyDocument.of(
                        companyId,
                        document.getSourceUrl(),
                        normalizeSourceType(document.getPageType()),
                        document.getRawText(),
                        document.getCleanedText(),
                        document.getPageTitle(),
                        "ko",
                        buildMetaJson(document.getChunks())
                ))
                .toList();

        companyDocumentRepository.saveAll(entities);
        return entities.size();
    }

    // source_type이 비어있을 때 후속 검색/필터를 위해 기본값을 채운다.
    private String normalizeSourceType(String sourceType) {
        if (sourceType == null || sourceType.isBlank()) {
            return "other";
        }
        return sourceType;
    }

    // 7단계 임베딩 파이프라인 전까지 chunk 수를 jsonb(meta)로 저장한다.
    private String buildMetaJson(List<String> chunks) {
        int chunkCount = (chunks == null) ? 0 : chunks.size();
        Map<String, Object> meta = Map.of(
                "chunk_count", chunkCount,
                "chunks", chunks == null ? List.of() : chunks
        );

        try {
            return objectMapper.writeValueAsString(meta);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
