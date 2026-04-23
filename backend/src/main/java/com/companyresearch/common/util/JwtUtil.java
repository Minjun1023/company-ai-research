package com.companyresearch.common.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * 액세스 토큰과 이메일 인증 토큰을 생성/검증하는 JWT 유틸리티.
 *
 * 시간 계산과 서명 검증은 모두 millisecond epoch 기준으로 처리하므로
 * 만료 시간도 long 타입으로 보관한다.
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expiration;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration:86400000}") long expiration) {
        // JJWT는 문자열 secret 자체가 아니라 HMAC 서명용 Key 객체를 요구한다.
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expiration = expiration;
    }

    public String generateToken(String email) {
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(key)
                .compact();
    }

    /** 이메일 인증 완료 후 발급하는 단기 토큰 (30분 유효) */
    public String generateVerificationToken(String email) {
        return Jwts.builder()
                .subject(email)
                .claim("purpose", "email-verification")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 30 * 60 * 1000L))
                .signWith(key)
                .compact();
    }

    /** 이메일 인증 토큰 검증 후 email 반환. 유효하지 않으면 예외 발생 */
    public String consumeVerificationToken(String token) {
        try {
            Claims claims = parseClaims(token);
            if (!"email-verification".equals(claims.get("purpose"))) {
                throw new IllegalArgumentException("이메일 인증 정보가 유효하지 않습니다.");
            }
            return claims.getSubject();
        } catch (JwtException e) {
            throw new IllegalArgumentException("이메일 인증이 만료되었습니다. 다시 인증해 주세요.");
        }
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                // 동일한 서명 키로 검증까지 수행해야 payload를 신뢰할 수 있다.
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
