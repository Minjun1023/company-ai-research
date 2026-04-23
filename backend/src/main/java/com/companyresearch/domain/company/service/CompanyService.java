package com.companyresearch.domain.company.service;

import com.companyresearch.domain.company.dto.CompanyResponse;
import com.companyresearch.domain.company.dto.CompanySearchResult;
import com.companyresearch.domain.company.dto.CreateCompanyRequest;
import com.companyresearch.domain.company.dto.UpdateCompanyRequest;
import com.companyresearch.domain.company.dto.CompanyCrawlResponse;
import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.company.entity.Company;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.document.service.CompanyDocumentService;
import com.companyresearch.domain.document.service.DocumentEmbeddingService;
import com.companyresearch.domain.user.entity.User;
import com.companyresearch.domain.user.repository.UserRepository;
import com.companyresearch.infra.client.ai.AiServiceClient;
import com.companyresearch.infra.client.ai.CrawlResult;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.companyresearch.infra.scheduler.CrawlTimestampService;

import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class CompanyService {

    private static final Logger log = LoggerFactory.getLogger(CompanyService.class);

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final AiServiceClient aiServiceClient;
    private final CompanyDocumentService companyDocumentService;
    private final DocumentEmbeddingService documentEmbeddingService;
    private final CrawlTimestampService crawlTimestampService;

    public CompanyService(CompanyRepository companyRepository,
            UserRepository userRepository,
            AiServiceClient aiServiceClient,
            CompanyDocumentService companyDocumentService,
            DocumentEmbeddingService documentEmbeddingService,
            CrawlTimestampService crawlTimestampService) {
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
        this.aiServiceClient = aiServiceClient;
        this.companyDocumentService = companyDocumentService;
        this.documentEmbeddingService = documentEmbeddingService;
        this.crawlTimestampService = crawlTimestampService;
    }

    private Long getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String email = (String) principal;
        return userRepository.findByEmail(email)
                .map(User::getId)
                .orElseThrow(() -> new IllegalStateException("인증된 사용자를 찾을 수 없습니다."));
    }

    // 회사 등록 처리
    @Transactional
    public CompanyResponse createCompany(CreateCompanyRequest request) {
        Long userId = getCurrentUserId();
        String name = request.getName() == null ? "" : request.getName().trim();
        String nameKey = normalizeCompanyNameKey(name);
        Company existing = companyRepository.findAllByUserId(userId).stream()
                .filter(c -> normalizeCompanyNameKey(c.getName()).equals(nameKey))
                .findFirst()
                .orElse(null);

        String website = normalizeEmptyToNull(request.getWebsite());
        if (website != null) {
            checkUrlReachable(website);
        }

        if (existing != null) {
            if ((existing.getWebsite() == null || existing.getWebsite().isBlank()) && website != null) {
                existing.updateWebsite(website);
            }
            return CompanyResponse.from(existing);
        }

        Company company = new Company(userId, name, website, request.getDescription());
        Company saved = companyRepository.save(company);
        return CompanyResponse.from(saved);
    }

    // 현재 사용자의 회사 목록 조회
    @Transactional(readOnly = true)
    public List<CompanyResponse> getAllCompanies() {
        Long userId = getCurrentUserId();
        return companyRepository.findAllByUserId(userId)
                .stream()
                .map(CompanyResponse::from)
                .toList();
    }

    // 단건 조회 (소유 확인 포함)
    @Transactional(readOnly = true)
    public CompanyResponse getCompany(Long id) {
        Long userId = getCurrentUserId();
        Company company = companyRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + id));
        return CompanyResponse.from(company);
    }

    // 크롤링 API (소유 확인 포함)
    @Transactional
    public CompanyCrawlResponse crawlCompany(Long companyId) {
        Long userId = getCurrentUserId();
        Company company = companyRepository.findByIdAndUserId(companyId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + companyId));

        String companyUrl = company.getWebsite();
        boolean userProvidedUrl = companyUrl != null && !companyUrl.isBlank();

        // URL이 없을 때만 Naver로 URL을 보완한다. 회사명은 덮어쓰지 않는다.
        // (이름 덮어쓰기 시 "사랑" → "포렌식데이터..." 같은 엉뚱한 업체로 교체되는 문제 방지)
        if (!userProvidedUrl) {
            String[] companyInfo = aiServiceClient.searchCompanyInfo(company.getName());
            if (companyInfo != null) {
                company.updateWebsite(companyInfo[1]);
                companyUrl = companyInfo[1];
            }
        }

        if (companyUrl == null || companyUrl.isBlank()) {
            throw new IllegalStateException(
                    "회사 URL을 찾을 수 없습니다. 직접 URL을 입력해 주세요. company=" + company.getName());
        }

        CrawlResult crawlResult = aiServiceClient.crawlCompany(companyUrl);
        int savedDocumentCount = companyDocumentService.replaceDocuments(companyId, crawlResult.getDocuments());
        int embeddedChunkCount = documentEmbeddingService.generateAndStoreEmbeddings(companyId);

        // DART corp_code + 업종 조회 및 저장
        // URL이 이미 있었으면(사용자 직접 입력) DART 법인명으로 회사명도 업데이트한다.
        // URL이 없어서 Naver로 보완한 경우는 엉뚱한 이름으로 교체될 수 있어 이름을 유지한다.
        // URL을 사용자가 직접 입력한 경우, 크롤된 페이지 title에서 회사명을 추출하여 보정한다.
        // 예: 사용자 입력 "삼성" + URL 삼성물산 → page title "삼성물산" → DART 확인 → 이름 업데이트
        if (userProvidedUrl) {
            String resolvedName = resolveCompanyNameFromCrawl(crawlResult, company.getName());
            if (resolvedName != null && !resolvedName.equals(company.getName())) {
                company.updateName(resolvedName);
            }
        }

        if (company.getDartCorpCode() == null || company.getDartCorpCode().isBlank()) {
            AiServiceClient.DartCorpInfo dartInfo = aiServiceClient.getDartCorpCode(company.getName());
            if (dartInfo != null) {
                company.updateDartCorpCode(dartInfo.corpCode());
                company.updateCompanyType(dartInfo.industry());
            }
        }

        company.updateLastCrawledAt();

        return CompanyCrawlResponse.from(companyId, crawlResult, savedDocumentCount, embeddedChunkCount);
    }

    // 스케줄러 전용: SecurityContext 없이 특정 Company 엔티티를 직접 크롤링한다.
    // - 문서/임베딩은 각 서비스의 자체 @Transactional로 처리 (외부 빈 호출 → 프록시 적용됨)
    // - DART 업데이트는 crawlTimestampService.updateDartInfo() 를 통해 별도 트랜잭션으로 저장
    // - lastCrawledAt은 크롤 성공/실패와 무관하게 REQUIRES_NEW 트랜잭션으로 반드시 커밋
    public void crawlCompanyInternal(Company company) {
        Long companyId = company.getId();
        try {
            Company loaded = companyRepository.findById(companyId).orElse(null);
            if (loaded == null) {
                log.warn("[자동수집] 회사를 찾을 수 없음 id={}", companyId);
                return;
            }

            String companyUrl = loaded.getWebsite();
            if (companyUrl == null || companyUrl.isBlank()) {
                log.warn("[자동수집] website 없음 company={} id={}", loaded.getName(), companyId);
                return;
            }

            try {
                CrawlResult crawlResult = aiServiceClient.crawlCompany(companyUrl);
                companyDocumentService.replaceDocuments(companyId, crawlResult.getDocuments());
                documentEmbeddingService.generateAndStoreEmbeddings(companyId);

                if (loaded.getDartCorpCode() == null || loaded.getDartCorpCode().isBlank()) {
                    AiServiceClient.DartCorpInfo dartInfo = aiServiceClient.getDartCorpCode(loaded.getName());
                    if (dartInfo != null) {
                        crawlTimestampService.updateDartInfo(companyId, dartInfo.corpCode(), dartInfo.industry());
                    }
                }
                log.info("[자동수집] 완료 company={} id={}", loaded.getName(), companyId);
            } catch (Exception e) {
                log.warn("[자동수집] 실패 company={} id={} error={}", loaded.getName(), companyId, e.getMessage());
            } finally {
                // 외부 빈 호출 → Spring 프록시 경유 → @Transactional(REQUIRES_NEW) 정상 적용
                crawlTimestampService.markCrawled(companyId);
            }
        } catch (Exception e) {
            log.error("[자동수집] 예상치 못한 오류 id={}", companyId, e);
        }
    }

    // 회사 검색: DB 이름 포함 검색 → DART 등록 법인 병행 검색
    // - DB 부분 일치 결과는 항상 포함 (등록됨 표시)
    // - DB에 없는 DART 법인은 신규 후보로 추가 (스타트업은 미등록일 수 있으므로 직접입력 옵션도 제공)
    @Transactional(readOnly = true)
    public List<CompanySearchResult> searchCompanies(String query) {
        if (query == null || query.isBlank()) return List.of();

        Long userId = getCurrentUserId();
        String trimmed = query.trim();
        List<Company> dbResults = companyRepository.findByNameContainingIgnoreCaseAndUserId(trimmed, userId);

        List<CompanySearchResult> results = new ArrayList<>(
                dbResults.stream()
                        .map(c -> CompanySearchResult.registered(c.getId(), c.getName(), c.getWebsite()))
                        .toList()
        );

        // DB에 등록된 이름 집합 (중복 방지용)
        java.util.Set<String> dbNames = dbResults.stream()
                .map(c -> c.getName().toLowerCase())
                .collect(java.util.stream.Collectors.toSet());

        // DART에서 법인 목록 조회 (최대 8개)
        List<String[]> dartResults = aiServiceClient.searchCompaniesByDart(trimmed);
        for (String[] item : dartResults) {
            String dartName = item[0];
            if (!dbNames.contains(dartName.toLowerCase())) {
                results.add(CompanySearchResult.external(dartName, null));
                dbNames.add(dartName.toLowerCase());
            }
        }

        return results;
    }

    /**
     * 동명 회사 disambiguation용: 네이버 업체 검색으로 후보 목록을 반환한다.
     */
    @Transactional(readOnly = true)
    public List<CompanySearchResult> getCompanyCandidates(String name) {
        if (name == null || name.isBlank()) return List.of();

        List<Map<String, String>> naverCandidates = aiServiceClient.searchCompanyCandidates(name);
        return naverCandidates.stream()
                .map(c -> CompanySearchResult.external(
                        c.get("name"), c.get("url"), c.get("description")))
                .toList();
    }

    // 사용자 질문과 유사도 top-k 검색을 수행해 문서 chunk 기반 결과를 제공한다.
    @Transactional
    public List<DocumentSearchResponseItem> searchDocuments(Long companyId, String query, int topK) {
        return documentEmbeddingService.searchSimilarEmbeddings(
                companyId,
                new DocumentSearchRequest(query, topK));
    }

    // 회사 URL 수정 (소유 확인 포함)
    @Transactional
    public CompanyResponse updateCompany(Long id, UpdateCompanyRequest request) {
        Long userId = getCurrentUserId();
        Company company = companyRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Company not found id=" + id));
        String website = normalizeEmptyToNull(request.getWebsite());
        if (website != null) {
            checkUrlReachable(website);
        }
        company.updateWebsite(website);
        return CompanyResponse.from(company);
    }

    @Transactional
    public void deleteCompany(Long id) {
        Long userId = getCurrentUserId();
        if (!companyRepository.existsByIdAndUserId(id, userId)) {
            throw new EntityNotFoundException("Company not found id=" + id);
        }
        companyRepository.deleteById(id);
    }

    public String findCompanyUrl(String name) {
        String url = aiServiceClient.searchCompanyUrl(name);
        return (url != null && !url.isBlank()) ? url : null;
    }

    // 빈 문자열 입력을 null로 정규화해 DB unique 제약 및 조회 일관성 확보.
    private String normalizeEmptyToNull(String value) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        validateWebsiteUrl(trimmed);
        return trimmed;
    }

    // 회사명 중복 판별용 정규화 키: 공백 제거 + 소문자.
    private String normalizeCompanyNameKey(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    // http/https 스킴 여부를 등록 시점에 검증해 잘못된 URL이 DB에 저장되는 것을 방지한다.
    private void validateWebsiteUrl(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!scheme.equals("http") && !scheme.equals("https"))) {
                throw new IllegalArgumentException(
                        "유효하지 않은 URL입니다. http 또는 https로 시작해야 합니다: " + url);
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "유효하지 않은 URL 형식입니다: " + url, e);
        }
    }

    // URL에 실제 HTTP HEAD 요청을 보내 도달 가능한 사이트인지 확인한다.
    // 5초 내 응답이 없거나 4xx/5xx 이면 등록을 거부한다.
    // 단, 405(HEAD 미허용)는 사이트가 존재하는 것이므로 허용한다.
    private void checkUrlReachable(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(5_000);
            conn.setReadTimeout(5_000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0");
            int code = conn.getResponseCode();
            log.info("[URL 검증] url={} status={}", url, code);
            if (code >= 400 && code != 403 && code != 405) {
                throw new IllegalArgumentException(
                        "접근할 수 없는 URL입니다 (HTTP " + code + "). 올바른 회사 홈페이지 URL을 입력해 주세요.");
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[URL 검증 실패] url={} error={}", url, e.getMessage());
            throw new IllegalArgumentException(
                    "URL에 접근할 수 없습니다. 올바른 회사 홈페이지 URL인지 확인해 주세요.");
        }
    }

    // 페이지 제목에서 제거할 접미사 (회사명이 아닌 페이지 유형 표기)
    private static final java.util.regex.Pattern PAGE_SUFFIX = java.util.regex.Pattern.compile(
            "(소개|회사소개|기업소개|홈페이지|공식사이트|채용|인재채용|IR|투자정보|뉴스룸|홈)$"
    );
    private static final String[] PAGE_SECTION_KEYWORDS = {
            "문화", "연혁", "그룹", "기술", "복지", "채용", "뉴스", "뉴스룸", "소개", "회사", "기업",
            "서비스", "ai", "aihub", "careers", "career", "recruit", "jobs", "job",
            "culture", "history", "group", "tech", "benefit", "benefits",
            "news", "newsroom", "about", "overview", "service", "services"
    };

    /**
     * 크롤링된 페이지 title에서 회사명을 추출한다.
     * 1) 메인 페이지(sourceUrl) 문서의 title을 우선 사용
     * 2) 없으면 첫 번째 문서의 title 사용
     * 3) 구분자( | - : ) 기준 첫 번째 세그먼트에서 페이지 유형 접미사 제거
     * 예: title "삼성물산소개" → "삼성물산", title "삼성물산 | Samsung C&T" → "삼성물산"
     */
    private String resolveCompanyNameFromCrawl(CrawlResult crawlResult, String originalName) {
        if (crawlResult == null || crawlResult.getDocuments() == null || crawlResult.getDocuments().isEmpty()) {
            return null;
        }

        // 메인 페이지 문서의 title 우선 사용
        String mainUrl = crawlResult.getSourceUrl();
        String pageTitle = null;
        if (mainUrl != null) {
            for (var doc : crawlResult.getDocuments()) {
                if (mainUrl.equals(doc.getSourceUrl())) {
                    pageTitle = doc.getPageTitle();
                    break;
                }
            }
        }
        if (pageTitle == null || pageTitle.isBlank()) {
            pageTitle = crawlResult.getDocuments().get(0).getPageTitle();
        }
        if (pageTitle == null || pageTitle.isBlank()) {
            return null;
        }

        String cleanOriginal = originalName.replaceAll("\\s+", "").toLowerCase(Locale.KOREAN);
        String[] segments = pageTitle.split("[|\\-:–—]");

        for (String segment : segments) {
            String candidate = sanitizePageTitleSegment(segment);
            if (candidate == null) {
                continue;
            }
            String cleanCandidate = candidate.replaceAll("\\s+", "").toLowerCase(Locale.KOREAN);
            if (cleanCandidate.equals(cleanOriginal)) {
                return candidate;
            }
        }

        for (String segment : segments) {
            String candidate = sanitizePageTitleSegment(segment);
            if (candidate == null) {
                continue;
            }
            if (isResolvedCompanyNameCandidate(candidate, cleanOriginal)) {
                return candidate;
            }
        }

        return null;
    }

    private String sanitizePageTitleSegment(String segment) {
        if (segment == null) {
            return null;
        }
        String candidate = PAGE_SUFFIX.matcher(segment.trim()).replaceFirst("").trim();
        if (candidate.length() < 2 || candidate.length() > 20) {
            return null;
        }
        return candidate;
    }

    private boolean isResolvedCompanyNameCandidate(String candidate, String cleanOriginal) {
        String cleanCandidate = candidate.replaceAll("\\s+", "").toLowerCase(Locale.KOREAN);
        if (!cleanCandidate.contains(cleanOriginal) || cleanCandidate.equals(cleanOriginal)) {
            return false;
        }

        String remainder = cleanCandidate.replace(cleanOriginal, "");
        for (String keyword : PAGE_SECTION_KEYWORDS) {
            if (remainder.contains(keyword)) {
                return false;
            }
        }

        if (remainder.isBlank()) {
            return false;
        }

        if (remainder.chars().allMatch(Character::isDigit)) {
            return false;
        }

        if (remainder.length() > cleanCandidate.length() / 2 + 4) {
            return false;
        }

        return true;
    }
}
