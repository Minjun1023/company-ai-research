package com.companyresearch.domain.logging.repository;

import com.companyresearch.domain.logging.entity.SearchLog;
import org.springframework.data.jpa.repository.JpaRepository;

// 검색 결과 로그 데이터 접근 계층.
public interface SearchLogRepository extends JpaRepository<SearchLog, Long> {
}
