package com.companyresearch.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;
import java.util.Map;

// 공통 예외 응답 포맷 DTO.
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiErrorResponse {

    private final String errorCode;
    private final String message;
    private final LocalDateTime timestamp;
    private final Map<String, String> details;

    public ApiErrorResponse(String errorCode, String message, Map<String, String> details) {
        this.errorCode = errorCode;
        this.message = message;
        this.timestamp = LocalDateTime.now();
        this.details = details;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public String getMessage() {
        return message;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public Map<String, String> getDetails() {
        return details;
    }
}
