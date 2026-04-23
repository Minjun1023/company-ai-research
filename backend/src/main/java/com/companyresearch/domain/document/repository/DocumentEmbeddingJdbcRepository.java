package com.companyresearch.domain.document.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

// company_documents 단위를 넘어, document_embeddings 테이블을 직접 조작한다.
@Repository
public class DocumentEmbeddingJdbcRepository {

    private final JdbcTemplate jdbcTemplate;

    public DocumentEmbeddingJdbcRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int insertEmbedding(long documentId, int chunkIndex, String chunkContent, String embeddingVector, String metadata) {
        String sql = """
            INSERT INTO document_embeddings (document_id, chunk_index, embedding, content, metadata)
            VALUES (?, ?, ?::vector, ?, CAST(? AS jsonb))
            ON CONFLICT (document_id, chunk_index)
            DO UPDATE SET embedding = EXCLUDED.embedding,
                          content = EXCLUDED.content,
                          metadata = EXCLUDED.metadata
        """;

        return jdbcTemplate.update(sql, documentId, chunkIndex, embeddingVector, chunkContent, metadata);
    }

    public int deleteByDocumentIds(List<Long> documentIds) {
        if (documentIds == null || documentIds.isEmpty()) {
            return 0;
        }

        String placeholders = String.join(",", java.util.Collections.nCopies(documentIds.size(), "?"));
        String sql = "DELETE FROM document_embeddings WHERE document_id IN (" + placeholders + ")";
        return jdbcTemplate.update(sql, documentIds.toArray());
    }

    public List<DocumentEmbeddingSearchRow> searchByCompanyIdAndVector(Long companyId, String queryVector, int topK) {
        String sql = """
            SELECT de.document_id,
                   de.chunk_index,
                   de.content,
                   de.embedding <-> CAST(? AS vector) AS distance,
                   cd.source_url,
                   cd.source_type,
                   cd.page_title
            FROM document_embeddings de
            JOIN company_documents cd
              ON cd.id = de.document_id
            WHERE cd.company_id = ?
            ORDER BY distance ASC
            LIMIT ?
        """;

        RowMapper<DocumentEmbeddingSearchRow> mapper = (rs, rowNum) ->
                new DocumentEmbeddingSearchRow(
                        rs.getLong("document_id"),
                        rs.getInt("chunk_index"),
                        rs.getString("content"),
                        rs.getDouble("distance"),
                        rs.getString("source_url"),
                        rs.getString("source_type"),
                        rs.getString("page_title")
                );

        return jdbcTemplate.query(sql, mapper, queryVector, companyId, topK);
    }

    /**
     * 벡터 검색과 키워드 검색을 RRF(Reciprocal Rank Fusion)로 결합한 하이브리드 검색.
     * rrf_score = 1/(vec_rank + 60) + 1/(kw_rank + 60)
     * 결과의 distance 컬럼에는 rrf_score가 담긴다 (높을수록 관련도 높음).
     */
    public List<DocumentEmbeddingSearchRow> searchByCompanyIdHybrid(
            Long companyId, String queryVector, String keywordPattern, int topK) {
        return searchByCompanyIdHybrid(companyId, queryVector, keywordPattern, topK, null);
    }

    /**
     * sourceTypeFilter 가 null 이 아니면 해당 source_type 문서만 검색한다.
     */
    public List<DocumentEmbeddingSearchRow> searchByCompanyIdHybrid(
            Long companyId, String queryVector, String keywordPattern, int topK, String sourceTypeFilter) {

        int candidatePool = topK * 3;
        boolean filtered = sourceTypeFilter != null && !sourceTypeFilter.isBlank();

        String sourceTypeClause = filtered ? "AND cd.source_type = ?" : "";

        String sql = """
            WITH vector_base AS (
                SELECT de.document_id,
                       de.chunk_index,
                       de.content,
                       cd.source_url,
                       cd.source_type,
                       cd.page_title,
                       de.embedding <-> CAST(? AS vector) AS distance
                FROM document_embeddings de
                JOIN company_documents cd ON cd.id = de.document_id
                WHERE cd.company_id = ?
                """ + sourceTypeClause + """
                ORDER BY distance ASC
                LIMIT ?
            ),
            vector_ranked AS (
                SELECT *, ROW_NUMBER() OVER (ORDER BY distance ASC) AS rank
                FROM vector_base
            ),
            keyword_ranked AS (
                SELECT de.document_id,
                       de.chunk_index,
                       1 AS rank
                FROM document_embeddings de
                JOIN company_documents cd ON cd.id = de.document_id
                WHERE cd.company_id = ?
                  AND de.content ILIKE ?
                """ + sourceTypeClause + """
                LIMIT ?
            )
            SELECT
                COALESCE(v.document_id, k.document_id)  AS document_id,
                COALESCE(v.chunk_index, k.chunk_index)  AS chunk_index,
                COALESCE(v.content,    '')              AS content,
                COALESCE(v.source_url, '')              AS source_url,
                COALESCE(v.source_type,'')              AS source_type,
                COALESCE(v.page_title, '')              AS page_title,
                1.0 / (COALESCE(v.rank::float, 1000) + 60)
              + 1.0 / (COALESCE(k.rank::float, 1000) + 60) AS rrf_score
            FROM vector_ranked v
            FULL OUTER JOIN keyword_ranked k
                ON v.document_id = k.document_id
               AND v.chunk_index = k.chunk_index
            ORDER BY rrf_score DESC
            LIMIT ?
        """;

        RowMapper<DocumentEmbeddingSearchRow> mapper = (rs, rowNum) ->
                new DocumentEmbeddingSearchRow(
                        rs.getLong("document_id"),
                        rs.getInt("chunk_index"),
                        rs.getString("content"),
                        rs.getDouble("rrf_score"),
                        rs.getString("source_url"),
                        rs.getString("source_type"),
                        rs.getString("page_title")
                );

        if (filtered) {
            return jdbcTemplate.query(sql, mapper,
                    queryVector, companyId, sourceTypeFilter, candidatePool,
                    companyId, keywordPattern, sourceTypeFilter, candidatePool,
                    topK);
        } else {
            return jdbcTemplate.query(sql, mapper,
                    queryVector, companyId, candidatePool,
                    companyId, keywordPattern, candidatePool,
                    topK);
        }
    }

    public static record DocumentEmbeddingSearchRow(
            Long documentId,
            Integer chunkIndex,
            String content,
            Double distance,
            String sourceUrl,
            String sourceType,
            String pageTitle
    ) {
    }
}
