package com.companyresearch.domain.question.repository;

import com.companyresearch.domain.question.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

// 질문 저장/조회 전용 리포지토리.
public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByCompanyIdOrderByCreatedAtDesc(Long companyId);
}

