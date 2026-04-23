import re


# 크롤링 텍스트에서 반복 공백/제어문자/과도한 구분선을 줄여 저장 품질을 맞춘다.
def clean_text(text: str) -> str:
    cleaned = text.replace("\u00a0", " ")
    cleaned = re.sub(r"[\t\r\f\v]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ ]{2,}", " ", cleaned)
    cleaned = re.sub(r"-{4,}", "---", cleaned)
    return cleaned.strip()
