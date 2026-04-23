package com.companyresearch.domain.user.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class AuthResponse {

    private final String token;
    private final String email;
    private final String name;
    private final String careerLevel;
    private final String desiredJob;
    private final String techStack;
    private final String desiredIndustry;
    private final String resumeText;
    private final boolean isNewUser;
    private final boolean hasPassword;

    public AuthResponse(String token, String email, String name,
                        String careerLevel, String desiredJob,
                        String techStack, String desiredIndustry, String resumeText) {
        this(token, email, name, careerLevel, desiredJob, techStack, desiredIndustry, resumeText, false, false);
    }

    public AuthResponse(String token, String email, String name,
                        String careerLevel, String desiredJob,
                        String techStack, String desiredIndustry, String resumeText,
                        boolean isNewUser) {
        this(token, email, name, careerLevel, desiredJob, techStack, desiredIndustry, resumeText, isNewUser, false);
    }

    public AuthResponse(String token, String email, String name,
                        String careerLevel, String desiredJob,
                        String techStack, String desiredIndustry, String resumeText,
                        boolean isNewUser, boolean hasPassword) {
        this.token = token;
        this.email = email;
        this.name = name;
        this.careerLevel = careerLevel;
        this.desiredJob = desiredJob;
        this.techStack = techStack;
        this.desiredIndustry = desiredIndustry;
        this.resumeText = resumeText;
        this.isNewUser = isNewUser;
        this.hasPassword = hasPassword;
    }

    public String getToken() { return token; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getCareerLevel() { return careerLevel; }
    public String getDesiredJob() { return desiredJob; }
    public String getTechStack() { return techStack; }
    public String getDesiredIndustry() { return desiredIndustry; }
    public String getResumeText() { return resumeText; }
    @JsonProperty("isNewUser")
    public boolean isNewUser() { return isNewUser; }
    public boolean isHasPassword() { return hasPassword; }
}
