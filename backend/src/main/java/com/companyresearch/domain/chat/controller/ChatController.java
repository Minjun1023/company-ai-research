package com.companyresearch.domain.chat.controller;

import com.companyresearch.domain.chat.service.ChatRespondService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

/**
 * 챗 진입점 컨트롤러.
 * 실제 대화 처리 자체는 /chat/respond 하나로 수렴한다.
 */
@RestController
@RequestMapping("/chat")
public class ChatController {

    private final ChatRespondService chatRespondService;

    public ChatController(ChatRespondService chatRespondService) {
        this.chatRespondService = chatRespondService;
    }

    @PostMapping("/respond")
    public ResponseEntity<ChatRespondResponse> respond(@RequestBody ChatRespondRequest request) {
        ChatRespondService.ChatRespondResult result = chatRespondService.respond(
                request.conversationId(),
                request.message(),
                request.persistUserMessage()
        );
        return ResponseEntity.ok(ChatRespondResponse.from(result));
    }

    record ChatRespondRequest(Long conversationId, String message, boolean persistUserMessage) {}

    record ChatRespondResponse(
            Long conversationId,
            String title,
            String sessionType,
            Long selectedCompanyId,
            String mode,
            String modeState,
            ConversationMessageSummary userMessage,
            ConversationMessageSummary assistantMessage,
            ConversationArtifactSummary artifact
    ) {
        static ChatRespondResponse from(ChatRespondService.ChatRespondResult result) {
            return new ChatRespondResponse(
                    result.conversation().getId(),
                    result.conversation().getTitle(),
                    result.conversation().getSessionType(),
                    result.conversation().getSelectedCompanyId(),
                    result.conversation().getMode(),
                    result.conversation().getModeState(),
                    ConversationMessageSummary.from(result.userMessage()),
                    ConversationMessageSummary.from(result.assistantMessage()),
                    ConversationArtifactSummary.from(result.artifact())
            );
        }
    }

    record ConversationMessageSummary(Long id, String role, String content, String meta) {
        static ConversationMessageSummary from(com.companyresearch.domain.chat.entity.ConversationMessage message) {
            if (message == null) {
                return null;
            }
            return new ConversationMessageSummary(
                    message.getId(),
                    message.getRole(),
                    message.getContent(),
                    message.getMeta()
            );
        }
    }

    record ConversationArtifactSummary(
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
        static ConversationArtifactSummary from(com.companyresearch.domain.chat.entity.ConversationArtifact artifact) {
            if (artifact == null) {
                return null;
            }
            return new ConversationArtifactSummary(
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
}
