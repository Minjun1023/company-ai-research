package com.companyresearch;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CompanyResearchApplication {
    public static void main(String[] args) {
        SpringApplication.run(CompanyResearchApplication.class, args);
    }
}
