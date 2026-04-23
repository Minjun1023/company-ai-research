package com.companyresearch.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

// 외부 서비스 호출을 위한 기본 WebClient 빈 설정.
// 현재는 AI Service 호출 전용으로 사용한다.
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient webClient() {
        return WebClient.builder()
                .codecs(configurer -> {
                    configurer.defaultCodecs().maxInMemorySize(10 * 1024 * 1024);
                })
                .build();
    }
}
