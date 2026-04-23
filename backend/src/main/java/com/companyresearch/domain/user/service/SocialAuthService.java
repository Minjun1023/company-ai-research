package com.companyresearch.domain.user.service;

import com.companyresearch.common.util.JwtUtil;
import com.companyresearch.domain.user.dto.AuthResponse;
import com.companyresearch.domain.user.entity.User;
import com.companyresearch.domain.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class SocialAuthService {

    private static final Logger log = LoggerFactory.getLogger(SocialAuthService.class);

    private final WebClient webClient;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final ObjectMapper objectMapper;

    @Value("${oauth.kakao.rest-api-key:}")
    private String kakaoRestApiKey;

    @Value("${KAKAO_CLIENT_SECRET:}")
    private String kakaoClientSecret;

    @Value("${oauth.naver.client-id:}")
    private String naverClientId;

    @Value("${oauth.naver.client-secret:}")
    private String naverClientSecret;

    public SocialAuthService(WebClient webClient,
                             UserRepository userRepository,
                             JwtUtil jwtUtil,
                             ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
        this.objectMapper = objectMapper;
    }

    // ── Google ────────────────────────────────────────────────
    public AuthResponse googleLogin(String accessToken) {
        try {
            String url = "https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken;
            String body = webClient.get()
                    .uri(url)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode node = objectMapper.readTree(body);
            String email = node.path("email").asText();
            String name = node.path("name").asText(email.split("@")[0]);

            if (email.isBlank()) throw new IllegalArgumentException("Google 이메일을 가져올 수 없습니다.");
            return upsertSocialUser(email, name);
        } catch (Exception e) {
            log.warn("Google login failed: {}", e.getMessage());
            throw new IllegalArgumentException("Google 로그인에 실패했습니다.");
        }
    }

    // ── Kakao ─────────────────────────────────────────────────
    public AuthResponse kakaoLogin(String code, String redirectUri) {
        try {
            log.info("Kakao login attempt - code={}, redirectUri={}, apiKey={}, hasSecret={}", code.substring(0, 6) + "...", redirectUri, kakaoRestApiKey.substring(0, 6) + "...", (kakaoClientSecret != null && !kakaoClientSecret.isBlank()));
            // 1. 코드로 액세스 토큰 교환
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", "authorization_code");
            form.add("client_id", kakaoRestApiKey);
            form.add("redirect_uri", redirectUri);
            form.add("code", code);
            if (kakaoClientSecret != null && !kakaoClientSecret.isBlank()) {
                form.add("client_secret", kakaoClientSecret);
            }

            String tokenBody = webClient.post()
                    .uri("https://kauth.kakao.com/oauth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(form))
                    .exchangeToMono(resp -> resp.bodyToMono(String.class))
                    .block();

            log.info("Kakao token response: {}", tokenBody);
            JsonNode tokenNode = objectMapper.readTree(tokenBody);
            if (tokenNode.has("error")) {
                throw new IllegalArgumentException("Kakao token error: " + tokenNode.path("error").asText() + " - " + tokenNode.path("error_description").asText());
            }
            String accessToken = tokenNode.path("access_token").asText();

            // 2. 사용자 정보 조회
            String userBody = webClient.get()
                    .uri("https://kapi.kakao.com/v2/user/me")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode userNode = objectMapper.readTree(userBody);
            JsonNode account = userNode.path("kakao_account");
            String email = account.path("email").asText();
            String name = account.path("profile").path("nickname").asText("카카오사용자");

            if (email.isBlank()) {
                // 이메일 동의 없을 경우 고유 ID 기반 이메일 생성
                String kakaoId = userNode.path("id").asText();
                email = "kakao_" + kakaoId + "@kakao.social";
            }
            return upsertSocialUser(email, name);
        } catch (Exception e) {
            log.warn("Kakao login failed: {}", e.getMessage());
            throw new IllegalArgumentException("카카오 로그인에 실패했습니다.");
        }
    }

    // ── Naver ─────────────────────────────────────────────────
    public AuthResponse naverLogin(String code, String state) {
        try {
            // 1. 코드로 액세스 토큰 교환
            String tokenUrl = String.format(
                    "https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=%s&client_secret=%s&code=%s&state=%s",
                    naverClientId, naverClientSecret, code, state);

            String tokenBody = webClient.get()
                    .uri(tokenUrl)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode tokenNode = objectMapper.readTree(tokenBody);
            String accessToken = tokenNode.path("access_token").asText();

            // 2. 사용자 정보 조회
            String userBody = webClient.get()
                    .uri("https://openapi.naver.com/v1/nid/me")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode userNode = objectMapper.readTree(userBody).path("response");
            String email = userNode.path("email").asText();
            String name = userNode.path("name").asText("네이버사용자");

            if (email.isBlank()) throw new IllegalArgumentException("Naver 이메일을 가져올 수 없습니다.");
            return upsertSocialUser(email, name);
        } catch (Exception e) {
            log.warn("Naver login failed: {}", e.getMessage());
            throw new IllegalArgumentException("네이버 로그인에 실패했습니다.");
        }
    }

    // ── 공통: 소셜 사용자 upsert ─────────────────────────────
    private AuthResponse upsertSocialUser(String email, String name) {
        boolean[] created = {false};
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            created[0] = true;
            return userRepository.save(new User(email, name, null));
        });
        String token = jwtUtil.generateToken(user.getEmail());
        return new AuthResponse(token, user.getEmail(), user.getName(),
                user.getCareerLevel(), user.getDesiredJob(),
                user.getTechStack(), user.getDesiredIndustry(), user.getResumeText(),
                created[0], user.getPassword() != null);
    }
}
