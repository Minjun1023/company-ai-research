package com.companyresearch.domain.chat.service;

import com.companyresearch.domain.chat.entity.Conversation;
import com.companyresearch.domain.chat.entity.ConversationArtifact;
import com.companyresearch.domain.chat.entity.ConversationMessage;
import com.companyresearch.domain.chat.repository.ConversationArtifactRepository;
import com.companyresearch.domain.chat.repository.ConversationRepository;
import com.companyresearch.domain.user.entity.User;
import com.companyresearch.domain.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
public class ConversationArtifactService {

    private static final Set<String> SAVABLE_TYPES = Set.of(
            "research",
            "compare",
            "interview",
            "coverletter",
            "feedback",
            "salary"
    );

    private final ConversationArtifactRepository artifactRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public ConversationArtifactService(
            ConversationArtifactRepository artifactRepository,
            ConversationRepository conversationRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper
    ) {
        this.artifactRepository = artifactRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<ConversationArtifact> listArtifacts(Long conversationId) {
        getConversation(conversationId, getCurrentUserId());
        return artifactRepository.findAllByConversationIdOrderByUpdatedAtDesc(conversationId);
    }

    @Transactional
    public ConversationArtifact saveFromAssistantMessage(Conversation conversation, ConversationMessage assistantMessage) {
        if (assistantMessage == null || !"assistant".equals(assistantMessage.getRole())) {
            return null;
        }
        ConversationArtifact existingArtifact = artifactRepository.findBySourceMessageId(assistantMessage.getId())
                .orElse(null);
        if (existingArtifact != null) {
            return existingArtifact;
        }

        ArtifactMeta meta = parseMeta(assistantMessage.getMeta());
        if (meta == null || !SAVABLE_TYPES.contains(meta.type())) {
            return null;
        }

        int version = (int) artifactRepository.countByConversationIdAndArtifactType(conversation.getId(), meta.type()) + 1;
        ConversationArtifact artifact = new ConversationArtifact(
                conversation.getId(),
                assistantMessage.getId(),
                meta.type(),
                meta.label(),
                assistantMessage.getContent(),
                assistantMessage.getMeta(),
                version
        );
        return artifactRepository.save(artifact);
    }

    private ArtifactMeta parseMeta(String meta) {
        if (meta == null || meta.isBlank()) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(meta);
            String type = root.path("type").asText("");
            String label = root.path("label").asText("");
            if (type.isBlank() || label.isBlank()) {
                return null;
            }
            return new ArtifactMeta(type, label);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long getCurrentUserId() {
        String email = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByEmail(email)
                .map(User::getId)
                .orElseThrow(() -> new IllegalStateException("인증된 사용자를 찾을 수 없습니다."));
    }

    private Conversation getConversation(Long id, Long userId) {
        return conversationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found id=" + id));
    }

    private record ArtifactMeta(String type, String label) {}
}
