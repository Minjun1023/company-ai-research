package com.companyresearch.domain.company.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateCompanyRequest {

    // 회사명은 필수 입력값.
    // 입력 검증을 위해 Bean Validation 어노테이션을 적용한다.
    @NotBlank
    @Size(max = 255)
    private String name;

    // 홈페이지 URL은 중복 허용을 막기 위해 DB unique 제약과 정합성 검증이 필요.
    @Size(max = 1024)
    private String website;

    // 회사 설명은 선택값. 검색/요약 등에 사용.
    private String description;

    protected CreateCompanyRequest() {
    }

    // 기본 생성자: Jackson 바인딩용.
    // 필드 기반 바인딩 시 스프링이 무파라미터 생성자를 사용.
    public CreateCompanyRequest(String name, String website, String description) {
        this.name = name;
        this.website = website;
        this.description = description;
    }

    public String getName() {
        return name;
    }

    public String getWebsite() {
        return website;
    }

    public String getDescription() {
        return description;
    }
}
