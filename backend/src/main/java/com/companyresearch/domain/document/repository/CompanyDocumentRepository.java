package com.companyresearch.domain.document.repository;

import com.companyresearch.domain.document.entity.CompanyDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CompanyDocumentRepository extends JpaRepository<CompanyDocument, Long> {
    void deleteByCompanyId(Long companyId);
    List<CompanyDocument> findByCompanyId(Long companyId);
}
