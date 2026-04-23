package com.companyresearch.domain.document.service;

import com.companyresearch.domain.document.entity.CompanyDocument;
import com.companyresearch.domain.document.repository.CompanyDocumentRepository;
import com.companyresearch.domain.document.repository.DocumentEmbeddingJdbcRepository;
import com.companyresearch.domain.document.repository.DocumentEmbeddingJdbcRepository.DocumentEmbeddingSearchRow;
import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.logging.service.ActivityLogService;
import com.companyresearch.infra.client.ai.AiServiceClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.junit.jupiter.api.extension.ExtendWith;

import java.lang.reflect.Field;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentEmbeddingServiceTest {

    @Mock
    private CompanyDocumentRepository companyDocumentRepository;

    @Mock
    private DocumentEmbeddingJdbcRepository documentEmbeddingJdbcRepository;

    @Mock
    private AiServiceClient aiServiceClient;

    @Mock
    private ActivityLogService activityLogService;

    private DocumentEmbeddingService documentEmbeddingService;

    @BeforeEach
    void setUp() {
        documentEmbeddingService = new DocumentEmbeddingService(
                companyDocumentRepository,
                documentEmbeddingJdbcRepository,
                aiServiceClient,
                new ObjectMapper(),
                activityLogService
        );
    }

    @Test
    void generateAndStoreEmbeddings_문서가_없으면_0을_반환하고_임베딩_호출하지_않는다() {
        // given
        when(companyDocumentRepository.findByCompanyId(1L)).thenReturn(List.of());

        // when
        int savedCount = documentEmbeddingService.generateAndStoreEmbeddings(1L);

        // then
        assertEquals(0, savedCount);
        verify(companyDocumentRepository).findByCompanyId(1L);
        verifyNoInteractions(aiServiceClient);
        verifyNoInteractions(documentEmbeddingJdbcRepository);
    }

    @Test
    void generateAndStoreEmbeddings_메타_임베딩_벡터가_요청한_청크수만큼_적재된다() {
        // given
        String meta = """
                {
                  "chunk_count": 3,
                  "chunks": ["첫 번째 청크", "두 번째 청크", "   "]
                }
                """;
        CompanyDocument document = CompanyDocument.of(
                10L,
                "https://example.com",
                "about",
                "raw",
                "content",
                "example",
                "ko",
                meta
        );
        setFieldValue(document, "id", 1L);
        when(companyDocumentRepository.findByCompanyId(10L)).thenReturn(List.of(document));
        when(aiServiceClient.generateEmbeddings(anyList())).thenReturn(List.of(
                List.of(0.1, 0.2),
                List.of(0.3, 0.4),
                List.of(0.5, 0.6)
        ));
        when(documentEmbeddingJdbcRepository.insertEmbedding(anyLong(), anyInt(), anyString(), anyString(), anyString()))
                .thenReturn(1);

        // when
        int savedCount = documentEmbeddingService.generateAndStoreEmbeddings(10L);

        // then
        assertEquals(2, savedCount);
        verify(documentEmbeddingJdbcRepository).deleteByDocumentIds(List.of(document.getId()));
        verify(documentEmbeddingJdbcRepository, times(2)).insertEmbedding(anyLong(), anyInt(), anyString(), anyString(), anyString());
        verify(aiServiceClient).generateEmbeddings(List.of("첫 번째 청크", "두 번째 청크"));

        ArgumentCaptor<List<String>> chunkCaptor = ArgumentCaptor.forClass(List.class);
        verify(aiServiceClient).generateEmbeddings(chunkCaptor.capture());
        assertEquals(List.of("첫 번째 청크", "두 번째 청크"), chunkCaptor.getValue());
    }

    @Test
    void searchSimilarEmbeddings_쿼리_임베딩과_topK_기본값을_사용해_검색_결과를_매핑한다() {
        // given
        when(aiServiceClient.generateEmbeddings(List.of("회사 소개는 뭐지?")))
                .thenReturn(List.of(List.of(0.1, 0.2, 0.3)));

        DocumentEmbeddingSearchRow row = new DocumentEmbeddingSearchRow(
                99L,
                1,
                "chunk-text",
                0.1234d,
                "https://example.com",
                "about",
                "회사 소개"
        );
        when(documentEmbeddingJdbcRepository.searchByCompanyIdHybrid(10L, "[0.10000000,0.20000000,0.30000000]", "%회사 소개는 뭐지?%", 5))
                .thenReturn(List.of(row));

        // when
        List<DocumentSearchResponseItem> result = documentEmbeddingService.searchSimilarEmbeddings(
                10L,
                new DocumentSearchRequest("회사 소개는 뭐지?", null)
        );

        // then
        assertEquals(1, result.size());
        assertEquals(99L, result.get(0).getDocumentId());
        assertEquals("chunk-text", result.get(0).getContent());
        verify(documentEmbeddingJdbcRepository).searchByCompanyIdHybrid(
                10L,
                "[0.10000000,0.20000000,0.30000000]",
                "%회사 소개는 뭐지?%",
                5
        );
        verify(activityLogService).logSearchResults(
                eq(10L),
                isNull(),
                eq(ActivityLogService.REQUEST_TYPE_DOCUMENT_SEARCH),
                eq("회사 소개는 뭐지?"),
                eq("document"),
                anyList()
        );
    }

    private void setFieldValue(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to set field: " + fieldName, e);
        }
    }

    @Test
    void searchSimilarEmbeddings_임베딩_응답이_비면_빈_결과를_반환한다() {
        // given
        when(aiServiceClient.generateEmbeddings(List.of("임베딩 실패"))).thenReturn(List.of());

        // when
        List<DocumentSearchResponseItem> result = documentEmbeddingService.searchSimilarEmbeddings(
                10L,
                new DocumentSearchRequest("임베딩 실패", 3)
        );

        // then
        assertTrue(result.isEmpty());
        verify(documentEmbeddingJdbcRepository, never()).searchByCompanyIdAndVector(anyLong(), anyString(), anyInt());
    }
}
