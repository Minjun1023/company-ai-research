package com.companyresearch.common.config;

import com.companyresearch.common.util.JwtUtil;
import com.companyresearch.domain.user.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * 요청마다 JWT를 읽어 Spring Security 인증 컨텍스트를 복원한다.
 *
 * 이 프로젝트는 세션을 쓰지 않기 때문에, 보호된 API에 접근할 때마다
 * 토큰을 다시 해석해 현재 사용자를 SecurityContext에 올려야 한다.
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public JwtFilter(JwtUtil jwtUtil, UserRepository userRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null && jwtUtil.validateToken(token)) {
            String email = jwtUtil.extractEmail(token);
            userRepository.findByEmail(email).ifPresent(user -> {
                // JWT에는 최소 식별 정보만 담고, 실제 권한 정보는 DB 기준으로 다시 조회한다.
                var auth = new UsernamePasswordAuthenticationToken(
                        user.getEmail(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase()))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(request, response);
    }

    /**
     * 헤더 기반 Bearer 토큰과 HttpOnly 쿠키를 모두 지원한다.
     * 프론트 전환 과정에서 두 방식이 섞여도 인증이 유지되도록 우선순위를 둔다.
     */
    private String resolveToken(HttpServletRequest request) {
        // 1순위: Authorization 헤더 (기존 방식 유지)
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        // 2순위: HttpOnly 쿠키
        if (request.getCookies() != null) {
            return Arrays.stream(request.getCookies())
                    .filter(c -> "access_token".equals(c.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }
}
