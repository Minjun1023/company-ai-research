package com.companyresearch.domain.company.dto;

// 회사 검색 결과 DTO.
// registered=true  → DB에 등록된 회사 (id 존재)
// registered=false → Naver 검색으로만 확인된 외부 회사 (id null)
public class CompanySearchResult {

    private final Long id;
    private final String name;
    private final String website;
    private final boolean registered;
    private final String description;

    private CompanySearchResult(Long id, String name, String website, boolean registered, String description) {
        this.id = id;
        this.name = name;
        this.website = website;
        this.registered = registered;
        this.description = description;
    }

    public static CompanySearchResult registered(Long id, String name, String website) {
        return new CompanySearchResult(id, name, website, true, null);
    }

    public static CompanySearchResult external(String name, String website) {
        return external(name, website, null);
    }

    public static CompanySearchResult external(String name, String website, String description) {
        return new CompanySearchResult(null, name, website, false, description);
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getWebsite() { return website; }
    public boolean isRegistered() { return registered; }
    public String getDescription() { return description; }
}
