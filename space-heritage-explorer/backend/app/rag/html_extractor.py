"""HTML -> readable text (drops scripts, navigation, footers)."""
from bs4 import BeautifulSoup

_NOISE = ["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "svg"]


def extract_html_text(html: bytes | str) -> tuple[str, str | None]:
    soup = BeautifulSoup(html, "lxml")
    title = soup.title.get_text(strip=True) if soup.title else None
    for tag in soup(_NOISE):
        tag.decompose()
    root = soup.find("main") or soup.find("article") or soup.body or soup
    return root.get_text("\n"), title
