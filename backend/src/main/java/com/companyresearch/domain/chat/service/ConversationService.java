package com.companyresearch.domain.chat.service;

import com.companyresearch.domain.chat.entity.Conversation;
import com.companyresearch.domain.chat.entity.ConversationMessage;
import com.companyresearch.domain.chat.repository.ConversationMessageRepository;
import com.companyresearch.domain.chat.repository.ConversationRepository;
import com.companyresearch.domain.user.entity.User;
import com.companyresearch.domain.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final UserRepository userRepository;

    public ConversationService(ConversationRepository conversationRepository,
                               ConversationMessageRepository messageRepository,
                               UserRepository userRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    private Long getCurrentUserId() {
        String email = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return userRepository.findByEmail(email)
                .map(User::getId)
                .orElseThrow(() -> new IllegalStateException("인증된 사용자를 찾을 수 없습니다."));
    }

    /** 현재 사용자의 대화 목록 (메시지 포함) — 쿼리 2회 고정 (N+1 제거) */
    @Transactional(readOnly = true)
    public List<ConversationWithMessages> listConversations() {
        Long userId = getCurrentUserId();
        List<Conversation> conversations =
                conversationRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
        if (conversations.isEmpty()) return List.of();

        List<Long> ids = conversations.stream().map(Conversation::getId).toList();
        Map<Long, List<ConversationMessage>> messagesByConvId =
                messageRepository.findAllByConversationIdInOrderByCreatedAtAsc(ids)
                        .stream()
                        .collect(Collectors.groupingBy(ConversationMessage::getConversationId));

        return conversations.stream()
                .map(conv -> new ConversationWithMessages(
                        conv,
                        messagesByConvId.getOrDefault(conv.getId(), List.of())
                ))
                .toList();
    }

    /** 새 대화 생성 */
    @Transactional
    public Conversation createConversation(String title, String sessionType) {
        Long userId = getCurrentUserId();
        return conversationRepository.save(new Conversation(userId, title, sessionType));
    }

    /** 대화 제목/선택 회사 업데이트 */
    @Transactional
    public Conversation updateConversation(
            Long id,
            String title,
            String sessionType,
            Long selectedCompanyId,
            String mode,
            String modeState
    ) {
        Long userId = getCurrentUserId();
        Conversation conv = conversationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found id=" + id));
        if (title != null) conv.updateTitle(title);
        if (sessionType != null) conv.updateSessionType(sessionType);
        if (selectedCompanyId != null) conv.updateSelectedCompanyId(selectedCompanyId);
        if (mode != null) conv.updateMode(mode);
        if (modeState != null) conv.updateModeState(modeState);
        return conversationRepository.save(conv);
    }

    /** 대화 삭제 (메시지 포함) */
    @Transactional
    public void deleteConversation(Long id) {
        Long userId = getCurrentUserId();
        if (!conversationRepository.existsByIdAndUserId(id, userId)) {
            throw new EntityNotFoundException("Conversation not found id=" + id);
        }
        messageRepository.deleteAllByConversationId(id);
        conversationRepository.deleteById(id);
    }

    /** 메시지 추가 */
    @Transactional
    public ConversationMessage addMessage(Long conversationId, String role, String content, String meta) {
        Long userId = getCurrentUserId();
        Conversation conv = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Conversation not found id=" + conversationId));
        // 첫 user 메시지로 제목 업데이트
        if ("user".equals(role) && "새 대화".equals(conv.getTitle())) {
            conv.updateTitle(content.length() > 30 ? content.substring(0, 30) + "…" : content);
            conversationRepository.save(conv);
        } else {
            // updatedAt 갱신
            conversationRepository.save(conv);
        }
        return messageRepository.save(new ConversationMessage(conversationId, role, content, meta));
    }

    public record ConversationWithMessages(Conversation conversation, List<ConversationMessage> messages) {}
}
