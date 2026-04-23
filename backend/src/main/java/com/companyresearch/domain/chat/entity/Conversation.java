package com.companyresearch.domain.chat.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "conversations")
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(name = "session_type", length = 40, nullable = false)
    private String sessionType;

    @Column(name = "selected_company_id")
    private Long selectedCompanyId;

    @Column(name = "mode", length = 40)
    private String mode;

    @Column(name = "mode_state", columnDefinition = "TEXT")
    private String modeState;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    protected Conversation() {}

    public Conversation(Long userId, String title) {
        this(userId, title, ConversationSessionType.GENERAL.value());
    }

    public Conversation(Long userId, String title, String sessionType) {
        this.userId = userId;
        this.title = title;
        this.sessionType = ConversationSessionType.normalize(sessionType);
        this.mode = ConversationMode.IDLE.value();
    }

    @PrePersist
    protected void onCreate() {
        if (sessionType == null || sessionType.isBlank()) {
            sessionType = ConversationSessionType.GENERAL.value();
        }
        if (mode == null || mode.isBlank()) {
            mode = ConversationMode.IDLE.value();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getTitle() { return title; }
    public String getSessionType() { return ConversationSessionType.normalize(sessionType); }
    public Long getSelectedCompanyId() { return selectedCompanyId; }
    public String getMode() { return ConversationMode.normalize(mode); }
    public String getModeState() { return modeState; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void updateTitle(String title) { if (title != null && !title.isBlank()) this.title = title; }
    public void updateSessionType(String sessionType) { this.sessionType = ConversationSessionType.normalize(sessionType); }
    public void updateSelectedCompanyId(Long companyId) { this.selectedCompanyId = companyId; }
    public void updateMode(String mode) { this.mode = ConversationMode.normalize(mode); }
    public void updateModeState(String modeState) {
        this.modeState = (modeState == null || modeState.isBlank()) ? null : modeState;
    }
}
