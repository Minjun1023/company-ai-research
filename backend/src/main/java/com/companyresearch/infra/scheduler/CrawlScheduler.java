package com.companyresearch.infra.scheduler;

import com.companyresearch.domain.company.entity.Company;
import com.companyresearch.domain.company.repository.CompanyRepository;
import com.companyresearch.domain.company.service.CompanyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import jakarta.annotation.PostConstruct;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

// 오래된 회사 정보를 자동으로 재수집하는 스케줄러.
// 기본 주기: 매일 새벽 3시 실행, stale-days 이상 미수집 회사를 대상으로 한다.
// 서버 시작 시에도 즉시 한 번 체크한다.
@Component
public class CrawlScheduler {

    private static final Logger log = LoggerFactory.getLogger(CrawlScheduler.class);

    private final CompanyRepository companyRepository;
    private final CompanyService companyService;

    @Value("${crawl.auto.stale-days:7}")
    private int staleDays;

    public CrawlScheduler(CompanyRepository companyRepository, CompanyService companyService) {
        this.companyRepository = companyRepository;
        this.companyService = companyService;
    }

    // 서버 시작 시 오래된 회사를 즉시 체크 (비동기로 실행하여 기동 지연 방지)
    @PostConstruct
    public void onStartup() {
        new Thread(() -> {
            try {
                // 서버 초기화 완료 대기
                Thread.sleep(10_000);
                log.info("[자동수집] 서버 시작 — 오래된 회사 체크 시작");
                autoRefreshStaleCompanies();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                log.error("[자동수집] 서버 시작 체크 실패", e);
            }
        }, "crawl-startup").start();
    }

    @Scheduled(cron = "${crawl.auto.cron:0 0 3 * * *}")
    public void autoRefreshStaleCompanies() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(staleDays);
        List<Company> staleList = companyRepository.findStaleCompanies(threshold);

        if (staleList.isEmpty()) {
            log.info("[자동수집] 갱신 대상 없음 (기준: {}일 이상 미수집)", staleDays);
            return;
        }

        log.info("[자동수집] 시작 — 대상 {}개 (기준: {}일 이상 미수집)", staleList.size(), staleDays);

        for (Company company : staleList) {
            companyService.crawlCompanyInternal(company);
        }

        log.info("[자동수집] 완료 — {}개 처리", staleList.size());
    }

}
