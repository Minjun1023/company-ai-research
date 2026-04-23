package com.companyresearch.domain.company.dto;

// 회사 URL 수정 요청 DTO.
public class UpdateCompanyRequest {
    private String website;

    public UpdateCompanyRequest() {}

    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }
}
