from bs4 import BeautifulSoup


# HTML에서 본문 텍스트를 뽑기 전, 노이즈가 큰 태그를 제거한다.
def _strip_noise_tags(soup: BeautifulSoup) -> None:
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
        tag.decompose()


# HTML에서 원문 성격의 텍스트를 추출한다.
def extract_raw_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    _strip_noise_tags(soup)
    return soup.get_text(" ", strip=True)


# HTML 본문에서 노이즈를 제거하고 후처리에 적합한 텍스트로 정규화한다.
def extract_text_content(html: str) -> str:
    text = extract_raw_text(html)
    text = " ".join(text.split())
    return text
