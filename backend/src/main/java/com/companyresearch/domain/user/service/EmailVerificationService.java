package com.companyresearch.domain.user.service;

import com.companyresearch.common.util.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 이메일 인증 코드 발송 및 검증을 담당한다.
 *
 * 흐름:
 *  1. sendCode(email)         → 6자리 코드 생성 후 이메일 발송 (5분 유효)
 *  2. verifyCode(email, code) → 코드 일치 확인 후 서명된 JWT verifiedToken 반환 (30분 유효)
 *  3. consumeToken(token)     → JWT 서명/만료 검증 후 email 반환 (서버 상태 불필요)
 */
@Service
public class EmailVerificationService {

    private final JavaMailSender mailSender;
    private final JwtUtil jwtUtil;

    @Value("${email.from:no-reply@company-ai.local}")
    private String fromAddress;

    @Value("${email.verification.code-ttl-minutes:5}")
    private int codeTtlMinutes;

    // email → (code, expiry)
    private final Map<String, CodeEntry> codeStore = new ConcurrentHashMap<>();

    private static final SecureRandom RANDOM = new SecureRandom();

    public EmailVerificationService(JavaMailSender mailSender, JwtUtil jwtUtil) {
        this.mailSender = mailSender;
        this.jwtUtil = jwtUtil;
    }

    /** 6자리 인증 코드를 발송한다. 기존 코드가 있으면 덮어쓴다. */
    public void sendCode(String email) {
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        Instant expiry = Instant.now().plusSeconds(codeTtlMinutes * 60L);
        codeStore.put(email, new CodeEntry(code, expiry));

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(email);
        message.setSubject("[Company AI] 이메일 인증 코드");
        message.setText(
                "안녕하세요, Company AI입니다.\n\n" +
                "아래 인증 코드를 입력해 주세요. 코드는 " + codeTtlMinutes + "분간 유효합니다.\n\n" +
                "인증 코드: " + code + "\n\n" +
                "본인이 요청하지 않은 경우 이 메일을 무시하세요."
        );
        mailSender.send(message);
    }

    /**
     * 코드를 검증하고 성공 시 서명된 JWT verifiedToken을 반환한다.
     * JWT는 서버 재시작과 무관하게 유효하다.
     *
     * @return verifiedToken (서명된 JWT, 30분 유효)
     * @throws IllegalArgumentException 코드 불일치 또는 만료
     */
    public String verifyCode(String email, String code) {
        CodeEntry entry = codeStore.get(email);
        if (entry == null || Instant.now().isAfter(entry.expiry())) {
            throw new IllegalArgumentException("인증 코드가 만료되었습니다. 다시 발송해 주세요.");
        }
        if (!entry.code().equals(code)) {
            throw new IllegalArgumentException("인증 코드가 일치하지 않습니다.");
        }
        codeStore.remove(email);
        return jwtUtil.generateVerificationToken(email);
    }

    /**
     * JWT verifiedToken을 검증하고 email을 반환한다.
     * 서버 재시작 후에도 유효하며, 별도 상태 저장이 필요 없다.
     *
     * @throws IllegalArgumentException 토큰 만료 또는 위변조
     */
    public String consumeToken(String email, String token) {
        String tokenEmail = jwtUtil.consumeVerificationToken(token);
        if (!tokenEmail.equals(email)) {
            throw new IllegalArgumentException("이메일 인증 정보가 유효하지 않습니다.");
        }
        return tokenEmail;
    }

    private record CodeEntry(String code, Instant expiry) {}
}