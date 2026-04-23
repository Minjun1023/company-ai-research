package com.companyresearch.domain.user.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String name;

    @Column
    private String password;

    @Column(nullable = false)
    private String role = "user";

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "career_level")
    private String careerLevel;

    @Column(name = "desired_job")
    private String desiredJob;

    @Column(name = "tech_stack", columnDefinition = "TEXT")
    private String techStack;

    @Column(name = "desired_industry")
    private String desiredIndustry;

    @Column(name = "resume_text", columnDefinition = "TEXT")
    private String resumeText;

    protected User() {}

    public User(String email, String name, String password) {
        this.email = email;
        this.name = name;
        this.password = password; // null for social login users
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

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getPassword() { return password; }
    public String getRole() { return role; }
    public boolean isActive() { return isActive; }
    public String getCareerLevel() { return careerLevel; }
    public String getDesiredJob() { return desiredJob; }
    public String getTechStack() { return techStack; }
    public String getDesiredIndustry() { return desiredIndustry; }
    public String getResumeText() { return resumeText; }

    public void updateName(String name) {
        if (name != null && !name.isBlank()) this.name = name.trim();
    }

    public void updatePassword(String encodedPassword) {
        this.password = encodedPassword;
    }

    public void updateProfile(String name, String careerLevel, String desiredJob,
                              String techStack, String desiredIndustry, String resumeText) {
        if (name != null && !name.isBlank()) this.name = name.trim();
        this.careerLevel = careerLevel;
        this.desiredJob = desiredJob;
        this.techStack = techStack;
        this.desiredIndustry = desiredIndustry;
        this.resumeText = resumeText;
    }
}
