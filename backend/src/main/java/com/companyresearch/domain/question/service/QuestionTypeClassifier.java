package com.companyresearch.domain.question.service;

// 간단한 키워드 기반 질문 분류기.
// RAG 파이프라인에서 질문 성격을 구분해 프롬프트 톤을 바꾸는 용도.
public final class QuestionTypeClassifier {

    private static final String[] WELFARE_KEYWORDS = {"복지", "복리후생", "복리", "근무환경", "워라밸", "워라벨", "휴식", "휴가", "육아휴직", "출산휴가", "시간제", "유연근무"};
    private static final String[] COMPANY_KEYWORDS = {"기업", "회사", "사업", "제품", "서비스", "조직", "문화", "채널", "공고", "채용", "위치", "연봉", "복지", "근무", "급여"};
    private static final String[] MIXED_KEYWORDS = {"비교", "차이", "둘", "또한", "한편", "요약", "정리", "종합"};

    private QuestionTypeClassifier() {
    }

    public static String classify(String questionText) {
        if (questionText == null) {
            return "company";
        }

        String normalized = questionText.toLowerCase();
        boolean welfareHit = containsAny(normalized, WELFARE_KEYWORDS);
        boolean companyHit = containsAny(normalized, COMPANY_KEYWORDS);
        boolean mixedHit = containsAny(normalized, MIXED_KEYWORDS);

        if (welfareHit) {
            return "welfare";
        }
        if (mixedHit) {
            return "mixed";
        }
        return companyHit ? "company" : "company";
    }

    private static boolean containsAny(String text, String[] keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }
}
