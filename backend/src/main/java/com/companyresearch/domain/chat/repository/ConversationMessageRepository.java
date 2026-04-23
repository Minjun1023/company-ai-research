package com.companyresearch.domain.chat.repository;

import com.companyresearch.domain.chat.entity.ConversationMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, Long> {
    List<ConversationMessage> findAllByConversationIdOrderByCreatedAtAsc(Long conversationId);
    List<ConversationMessage> findAllByConversationIdInOrderByCreatedAtAsc(List<Long> conversationIds);
    void deleteAllByConversationId(Long conversationId);
}
