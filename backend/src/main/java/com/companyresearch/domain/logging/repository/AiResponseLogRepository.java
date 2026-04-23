package com.companyresearch.domain.logging.repository;

import com.companyresearch.domain.logging.entity.AiResponseLog;
import org.springframework.data.jpa.repository.JpaRepository;

// AI 응답 로그 데이터 접근 계층.
public interface AiResponseLogRepository extends JpaRepository<AiResponseLog, Long> {
}
