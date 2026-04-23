package com.companyresearch.domain.question.controller;

import com.companyresearch.domain.question.dto.AskQuestionRequest;
import com.companyresearch.domain.question.dto.AskQuestionResponse;
import com.companyresearch.domain.question.dto.CreateQuestionRequest;
import com.companyresearch.domain.question.dto.QuestionResponse;
import com.companyresearch.domain.question.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// 8단계 RAG API 진입점.
@RestController
@RequestMapping("/companies/{companyId}/questions")
public class QuestionController {

    private final QuestionService questionService;

    public QuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    // 질문 저장 API
    @PostMapping
    public ResponseEntity<QuestionResponse> createQuestion(
            @PathVariable Long companyId,
            @Valid @RequestBody CreateQuestionRequest request) {
        QuestionResponse response = questionService.createQuestion(companyId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 질문 목록 조회 API
    @GetMapping
    public ResponseEntity<List<QuestionResponse>> getQuestions(@PathVariable Long companyId) {
        return ResponseEntity.ok(questionService.getQuestions(companyId));
    }

    // RAG 질의 API
    @PostMapping("/ask")
    public ResponseEntity<AskQuestionResponse> askQuestion(
            @PathVariable Long companyId,
            @Valid @RequestBody AskQuestionRequest request
    ) {
        AskQuestionResponse response = questionService.answerQuestion(companyId, request);
        return ResponseEntity.ok(response);
    }
}

