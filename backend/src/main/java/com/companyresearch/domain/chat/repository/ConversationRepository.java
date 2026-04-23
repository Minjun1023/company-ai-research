package com.companyresearch.domain.chat.repository;

import com.companyresearch.domain.chat.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findAllByUserIdOrderByUpdatedAtDesc(Long userId);
    Optional<Conversation> findByIdAndUserId(Long id, Long userId);
    boolean existsByIdAndUserId(Long id, Long userId);
    void deleteAllByUserId(Long userId);
}
