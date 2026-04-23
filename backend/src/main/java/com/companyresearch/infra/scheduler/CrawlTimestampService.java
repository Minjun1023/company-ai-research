package com.companyresearch.infra.scheduler;

import com.companyresearch.domain.company.repository.CompanyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * lastCrawledAt 갱신 전용 서비스.
 * REQUIRES_NEW 트랜잭션으로 크롤/임베딩 트랜잭션과 독립적으로 커밋된다.
 */
@Service
public class CrawlTimestampService {

    private static final Logger log = LoggerFactory.getLogger(CrawlTimestampService.class);

    private final CompanyRepository companyRepository;

    public CrawlTimestampService(CompanyRepository companyRepository) {
        this.companyRepository = companyRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markCrawled(Long companyId) {
        companyRepository.findById(companyId).ifPresent(c -> {
            c.updateLastCrawledAt();
            log.info("[자동수집] lastCrawledAt 갱신 company={} id={}", c.getName(), companyId);
        });
    }

    @Transactional
    public void updateDartInfo(Long companyId, String dartCorpCode, String industry) {
        companyRepository.findById(companyId).ifPresent(c -> {
            c.updateDartCorpCode(dartCorpCode);
            c.updateCompanyType(industry);
            log.info("[자동수집] DART 정보 갱신 company={} id={}", c.getName(), companyId);
        });
    }
}
