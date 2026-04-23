package com.companyresearch.domain.chat.repository;

import com.companyresearch.domain.chat.entity.ConversationArtifact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationArtifactRepository extends JpaRepository<ConversationArtifact, Long> {
    List<ConversationArtifact> findAllByConversationIdOrderByUpdatedAtDesc(Long conversationId);
    Optional<ConversationArtifact> findBySourceMessageId(Long sourceMessageId);
    long countByConversationIdAndArtifactType(Long conversationId, String artifactType);
    void deleteAllByConversationId(Long conversationId);
}
