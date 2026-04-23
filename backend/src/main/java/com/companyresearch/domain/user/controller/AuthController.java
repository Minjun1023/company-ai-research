package com.companyresearch.domain.user.controller;

import com.companyresearch.domain.user.dto.AuthResponse;
import com.companyresearch.domain.user.dto.LoginRequest;
import com.companyresearch.domain.user.dto.RegisterRequest;
import com.companyresearch.domain.user.repository.UserRepository;
import com.companyresearch.domain.user.service.EmailVerificationService;
import com.companyresearch.domain.user.service.SocialAuthService;
import com.companyresearch.domain.user.service.UserService;
import com.companyresearch.infra.client.ai.AiServiceClient;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserService userService;
    private final SocialAuthService socialAuthService;
    private final EmailVerificationService emailVerificationService;
    private final AiServiceClient aiServiceClient;
    private final UserRepository userRepository;

    @Value("${jwt.expiration:86400000}")
    private long jwtExpiration;

    public AuthController(UserService userService,
                          SocialAuthService socialAuthService,
                          EmailVerificationService emailVerificationService,
                          AiServiceClient aiServiceClient,
                          UserRepository userRepository) {
        this.userService = userService;
        this.socialAuthService = socialAuthService;
        this.emailVerificationService = emailVerificationService;
        this.aiServiceClient = aiServiceClient;
        this.userRepository = userRepository;
    }

    private void setAuthCookie(HttpServletRequest request, HttpServletResponse response, String token, boolean rememberMe) {
        ResponseCookie.ResponseCookieBuilder cookieBuilder = ResponseCookie.from("access_token", token)
                .httpOnly(true)
                .secure(request.isSecure())
                .path("/")
                .sameSite("Lax");
        if (rememberMe) {
            cookieBuilder.maxAge(jwtExpiration / 1000);
        }
        ResponseCookie cookie = cookieBuilder.build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private boolean parseRememberMe(String value) {
        return value != null && Boolean.parseBoolean(value);
    }

    private void clearAuthCookie(HttpServletRequest request, HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("access_token", "")
                .httpOnly(true)
                .secure(request.isSecure())
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    /** 이메일 중복 확인 */
    @GetMapping("/email/check")
    public ResponseEntity<Map<String, Boolean>> checkEmail(@RequestParam String email) {
        boolean available = !userRepository.existsByEmail(email);
        return ResponseEntity.ok(Map.of("available", available));
    }

    /** 이메일 인증 코드 발송 */
    @PostMapping("/email/send-code")
    public ResponseEntity<Map<String, String>> sendVerificationCode(
            @Valid @RequestBody SendCodeRequest req) {
        emailVerificationService.sendCode(req.email());
        return ResponseEntity.ok(Map.of("message", "인증 코드가 발송되었습니다."));
    }

    /** 이메일 인증 코드 검증 → verifiedToken 반환 */
    @PostMapping("/email/verify")
    public ResponseEntity<Map<String, String>> verifyCode(
            @Valid @RequestBody VerifyCodeRequest req) {
        String token = emailVerificationService.verifyCode(req.email(), req.code());
        return ResponseEntity.ok(Map.of("verifiedToken", token));
    }

    /** 비밀번호 재설정 시 기존 비밀번호와 동일 여부 확인 */
    @PostMapping("/password/check-same")
    public ResponseEntity<Map<String, Boolean>> checkSamePassword(
            @RequestBody Map<String, String> body) {
        boolean same = userService.isSameAsCurrentPassword(
                body.getOrDefault("email", ""),
                body.getOrDefault("verifiedToken", ""),
                body.getOrDefault("password", ""));
        return ResponseEntity.ok(Map.of("same", same));
    }

    /** 현재 비밀번호 확인 */
    @PostMapping("/password/verify")
    public ResponseEntity<Map<String, Boolean>> verifyPassword(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, String> body) {
        boolean valid = userService.verifyPassword(email, body.getOrDefault("password", ""));
        return ResponseEntity.ok(Map.of("valid", valid));
    }

    /** 로그인 상태에서 현재 비밀번호 확인 후 변경 */
    @PutMapping("/password/change")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal String email,
            @Valid @RequestBody ChangePasswordRequest req) {
        userService.changePassword(email, req.currentPassword(), req.newPassword());
        return ResponseEntity.ok(Map.of("message", "비밀번호가 변경되었습니다."));
    }

    record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8) String newPassword) {}

    /** 회원 탈퇴 */
    @DeleteMapping("/account")
    public ResponseEntity<Void> deleteAccount(
            @AuthenticationPrincipal String email,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest request, HttpServletResponse response) {
        String password = body != null ? body.get("password") : null;
        String provider = body != null ? body.get("provider") : null;
        boolean isSocialLogin = provider != null && !provider.equals("email");
        userService.deleteAccount(email, password, isSocialLogin);
        clearAuthCookie(request, response);
        return ResponseEntity.noContent().build();
    }

    /** 비밀번호 재설정 */
    @PostMapping("/password/reset")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req) {
        userService.resetPassword(req.email(), req.verifiedToken(), req.newPassword());
        return ResponseEntity.ok(Map.of("message", "비밀번호가 재설정되었습니다."));
    }

    record ResetPasswordRequest(
            @Email @NotBlank String email,
            @NotBlank String verifiedToken,
            @NotBlank @Size(min = 8) String newPassword) {}

    record SendCodeRequest(@Email @NotBlank String email) {}
    record VerifyCodeRequest(@Email @NotBlank String email,
                             @NotBlank @Size(min = 6, max = 6) String code) {}

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest req,
            HttpServletRequest request, HttpServletResponse response) {
        AuthResponse res = userService.register(req);
        setAuthCookie(request, response, res.getToken(), true);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest request, HttpServletResponse response) {
        AuthResponse res = userService.login(req);
        setAuthCookie(request, response, res.getToken(), Boolean.TRUE.equals(req.getRememberMe()));
        return ResponseEntity.ok(res);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        clearAuthCookie(request, response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(userService.getCurrentUser(email));
    }

    @PostMapping(value = "/profile/resume-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadResume(
            @AuthenticationPrincipal String email,
            @RequestParam("file") MultipartFile file) {
        if (email == null) return ResponseEntity.status(401).build();
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "파일이 비어있습니다."));
        try {
            String resumeText = aiServiceClient.parseResume(
                    file.getBytes(), file.getOriginalFilename(), file.getContentType());
            userService.updateResumeText(email, resumeText);
            return ResponseEntity.ok(Map.of("resumeText", resumeText));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/profile")
    public ResponseEntity<AuthResponse> updateProfile(
            @AuthenticationPrincipal String email,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(userService.updateProfile(
                email,
                body.get("name"),
                body.get("careerLevel"),
                body.get("desiredJob"),
                body.get("techStack"),
                body.get("desiredIndustry"),
                body.get("resumeText")
        ));
    }

    @PostMapping("/social/google")
    public ResponseEntity<AuthResponse> googleLogin(
            @RequestBody Map<String, String> body,
            HttpServletRequest request, HttpServletResponse response) {
        AuthResponse res = socialAuthService.googleLogin(body.get("token"));
        setAuthCookie(request, response, res.getToken(), parseRememberMe(body.get("rememberMe")));
        return ResponseEntity.ok(res);
    }

    @PostMapping("/social/kakao")
    public ResponseEntity<AuthResponse> kakaoLogin(
            @RequestBody Map<String, String> body,
            HttpServletRequest request, HttpServletResponse response) {
        AuthResponse res = socialAuthService.kakaoLogin(body.get("code"), body.get("redirect_uri"));
        setAuthCookie(request, response, res.getToken(), parseRememberMe(body.get("rememberMe")));
        return ResponseEntity.ok(res);
    }

    @PostMapping("/social/naver")
    public ResponseEntity<AuthResponse> naverLogin(
            @RequestBody Map<String, String> body,
            HttpServletRequest request, HttpServletResponse response) {
        AuthResponse res = socialAuthService.naverLogin(body.get("code"), body.get("state"));
        setAuthCookie(request, response, res.getToken(), parseRememberMe(body.get("rememberMe")));
        return ResponseEntity.ok(res);
    }
}
