package com.companyresearch.domain.company.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

// 회사 마스터 데이터의 영속 엔티티.
// 이름, 사이트, 설명을 저장하고 생성/수정 시각을 추적한다.
@Entity
@Table(name = "companies")
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 회사명: 반드시 필수, 기본 조회/표시 기준이 되는 필드
    @NotBlank
    @Size(max = 255)
    @Column(nullable = false, length = 255)
    private String name;

    // 계정별 회사 소유 식별자
    @Column(name = "user_id")
    private Long userId;

    // 사이트 URL (계정별 독립 저장이므로 unique 제약 제거)
    @Size(max = 1024)
    @Column(length = 1024)
    private String website;

    // DART 전자공시 고유 법인 코드 (8자리). 이름 매핑 없이 직접 API 조회에 사용한다.
    @Column(name = "dart_corp_code", length = 8)
    private String dartCorpCode;

    // DART 업종명 (예: 전자부품, 소프트웨어 개발)
    @Column(name = "company_type", length = 100)
    private String companyType;

    // 회사 설명/요약 텍스트
    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "last_crawled_at")
    private LocalDateTime lastCrawledAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // JPA 기본 생성자
    protected Company() {
    }

    // DTO 변환용 생성자
    public Company(Long userId, String name, String website, String description) {
        this.userId = userId;
        this.name = name;
        this.website = website;
        this.description = description;
    }

    // 최초 저장 시점에 생성/수정 시각 동기화
    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    // 엔티티 수정 시점 동기화
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }

    public String getName() {
        return name;
    }

    public String getWebsite() {
        return website;
    }

    public String getDescription() {
        return description;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getLastCrawledAt() {
        return lastCrawledAt;
    }

    public void updateLastCrawledAt() {
        this.lastCrawledAt = LocalDateTime.now();
    }

    public String getDartCorpCode() {
        return dartCorpCode;
    }

    // Naver 검색 등으로 자동 탐색된 URL을 저장할 때 사용한다.
    public void updateWebsite(String website) {
        this.website = website;
    }

    // Naver 검색으로 확인된 공식 회사명으로 업데이트한다.
    public void updateName(String name) {
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
    }

    public String getCompanyType() {
        return companyType;
    }

    // DART corp_code를 저장한다. null 또는 blank이면 무시한다.
    public void updateDartCorpCode(String dartCorpCode) {
        if (dartCorpCode != null && !dartCorpCode.isBlank()) {
            this.dartCorpCode = dartCorpCode;
        }
    }

    public void updateCompanyType(String companyType) {
        if (companyType != null && !companyType.isBlank()) {
            this.companyType = companyType;
        }
    }
}
