package com.companyresearch.domain.document.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

// 회사 크롤링 문서의 원문/정제문을 저장하는 엔티티.
@Entity
@Table(name = "company_documents")
public class CompanyDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "company_id", nullable = false)
    private Long companyId;

    @Column(name = "source_url", length = 1024)
    private String sourceUrl;

    @Column(name = "source_type", length = 50)
    private String sourceType;

    @Column(columnDefinition = "TEXT")
    private String source;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "page_title")
    private String pageTitle;

    @Column(length = 20)
    private String language;

    @Column(name = "meta", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String meta;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    protected CompanyDocument() {
    }

    private CompanyDocument(Long companyId, String sourceUrl, String sourceType, String source,
                            String content, String pageTitle, String language, String meta) {
        this.companyId = companyId;
        this.sourceUrl = sourceUrl;
        this.sourceType = sourceType;
        this.source = source;
        this.content = content;
        this.pageTitle = pageTitle;
        this.language = language;
        this.meta = meta;
    }

    public static CompanyDocument of(Long companyId, String sourceUrl, String sourceType, String source,
                                     String content, String pageTitle, String language, String meta) {
        return new CompanyDocument(companyId, sourceUrl, sourceType, source, content, pageTitle, language, meta);
    }

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Long getCompanyId() {
        return companyId;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public String getSourceType() {
        return sourceType;
    }

    public String getSource() {
        return source;
    }

    public String getContent() {
        return content;
    }

    public String getPageTitle() {
        return pageTitle;
    }

    public String getLanguage() {
        return language;
    }

    public String getMeta() {
        return meta;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
