package com.companyresearch.domain.chat.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "conversation_artifacts")
public class ConversationArtifact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "source_message_id", nullable = false, unique = true)
    private Long sourceMessageId;

    @Column(name = "artifact_type", nullable = false, length = 40)
    private String artifactType;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(columnDefinition = "TEXT")
    private String meta;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected ConversationArtifact() {}

    public ConversationArtifact(
            Long conversationId,
            Long sourceMessageId,
            String artifactType,
            String title,
            String content,
            String meta,
            Integer version
    ) {
        this.conversationId = conversationId;
        this.sourceMessageId = sourceMessageId;
        this.artifactType = artifactType;
        this.title = title;
        this.content = content;
        this.meta = meta;
        this.version = version;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public Long getSourceMessageId() {
        return sourceMessageId;
    }

    public String getArtifactType() {
        return artifactType;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public String getMeta() {
        return meta;
    }

    public Integer getVersion() {
        return version;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
