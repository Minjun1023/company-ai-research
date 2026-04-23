package com.companyresearch.domain.company.repository;

import com.companyresearch.domain.company.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    List<Company> findAllByUserId(Long userId);
    void deleteAllByUserId(Long userId);

    java.util.Optional<Company> findByIdAndUserId(Long id, Long userId);

    boolean existsByIdAndUserId(Long id, Long userId);

    List<Company> findByNameContainingIgnoreCaseAndUserId(String name, Long userId);

    // 마지막 수집일이 기준일보다 오래됐거나 한 번도 수집하지 않은 회사 목록
    @Query("SELECT c FROM Company c WHERE c.website IS NOT NULL AND (c.lastCrawledAt IS NULL OR c.lastCrawledAt < :threshold)")
    List<Company> findStaleCompanies(@Param("threshold") LocalDateTime threshold);
}
