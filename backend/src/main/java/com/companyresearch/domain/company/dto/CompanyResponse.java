package com.companyresearch.domain.company.dto;

import com.companyresearch.domain.company.entity.Company;

import java.time.LocalDateTime;

public class CompanyResponse {

    // API 응답에 노출할 회사 식별/표시값
    private final Long id;
    private final String name;
    private final String website;
    private final String description;
    private final String companyType;
    private final LocalDateTime lastCrawledAt;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    public CompanyResponse(Long id, String name, String website, String description, String companyType, LocalDateTime lastCrawledAt, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.name = name;
        this.website = website;
        this.description = description;
        this.companyType = companyType;
        this.lastCrawledAt = lastCrawledAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    // 엔티티 -> 응답 DTO 변환 포인트.
    // 조회/로그 추적에서 엔티티 직접 노출을 방지.
    public static CompanyResponse from(Company company) {
        return new CompanyResponse(
                company.getId(),
                company.getName(),
                company.getWebsite(),
                company.getDescription(),
                company.getCompanyType(),
                company.getLastCrawledAt(),
                company.getCreatedAt(),
                company.getUpdatedAt()
        );
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getWebsite() { return website; }
    public String getDescription() { return description; }
    public String getCompanyType() { return companyType; }
    public LocalDateTime getLastCrawledAt() { return lastCrawledAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
