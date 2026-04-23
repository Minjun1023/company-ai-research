from __future__ import annotations

"""하이브리드 검색의 실제 구현 위치를 설명하는 placeholder 모듈.

현재 벡터 + 키워드 결합 검색은 Java 백엔드에서 수행하고,
FastAPI 쪽에는 동일 개념의 알고리즘 설명만 남겨 둔다.
"""

# 하이브리드 검색(벡터 + 키워드 RRF)은 DB 접근이 필요해 Java 백엔드에서 구현합니다.
# 구현 위치: DocumentEmbeddingJdbcRepository.searchByCompanyIdHybrid()
#
# 알고리즘: Reciprocal Rank Fusion
#   rrf_score = 1/(vec_rank + 60) + 1/(kw_rank + 60)
#   - vec_rank : pgvector 코사인 거리 기반 순위
#   - kw_rank  : PostgreSQL ILIKE 키워드 매칭 순위
#   - 두 검색 모두 top-(topK * 3) 후보를 추출 후 FULL OUTER JOIN 으로 결합
#
# FastAPI AI 서비스에서 별도 검색이 필요한 경우 DB 연결 설정 후 구현할 수 있습니다.
