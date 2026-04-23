package com.companyresearch.common.exception;

// 인증 실패/미인증 상태를 401로 명확히 표현하기 위한 공통 예외.
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
