package com.companyresearch.domain.chat.entity;

public enum ConversationMode {
    IDLE("idle"),
    QA("qa"),
    COMPARE("compare"),
    RESEARCH("research"),
    INTERVIEW_PREP("interview_prep"),
    INTERVIEW_PRACTICE("interview_practice"),
    COVERLETTER_CONSULT("coverletter_consult"),
    COVERLETTER_FEEDBACK("coverletter_feedback"),
    SALARY_CONSULT("salary_consult"),
    COMPANY_SELECTION("company_selection"),
    COMPANY_URL_INPUT("company_url_input"),
    GENERAL("general"),
    NEWS_AGENT("news_agent");

    private final String value;

    ConversationMode(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return IDLE.value;
        }
        for (ConversationMode mode : values()) {
            if (mode.value.equalsIgnoreCase(raw.trim())) {
                return mode.value;
            }
        }
        return IDLE.value;
    }
}
