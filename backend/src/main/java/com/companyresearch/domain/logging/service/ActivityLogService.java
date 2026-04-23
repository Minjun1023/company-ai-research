package com.companyresearch.domain.logging.service;

import com.companyresearch.domain.company.dto.DocumentSearchResponseItem;
import com.companyresearch.domain.logging.entity.AiResponseLog;
import com.companyresearch.domain.logging.entity.SearchLog;
import com.companyresearch.domain.logging.repository.AiResponseLogRepository;
import com.companyresearch.domain.logging.repository.SearchLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// 11단계: 질문/검색/AI 응답 로그를 공통 처리.
@Service
public class ActivityLogService {

    public static final String REQUEST_TYPE_DOCUMENT_SEARCH = "DOCUMENT_SEARCH";
    public static final String REQUEST_TYPE_QUESTION_ASK = "QUESTION_ASK";

    private final SearchLogRepository searchLogRepository;
    private final AiResponseLogRepository aiResponseLogRepository;

    public ActivityLogService(SearchLogRepository searchLogRepository,
                              AiResponseLogRepository aiResponseLogRepository) {
        this.searchLogRepository = searchLogRepository;
        this.aiResponseLogRepository = aiResponseLogRepository;
    }

    // 검색 항목(문서/리뷰)마다 로그를 남긴다.
    @Transactional
    public void logSearchResults(Long companyId, Long questionId, String requestType, String query, String sourceType, List<DocumentSearchResponseItem> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        for (int i = 0; i < items.size(); i++) {
            DocumentSearchResponseItem item = items.get(i);
            searchLogRepository.save(SearchLog.of(
                    companyId,
                    questionId,
                    requestType,
                    query,
                    sourceType,
                    item.getDocumentId(),
                    item.getScore(),
                    i + 1
            ));
        }
    }

    // AI 응답을 저장한다.
    public void logAiResponse(Long companyId,
                              Long questionId,
                              String requestType,
                              String requestText,
                              String prompt,
                              String answerText,
                              long latencyMs) {
        aiResponseLogRepository.save(AiResponseLog.of(
                companyId,
                questionId,
                requestType,
                requestText,
                prompt,
                answerText,
                "fastapi",
                latencyMs,
                null
        ));
    }
}
