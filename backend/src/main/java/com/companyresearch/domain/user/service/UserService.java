package com.companyresearch.domain.user.service;

import com.companyresearch.common.exception.UnauthorizedException;
import com.companyresearch.common.util.JwtUtil;
import com.companyresearch.domain.chat.repository.ConversationRepository;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.user.dto.AuthResponse;
import com.companyresearch.domain.user.dto.LoginRequest;
import com.companyresearch.domain.user.dto.RegisterRequest;
import com.companyresearch.domain.user.entity.User;
import com.companyresearch.domain.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailVerificationService emailVerificationService;
    private final ConversationRepository conversationRepository;
    private final CompanyRepository companyRepository;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       EmailVerificationService emailVerificationService,
                       ConversationRepository conversationRepository,
                       CompanyRepository companyRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.emailVerificationService = emailVerificationService;
        this.conversationRepository = conversationRepository;
        this.companyRepository = companyRepository;
    }

    @Transactional
    public void deleteAccount(String email, String password, boolean isSocialLogin) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        if (!isSocialLogin && user.getPassword() != null) {
            if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
                throw new IllegalArgumentException("비밀번호가 올바르지 않습니다.");
            }
        }
        conversationRepository.deleteAllByUserId(user.getId());
        companyRepository.deleteAllByUserId(user.getId());
        userRepository.delete(user);
    }

    public AuthResponse register(RegisterRequest req) {
        // 이메일 인증 JWT 토큰 검증
        emailVerificationService.consumeToken(req.getEmail(), req.getVerifiedToken());

        if (userRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("이미 사용중인 이메일입니다.");
        }
        User user = new User(req.getEmail(), req.getName(),
                passwordEncoder.encode(req.getPassword()));
        user.updateProfile(req.getName(), req.getCareerLevel(), req.getDesiredJob(),
                req.getTechStack(), req.getDesiredIndustry(), req.getResumeText());
        userRepository.save(user);
        String token = jwtUtil.generateToken(user.getEmail());
        return toAuthResponse(token, user);
    }

    public AuthResponse updateProfile(String email, String name, String careerLevel,
                                      String desiredJob, String techStack,
                                      String desiredIndustry, String resumeText) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.updateProfile(name, careerLevel, desiredJob, techStack, desiredIndustry, resumeText);
        userRepository.save(user);
        String token = jwtUtil.generateToken(user.getEmail());
        return toAuthResponse(token, user);
    }

    @Transactional
    public void updateResumeText(String email, String resumeText) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.updateProfile(user.getName(), user.getCareerLevel(), user.getDesiredJob(),
                user.getTechStack(), user.getDesiredIndustry(), resumeText);
        userRepository.save(user);
    }

    private AuthResponse toAuthResponse(String token, User user) {
        return new AuthResponse(token, user.getEmail(), user.getName(),
                user.getCareerLevel(), user.getDesiredJob(),
                user.getTechStack(), user.getDesiredIndustry(), user.getResumeText(),
                false, user.getPassword() != null);
    }

    public boolean isSameAsCurrentPassword(String email, String verifiedToken, String password) {
        emailVerificationService.consumeToken(email, verifiedToken);
        return userRepository.findByEmail(email)
                .map(user -> user.getPassword() != null && passwordEncoder.matches(password, user.getPassword()))
                .orElse(false);
    }

    public boolean verifyPassword(String email, String password) {
        return userRepository.findByEmail(email)
                .map(user -> user.getPassword() != null && passwordEncoder.matches(password, user.getPassword()))
                .orElse(false);
    }

    @Transactional
    public void changePassword(String email, String currentPassword, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        if (user.getPassword() == null) {
            throw new IllegalArgumentException("소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.");
        }
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 올바르지 않습니다.");
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException("이전에 사용했던 비밀번호는 사용할 수 없습니다.");
        }
        user.updatePassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    @Transactional
    public void resetPassword(String email, String verifiedToken, String newPassword) {
        emailVerificationService.consumeToken(email, verifiedToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("등록되지 않은 이메일입니다."));
        if (user.getPassword() == null) {
            throw new IllegalArgumentException("소셜 로그인 계정은 비밀번호를 재설정할 수 없습니다.");
        }
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException("이전에 사용했던 비밀번호는 사용할 수 없습니다.");
        }
        user.updatePassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다."));
        if (user.getPassword() == null) {
            throw new UnauthorizedException("소셜 로그인으로 가입된 계정입니다. Google/카카오/네이버로 로그인해 주세요.");
        }
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        String token = jwtUtil.generateToken(user.getEmail());
        return toAuthResponse(token, user);
    }

    public AuthResponse getCurrentUser(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new UnauthorizedException("로그인이 필요합니다.");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("로그인이 필요합니다."));
        return toAuthResponse(null, user);
    }
}
