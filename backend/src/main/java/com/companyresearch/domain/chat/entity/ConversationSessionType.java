package com.companyresearch.domain.chat.entity;

public enum ConversationSessionType {
    GENERAL("general"),
    RESEARCH("research"),
    COMPARE("compare"),
    INTERVIEW("interview"),
    COVERLETTER("coverletter"),
    SALARY("salary");

    private final String value;

    ConversationSessionType(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return GENERAL.value;
        }
        for (ConversationSessionType type : values()) {
            if (type.value.equalsIgnoreCase(raw.trim())) {
                return type.value;
            }
        }
        return GENERAL.value;
    }
}
