package com.companyresearch.domain.question.service;

import com.companyresearch.domain.company.entity.Company;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.company.dto.DocumentSearchRequest;
import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.document.service.DocumentEmbeddingService;
import com.companyresearch.domain.question.dto.AskQuestionRequest;
import com.companyresearch.domain.question.dto.CreateQuestionRequest;
import com.companyresearch.domain.question.dto.QuestionResponse;
import com.companyresearch.domain.question.repository.QuestionRepository;
import com.companyresearch.domain.logging.service.ActivityLogService;
import com.companyresearch.infra.client.ai.AiServiceClient;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.junit.jupiter.api.extension.ExtendWith;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// 8단계 RAG 서비스 동작을 최소 단위로 점검한다.
@ExtendWith(MockitoExtension.class)
class QuestionServiceTest {

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private CompanyRepository companyRepository;

    @Mock
    private DocumentEmbeddingService documentEmbeddingService;

    @Mock
    private AiServiceClient aiServiceClient;

    @Mock
    private ActivityLogService activityLogService;

    private QuestionService questionService;

    @BeforeEach
    void setUp() {
        questionService = new QuestionService(
                questionRepository,
                companyRepository,
                documentEmbeddingService,
                aiServiceClient,
                activityLogService
        );
    }

    @Test
    void classifyAndCreateQuestion_회사용_question_type을_저장한다() {
        Company company = createCompanyWithId(1L, "테스트회사");
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company));
        when(questionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        QuestionResponse response = questionService.createQuestion(1L, new CreateQuestionRequest("연봉과 리뷰를 알려주세요"));

        assertEquals("company", response.getUserQuestionType());
        assertEquals(1L, response.getCompanyId());
        verify(questionRepository).save(any());
    }

    @Test
    void askQuestion_문서검색결과로_답변을_생성해_저장한다() {
        Company company = createCompanyWithId(1L, "테스트회사");
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company));
        when(documentEmbeddingService.searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class)))
                .thenReturn(List.of(new DocumentSearchResponseItem(
                        10L,
                        0,
                        "https://example.com",
                        "about",
                        "메인",
                        "회사 소개 텍스트",
                        0.1
                )));
        when(aiServiceClient.generateAnswer(eq("회사 소개는 뭐야"), anyString(), anyList(), anyString(), any()))
                .thenReturn(new AiServiceClient.GenerateAnswerResult("회사 소개 내용에 기반한 답변입니다.", List.of()));
        when(questionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        questionService.answerQuestion(1L, new AskQuestionRequest("회사 소개는 뭐야", 3));

        verify(documentEmbeddingService).searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class));
        verify(aiServiceClient).generateAnswer(eq("회사 소개는 뭐야"), anyString(), anyList(), anyString(), any());
        verify(questionRepository).save(any());
    }

    @Test
    void askQuestion_복지_질문은_복지_카테고리_문서만_우선_사용한다() {
        Company company = createCompanyWithId(1L, "테스트회사");
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company));
        when(documentEmbeddingService.searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class)))
                .thenReturn(List.of(
                        new DocumentSearchResponseItem(
                                10L,
                                0,
                                "https://example.com/about",
                                "about",
                                "회사 소개",
                                "회사 소개 텍스트",
                                0.1
                        ),
                        new DocumentSearchResponseItem(
                                11L,
                                0,
                                "https://example.com/culture/welfare",
                                "culture",
                                "복지 정보",
                                "복지 제도 텍스트",
                                0.12
                        ),
                        new DocumentSearchResponseItem(
                                12L,
                                0,
                                "https://example.com/jobs",
                                "careers",
                                "채용",
                                "채용 정보 텍스트",
                                0.2
                        )
                ));
        when(questionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ArgumentCaptor<List> contextCaptor = ArgumentCaptor.forClass(List.class);
        when(aiServiceClient.generateAnswer(eq("네이버 복지 어때"), anyString(), contextCaptor.capture(), eq("테스트회사"), any()))
                .thenReturn(new AiServiceClient.GenerateAnswerResult("복지 제도는 ...", List.of(
                        Map.of(
                                "sourceUrl", "https://example.com/culture/welfare",
                                "source_type", "document",
                                "content", "복지 제도 텍스트"
                        )
                )));

        questionService.answerQuestion(1L, new AskQuestionRequest("네이버 복지 어때", 3));

        verify(documentEmbeddingService).searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class));
        verify(aiServiceClient).generateAnswer(eq("네이버 복지 어때"), anyString(), anyList(), eq("테스트회사"), any());
        List<?> contexts = contextCaptor.getValue();
        assertEquals(1, contexts.size());
        Object first = contexts.get(0);
        assertEquals("RagContextItem", first.getClass().getSimpleName());
        assertEquals("culture", ((com.companyresearch.domain.question.dto.RagContextItem) first).getSourceType());
    }

    @Test
    void askQuestion_복지_질문은_본문의_복지_항목으로도_문서를_채택한다() {
        Company company = createCompanyWithId(1L, "테스트회사");
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company));
        when(documentEmbeddingService.searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class)))
                .thenReturn(List.of(
                        new DocumentSearchResponseItem(
                                10L,
                                0,
                                "https://recruit.navercorp.com/cnts/culture",
                                "culture",
                                "조직문화",
                                "Financial Wellbeing Time & Refresh Wellness Work-Life Balance",
                                0.15
                        ),
                        new DocumentSearchResponseItem(
                                11L,
                                0,
                                "https://example.com/about",
                                "about",
                                "회사 소개",
                                "회사 소개 텍스트",
                                0.1
                        )
                ));
        when(questionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ArgumentCaptor<List> contextCaptor = ArgumentCaptor.forClass(List.class);
        when(aiServiceClient.generateAnswer(eq("네이버 복지 어때"), anyString(), contextCaptor.capture(), eq("테스트회사"), any()))
                .thenReturn(new AiServiceClient.GenerateAnswerResult("복지 제도는 ...", List.of()));

        questionService.answerQuestion(1L, new AskQuestionRequest("네이버 복지 어때", 3));

        verify(aiServiceClient).generateAnswer(eq("네이버 복지 어때"), anyString(), anyList(), eq("테스트회사"), any());
        List<?> contexts = contextCaptor.getValue();
        assertEquals(1, contexts.size());
        assertEquals(
                "https://recruit.navercorp.com/cnts/culture",
                ((com.companyresearch.domain.question.dto.RagContextItem) contexts.get(0)).getSourceUrl()
        );
    }

    @Test
    void askQuestion_복지_질문에서_복지_관련_키워드가_없으면_컨텍스트를_비우고_응답한다() {
        Company company = createCompanyWithId(1L, "테스트회사");
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company));
        when(documentEmbeddingService.searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class)))
                .thenReturn(List.of(
                        new DocumentSearchResponseItem(
                                10L,
                                0,
                                "https://example.com/about",
                                "about",
                                "회사 소개",
                                "회사 소개 텍스트",
                                0.1
                        ),
                        new DocumentSearchResponseItem(
                                11L,
                                0,
                                "https://example.com/culture/teamwork",
                                "culture",
                                "조직문화",
                                "조직문화 소개 텍스트",
                                0.12
                        )
                ));
        when(questionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ArgumentCaptor<List> contextCaptor = ArgumentCaptor.forClass(List.class);
        when(aiServiceClient.generateAnswer(eq("연차는 언제 써요"), anyString(), anyList(), eq("테스트회사"), any()))
                .thenReturn(new AiServiceClient.GenerateAnswerResult("관련 문서가 부족해요.", List.of()));

        questionService.answerQuestion(1L, new AskQuestionRequest("연차는 언제 써요", 3));

        verify(documentEmbeddingService).searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class));
        verify(aiServiceClient).generateAnswer(eq("연차는 언제 써요"), anyString(), contextCaptor.capture(), eq("테스트회사"), any());
        List<?> contexts = contextCaptor.getValue();
        assertEquals(0, contexts.size());
    }

    @Test
    void askQuestion_복지_질문은_보조_검색으로_benefits_문서를_우선_찾는다() {
        Company company = createCompanyWithId(1L, "테스트회사");
        when(companyRepository.findById(1L)).thenReturn(Optional.of(company));
        when(questionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(documentEmbeddingService.searchSimilarEmbeddings(eq(1L), any(DocumentSearchRequest.class)))
                .thenAnswer(invocation -> {
                    DocumentSearchRequest req = invocation.getArgument(1);
                    if ("네이버 복지 어때".equals(req.getQuery())) {
                        return List.of(
                                new DocumentSearchResponseItem(
                                        10L,
                                        0,
                                        "https://recruit.navercorp.com/cnts/tech",
                                        "tech_blog",
                                        "NAVER Careers",
                                        "기술 조직 소개",
                                        0.2
                                )
                        );
                    }
                    if ("benefits".equals(req.getQuery())) {
                        return List.of(
                                new DocumentSearchResponseItem(
                                        11L,
                                        0,
                                        "https://recruit.navercorp.com/cnts/benefits",
                                        "culture",
                                        "NAVER Careers",
                                        "Financial Wellbeing Time & Refresh Wellness",
                                        0.1
                                )
                        );
                    }
                    return List.of();
                });

        ArgumentCaptor<List> contextCaptor = ArgumentCaptor.forClass(List.class);
        when(aiServiceClient.generateAnswer(eq("네이버 복지 어때"), anyString(), contextCaptor.capture(), eq("테스트회사"), any()))
                .thenReturn(new AiServiceClient.GenerateAnswerResult("복지 제도는 ...", List.of()));

        questionService.answerQuestion(1L, new AskQuestionRequest("네이버 복지 어때", 10));

        List<?> contexts = contextCaptor.getValue();
        assertEquals(1, contexts.size());
        assertEquals(
                "https://recruit.navercorp.com/cnts/benefits",
                ((com.companyresearch.domain.question.dto.RagContextItem) contexts.get(0)).getSourceUrl()
        );
    }

    @Test
    void askQuestion_회사가_없으면_예외_발생() {
        when(companyRepository.findById(1L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class,
                () -> questionService.answerQuestion(1L, new AskQuestionRequest("Q", 3))
        );
    }

    private Company createCompanyWithId(Long id, String name) {
        Company company = new Company(null, name, "https://example.com", "desc");
        try {
            var idField = Company.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(company, id);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to set company id", e);
        }
        return company;
    }
}
