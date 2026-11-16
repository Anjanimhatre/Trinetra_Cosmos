import httpx
from bs4 import BeautifulSoup

from nasa_rag import SOURCE_COLLECTIONS, _clean_text

with httpx.Client(headers={"User-Agent": "MoonMarsExplorer-SpaceRAG/1.0 (educational project)"}) as client:
    for coll in SOURCE_COLLECTIONS:
        for url in coll["urls"]:
            try:
                r = client.get(url, follow_redirects=True, timeout=25)
                soup = BeautifulSoup(r.text, "html.parser")
                for n in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
                    n.decompose()
                main = soup.find("main") or soup.find("article") or soup.body or soup
                text = _clean_text(main.get_text(" ", strip=True))
                verdict = "OK" if r.status_code == 200 and len(text) > 250 else "WILL BE SKIPPED"
                print(f"{coll['organisation']:5} {r.status_code} chars={len(text):6} {verdict}  {url}")
                if str(r.url) != url:
                    print(f"      redirected to {r.url}")
            except Exception as exc:
                print(f"{coll['organisation']:5} ERROR {url}: {exc}")