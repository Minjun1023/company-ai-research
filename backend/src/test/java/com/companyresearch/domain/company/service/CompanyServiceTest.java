package com.companyresearch.domain.company.service;

import com.companyresearch.domain.company.dto.CompanyCrawlResponse;
import com.companyresearch.domain.company.dto.CreateCompanyRequest;
import com.companyresearch.domain.company.dto.CompanyResponse;
import com.companyresearch.domain.company.entity.Company;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.document.service.CompanyDocumentService;
import com.companyresearch.domain.document.service.DocumentEmbeddingService;
import com.companyresearch.domain.user.entity.User;
import com.companyresearch.domain.user.repository.UserRepository;
import com.companyresearch.infra.client.ai.AiServiceClient;
import com.companyresearch.infra.client.ai.CrawlResult;
import com.companyresearch.infra.client.ai.CrawledDocument;
import com.companyresearch.infra.scheduler.CrawlTimestampService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompanyServiceTest {

    @Mock private CompanyRepository companyRepository;
    @Mock private UserRepository userRepository;
    @Mock private AiServiceClient aiServiceClient;
    @Mock private CompanyDocumentService companyDocumentService;
    @Mock private DocumentEmbeddingService documentEmbeddingService;
    @Mock private CrawlTimestampService crawlTimestampService;

    private CompanyService companyService;

    @BeforeEach
    void setUp() {
        companyService = new CompanyService(
                companyRepository,
                userRepository,
                aiServiceClient,
                companyDocumentService,
                documentEmbeddingService,
                crawlTimestampService
        );
        mockSecurityContext("user@test.com", 1L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void mockSecurityContext(String email, Long userId) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));

        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(email);
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    void createCompany_생성_요청을_저장한다() {
        Company saved = new Company(1L, "테스트회사", "https://example.com", "desc");
        setFieldValue(saved, "id", 1L);
        when(companyRepository.save(any(Company.class))).thenReturn(saved);

        CreateCompanyRequest request = new CreateCompanyRequest("테스트회사", null, "desc");
        CompanyResponse response = companyService.createCompany(request);

        assertEquals(1L, response.getId());
        assertEquals("테스트회사", response.getName());
        verify(companyRepository).save(any(Company.class));
    }

    @Test
    void crawlCompany_성공_시_문서교체_임베딩_실행_요청을_한다() {
        Company company = new Company(1L, "회사", "https://example.com", "desc");
        setFieldValue(company, "id", 10L);
        when(companyRepository.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(company));
        when(companyDocumentService.replaceDocuments(eq(10L), anyList())).thenReturn(1);
        when(documentEmbeddingService.generateAndStoreEmbeddings(10L)).thenReturn(3);
        when(aiServiceClient.getDartCorpCode(any())).thenReturn(null);

        CrawlResult crawlResult = new CrawlResult();
        crawlResult.setSourceUrl("https://example.com");
        crawlResult.setLinks(List.of("https://example.com/about"));
        crawlResult.setPageTypeMap(Map.of("about", List.of("https://example.com/about")));
        crawlResult.setExtractedText(Map.of("https://example.com/about", "content"));
        crawlResult.setDocuments(List.of(createCrawledDocument()));
        when(aiServiceClient.crawlCompany("https://example.com")).thenReturn(crawlResult);

        CompanyCrawlResponse response = companyService.crawlCompany(10L);

        assertEquals(10L, response.getCompanyId());
        assertEquals(1, response.getSavedDocumentCount());
        verify(companyRepository).findByIdAndUserId(10L, 1L);
        verify(companyDocumentService).replaceDocuments(eq(10L), anyList());
        verify(documentEmbeddingService).generateAndStoreEmbeddings(10L);
    }

    @Test
    void crawlCompany_섹션_페이지_제목으로_회사명을_잘못_보정하지_않는다() {
        Company company = new Company(1L, "카카오", "https://www.kakaocorp.com", "desc");
        setFieldValue(company, "id", 12L);
        when(companyRepository.findByIdAndUserId(12L, 1L)).thenReturn(Optional.of(company));
        when(companyDocumentService.replaceDocuments(eq(12L), anyList())).thenReturn(1);
        when(documentEmbeddingService.generateAndStoreEmbeddings(12L)).thenReturn(3);
        when(aiServiceClient.getDartCorpCode(any())).thenReturn(null);

        CrawlResult crawlResult = new CrawlResult();
        crawlResult.setSourceUrl("https://www.kakaocorp.com");
        crawlResult.setDocuments(List.of(
                createCrawledDocument("https://www.kakaocorp.com", "카카오 문화 | 카카오")
        ));
        when(aiServiceClient.crawlCompany("https://www.kakaocorp.com")).thenReturn(crawlResult);

        companyService.crawlCompany(12L);

        assertEquals("카카오", company.getName());
    }

    @Test
    void crawlCompany_메인_페이지_제목에서_정확한_회사명만_보정한다() {
        Company company = new Company(1L, "삼성", "https://www.samsungcnt.com", "desc");
        setFieldValue(company, "id", 13L);
        when(companyRepository.findByIdAndUserId(13L, 1L)).thenReturn(Optional.of(company));
        when(companyDocumentService.replaceDocuments(eq(13L), anyList())).thenReturn(1);
        when(documentEmbeddingService.generateAndStoreEmbeddings(13L)).thenReturn(3);
        when(aiServiceClient.getDartCorpCode(any())).thenReturn(null);

        CrawlResult crawlResult = new CrawlResult();
        crawlResult.setSourceUrl("https://www.samsungcnt.com");
        crawlResult.setDocuments(List.of(
                createCrawledDocument("https://www.samsungcnt.com", "삼성물산 | Samsung C&T")
        ));
        when(aiServiceClient.crawlCompany("https://www.samsungcnt.com")).thenReturn(crawlResult);

        companyService.crawlCompany(13L);

        assertEquals("삼성물산", company.getName());
    }

    @Test
    void crawlCompany_website_없으면_예외를_반환한다() {
        Company company = new Company(1L, "회사", null, "desc");
        setFieldValue(company, "id", 11L);
        when(companyRepository.findByIdAndUserId(11L, 1L)).thenReturn(Optional.of(company));
        when(aiServiceClient.searchCompanyInfo(any())).thenReturn(null);

        assertThrows(IllegalStateException.class, () -> companyService.crawlCompany(11L));
    }

    private CrawledDocument createCrawledDocument() {
        return createCrawledDocument("https://example.com/about", "About");
    }

    private CrawledDocument createCrawledDocument(String sourceUrl, String pageTitle) {
        CrawledDocument document = new CrawledDocument();
        document.setSourceUrl(sourceUrl);
        document.setPageTitle(pageTitle);
        document.setPageType("about");
        document.setRawText("raw");
        document.setCleanedText("clean");
        document.setChunks(List.of("chunk"));
        return document;
    }

    private void setFieldValue(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to set field: " + fieldName, e);
        }
    }
}
