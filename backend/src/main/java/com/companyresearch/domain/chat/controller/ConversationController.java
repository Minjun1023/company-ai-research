package com.companyresearch.domain.chat.controller;

import com.companyresearch.domain.chat.entity.Conversation;
import com.companyresearch.domain.chat.entity.ConversationArtifact;
import com.companyresearch.domain.chat.entity.ConversationMessage;
import com.companyresearch.domain.chat.service.ConversationArtifactService;
import com.companyresearch.domain.chat.service.ConversationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/conversations")
public class ConversationController {

    private final ConversationService conversationService;
    private final ConversationArtifactService conversationArtifactService;

    public ConversationController(
            ConversationService conversationService,
            ConversationArtifactService conversationArtifactService
    ) {
        this.conversationService = conversationService;
        this.conversationArtifactService = conversationArtifactService;
    }

    @GetMapping
    public ResponseEntity<List<ConversationResponse>> list() {
        List<ConversationResponse> result = conversationService.listConversations()
                .stream()
                .map(cwm -> ConversationResponse.from(cwm.conversation(), cwm.messages()))
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<ConversationResponse> create(@Valid @RequestBody CreateConversationRequest req) {
        Conversation conv = conversationService.createConversation(req.title(), req.sessionType());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ConversationResponse.from(conv, List.of()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ConversationResponse> update(
            @PathVariable Long id,
            @RequestBody UpdateConversationRequest req) {
        Conversation conv = conversationService.updateConversation(
                id,
                req.title(),
                req.sessionType(),
                req.selectedCompanyId(),
                req.mode(),
                req.modeState()
        );
        return ResponseEntity.ok(ConversationResponse.from(conv, List.of()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        conversationService.deleteConversation(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<MessageResponse> addMessage(
            @PathVariable Long id,
            @Valid @RequestBody AddMessageRequest req) {
        ConversationMessage msg = conversationService.addMessage(id, req.role(), req.content(), req.meta());
        return ResponseEntity.status(HttpStatus.CREATED).body(MessageResponse.from(msg));
    }

    @GetMapping("/{id}/artifacts")
    public ResponseEntity<List<ArtifactResponse>> listArtifacts(@PathVariable Long id) {
        List<ArtifactResponse> result = conversationArtifactService.listArtifacts(id)
                .stream()
                .map(ArtifactResponse::from)
                .toList();
        return ResponseEntity.ok(result);
    }

    // ── DTOs ────────────────────────────────────────────────
    record CreateConversationRequest(@NotBlank String title, String sessionType) {}
    record UpdateConversationRequest(String title, String sessionType, Long selectedCompanyId, String mode, String modeState) {}
    record AddMessageRequest(@NotBlank String role, @NotBlank String content, String meta) {}

    record MessageResponse(Long id, String role, String content, String meta, LocalDateTime createdAt) {
        static MessageResponse from(ConversationMessage m) {
            return new MessageResponse(m.getId(), m.getRole(), m.getContent(), m.getMeta(), m.getCreatedAt());
        }
    }

    record ArtifactResponse(
            Long id,
            Long conversationId,
            Long sourceMessageId,
            String artifactType,
            String title,
            String content,
            String meta,
            Integer version,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        static ArtifactResponse from(ConversationArtifact artifact) {
            return new ArtifactResponse(
                    artifact.getId(),
                    artifact.getConversationId(),
                    artifact.getSourceMessageId(),
                    artifact.getArtifactType(),
                    artifact.getTitle(),
                    artifact.getContent(),
                    artifact.getMeta(),
                    artifact.getVersion(),
                    artifact.getCreatedAt(),
                    artifact.getUpdatedAt()
            );
        }
    }

    record ConversationResponse(
            Long id, String title, String sessionType, Long selectedCompanyId, String mode, String modeState,
            LocalDateTime createdAt, LocalDateTime updatedAt,
            List<MessageResponse> messages) {
        static ConversationResponse from(Conversation c, List<ConversationMessage> msgs) {
            return new ConversationResponse(
                    c.getId(), c.getTitle(), c.getSessionType(), c.getSelectedCompanyId(), c.getMode(), c.getModeState(),
                    c.getCreatedAt(), c.getUpdatedAt(),
                    msgs.stream().map(MessageResponse::from).toList());
        }
    }
}
