package com.companyresearch.domain.company.controller;

import com.companyresearch.domain.company.dto.CompanyResponse;
import com.companyresearch.domain.company.dto.CompanySearchResult;
import com.companyresearch.domain.company.dto.CreateCompanyRequest;
import com.companyresearch.domain.company.dto.UpdateCompanyRequest;
import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.company.dto.CompanyCrawlResponse;
import com.companyresearch.domain.company.service.CompanyService;
import com.companyresearch.domain.company.service.CoverLetterService;
import com.companyresearch.domain.company.service.InterviewService;
import com.companyresearch.domain.company.service.ResearchService;
import com.companyresearch.domain.company.service.SalaryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/companies")
public class CompanyController {

    private final CompanyService companyService;
    private final ResearchService researchService;
    private final InterviewService interviewService;
    private final CoverLetterService coverLetterService;
    private final SalaryService salaryService;

    public CompanyController(CompanyService companyService, ResearchService researchService,
            InterviewService interviewService, CoverLetterService coverLetterService,
            SalaryService salaryService) {
        this.companyService = companyService;
        this.researchService = researchService;
        this.interviewService = interviewService;
        this.coverLetterService = coverLetterService;
        this.salaryService = salaryService;
    }

    // 회사 생성 API
    // 정상 생성 시 HTTP 201 반환.
    @PostMapping
    public ResponseEntity<CompanyResponse> createCompany(@Valid @RequestBody CreateCompanyRequest request) {
        CompanyResponse response = companyService.createCompany(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 회사 목록 조회 API
    @GetMapping
    public ResponseEntity<List<CompanyResponse>> getCompanies() {
        return ResponseEntity.ok(companyService.getAllCompanies());
    }

    // 회사 검색 API: DB 이름 포함 검색 → 없으면 Naver API로 외부 확인
    // registered=true: DB 등록 회사, registered=false: Naver로 확인된 미등록 회사
    @GetMapping("/search")
    public ResponseEntity<List<CompanySearchResult>> searchCompanies(
            @RequestParam(name = "q") String query) {
        return ResponseEntity.ok(companyService.searchCompanies(query));
    }

    @GetMapping("/candidates")
    public ResponseEntity<List<CompanySearchResult>> getCompanyCandidates(
            @RequestParam String name) {
        return ResponseEntity.ok(companyService.getCompanyCandidates(name));
    }

    @GetMapping("/find-url")
    public ResponseEntity<java.util.Map<String, String>> findCompanyUrl(
            @RequestParam String name) {
        String url = companyService.findCompanyUrl(name);
        return ResponseEntity.ok(java.util.Map.of("url", url != null ? url : ""));
    }

    // 회사 단건 조회 API
    // 존재하지 않으면 404.
    @GetMapping("/{id}")
    public ResponseEntity<CompanyResponse> getCompany(@PathVariable Long id) {
        return ResponseEntity.ok(companyService.getCompany(id));
    }

    // 회사 크롤링 API
    // company.website를 기준으로 AI service를 호출해 수집된 링크/텍스트를 반환한다.
    @PostMapping("/{companyId}/crawl")
    public ResponseEntity<CompanyCrawlResponse> crawlCompany(@PathVariable Long companyId) {
        return ResponseEntity.ok(companyService.crawlCompany(companyId));
    }

    // 회사 URL 수정 API
    @PatchMapping("/{id}")
    public ResponseEntity<CompanyResponse> updateCompany(
            @PathVariable Long id,
            @RequestBody UpdateCompanyRequest request) {
        return ResponseEntity.ok(companyService.updateCompany(id, request));
    }

    // 회사 삭제 API
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCompany(@PathVariable Long id) {
        companyService.deleteCompany(id);
        return ResponseEntity.noContent().build();
    }

    // 회사 단위 문서 벡터 검색 API
    @PostMapping("/{companyId}/documents/search")
    public ResponseEntity<List<DocumentSearchResponseItem>> searchCompanyDocumentEmbeddings(
            @PathVariable Long companyId,
            @Valid @RequestBody DocumentSearchRequest request
    ) {
        List<DocumentSearchResponseItem> result = companyService.searchDocuments(
                companyId,
                request.getQuery(),
                request.getTopK() == null ? 5 : request.getTopK()
        );
        return ResponseEntity.ok(result);
    }

    // 자기소개서 초안 생성 API
    @PostMapping("/{companyId}/coverletter")
    public ResponseEntity<Map<String, Object>> writeCoverLetter(
            @PathVariable Long companyId,
            @RequestBody(required = false) Map<String, String> body) {
        String jobRole = body != null ? body.getOrDefault("jobRole", "") : "";
        CoverLetterService.CoverLetterResponse result = coverLetterService.writeCoverLetter(companyId, jobRole);

        List<Map<String, Object>> externalContexts = result.externalContexts().stream()
                .map(ctx -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.getSourceUrl());
                    m.put("source_type", ctx.getSourceType());
                    return m;
                })
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("companyName", result.companyName());
        response.put("answer", result.answer());
        response.put("externalContexts", externalContexts);
        return ResponseEntity.ok(response);
    }

    // 회사 면접 준비 가이드 생성 API
    @PostMapping("/{companyId}/interview")
    public ResponseEntity<Map<String, Object>> interviewPrep(
            @PathVariable Long companyId,
            @RequestBody(required = false) Map<String, String> body) {
        String resumeText = body != null ? body.getOrDefault("resumeText", "") : "";
        InterviewService.InterviewResponse result = interviewService.prepareInterview(companyId, resumeText);

        List<Map<String, Object>> externalContexts = result.externalContexts().stream()
                .map(ctx -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.getSourceUrl());
                    m.put("source_type", ctx.getSourceType());
                    return m;
                })
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("companyName", result.companyName());
        response.put("answer", result.answer());
        response.put("externalContexts", externalContexts);
        return ResponseEntity.ok(response);
    }

    // 연봉 협상 가이드 생성 API
    @PostMapping("/{companyId}/salary")
    public ResponseEntity<Map<String, Object>> salaryGuide(
            @PathVariable Long companyId,
            @RequestBody(required = false) Map<String, String> body) {
        String jobRole = body != null ? body.getOrDefault("jobRole", "") : "";
        String careerYears = body != null ? body.getOrDefault("careerYears", "") : "";
        SalaryService.SalaryGuideResponse result = salaryService.getSalaryGuide(companyId, jobRole, careerYears);

        List<Map<String, Object>> externalContexts = result.externalContexts().stream()
                .map(ctx -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.getSourceUrl());
                    m.put("source_type", ctx.getSourceType());
                    return m;
                })
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("companyName", result.companyName());
        response.put("answer", result.answer());
        response.put("externalContexts", externalContexts);
        return ResponseEntity.ok(response);
    }

    // 회사 심층 리서치 리포트 생성 API
    @PostMapping("/{companyId}/research")
    public ResponseEntity<Map<String, Object>> researchCompany(@PathVariable Long companyId) {
        ResearchService.ResearchResponse result = researchService.research(companyId);

        List<Map<String, Object>> externalContexts = result.externalContexts().stream()
                .map(ctx -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("sourceUrl", ctx.getSourceUrl());
                    m.put("source_type", ctx.getSourceType());
                    return m;
                })
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("companyName", result.companyName());
        response.put("answer", result.answer());
        response.put("externalContexts", externalContexts);
        return ResponseEntity.ok(response);
    }
}
