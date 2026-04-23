package com.companyresearch.domain.chat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "conversation_messages")
public class ConversationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(nullable = false)
    private String role; // user | assistant | system

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(columnDefinition = "TEXT")
    private String meta;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    protected ConversationMessage() {}

    public ConversationMessage(Long conversationId, String role, String content, String meta) {
        this.conversationId = conversationId;
        this.role = role;
        this.content = content;
        this.meta = meta;
    }

    @PrePersist
    protected void onCreate() { createdAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public Long getConversationId() { return conversationId; }
    public String getRole() { return role; }
    public String getContent() { return content; }
    public String getMeta() { return meta; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
