"""Discover NASA historical documents from several official sources.

Every discoverer yields DiscoveredDocument objects:
  - ntrs     : NASA Technical Reports Server API (PDFs + metadata)
  - history  : NASA History Office / nasa.gov pages (HTML + PDF links, shallow crawl)
  - images   : NASA Image & Video Library API (rich text descriptions, no download needed)

Add a new source by writing a generator and registering it in DISCOVERERS.
"""
from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass
from datetime import date
from typing import Iterator, Optional
from urllib.parse import urljoin, urlparse, urlsplit
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

HEADERS = {"User-Agent": "SpaceHeritageExplorer/1.0 (educational RAG project)"}
NTRS_BASE = "https://ntrs.nasa.gov"
IMAGES_API = "https://images-api.nasa.gov/search"

DEFAULT_HISTORY_SEEDS = [
    "https://history.nasa.gov/",
    "https://www.nasa.gov/history/",
]


@dataclass
class DiscoveredDocument:
    title: str
    url: str
    source_name: str
    kind_hint: Optional[str] = None      # "pdf" | "html" | None (auto-detect)
    published_date: Optional[date] = None
    inline_text: Optional[str] = None    # if set, no download is needed


def _parse_date(value) -> Optional[date]:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


# --------------------------------------------------------------------- NTRS
def discover_ntrs(query: str, limit: int = 25, **_) -> Iterator[DiscoveredDocument]:
    found, offset = 0, 0
    page_size = min(100, max(limit, 1))
    with httpx.Client(timeout=30, headers=HEADERS) as client:
        while found < limit:
            r = client.get(
                f"{NTRS_BASE}/api/citations/search",
                params={"q": query, "page.size": page_size, "page.from": offset},
            )
            r.raise_for_status()
            results = r.json().get("results", [])
            if not results:
                break
            for item in results:
                pdf_link = None
                for d in item.get("downloads") or []:
                    pdf_link = (d.get("links") or {}).get("pdf")
                    if pdf_link:
                        break
                if not pdf_link:
                    continue  # metadata-only record
                pubs = item.get("publications") or [{}]
                when = (
                    _parse_date(pubs[0].get("publicationDate"))
                    or _parse_date(item.get("distributionDate"))
                    or _parse_date(item.get("created"))
                )
                yield DiscoveredDocument(
                    title=item.get("title") or f"NTRS {item.get('id')}",
                    url=urljoin(NTRS_BASE, pdf_link),
                    source_name="ntrs",
                    kind_hint="pdf",
                    published_date=when,
                )
                found += 1
                if found >= limit:
                    return
            offset += page_size


# ------------------------------------------------------------------ History
_robots_cache: dict[str, Optional[RobotFileParser]] = {}


def _allowed(client: httpx.Client, url: str) -> bool:
    parts = urlsplit(url)
    host = f"{parts.scheme}://{parts.netloc}"
    if host not in _robots_cache:
        rp = RobotFileParser()
        try:
            resp = client.get(f"{host}/robots.txt")
            rp.parse(resp.text.splitlines() if resp.status_code == 200 else [])
            _robots_cache[host] = rp
        except httpx.HTTPError:
            _robots_cache[host] = None
    rp = _robots_cache[host]
    return True if rp is None else rp.can_fetch(HEADERS["User-Agent"], url)


def discover_nasa_history(
    query: str = "",
    limit: int = 50,
    seeds: Optional[list[str]] = None,
    depth: int = 1,
    max_pages: int = 40,
    **_,
) -> Iterator[DiscoveredDocument]:
    """Shallow, polite crawl of nasa.gov pages. When `query` is given, only
    links whose text/URL contain one of its words are kept."""
    words = [w.lower() for w in query.split() if len(w) > 2]
    queue = deque((u, 0) for u in (seeds or DEFAULT_HISTORY_SEEDS))
    seen: set[str] = set()
    pages_fetched = found = 0

    with httpx.Client(timeout=30, headers=HEADERS, follow_redirects=True) as client:
        while queue and found < limit and pages_fetched < max_pages:
            page_url, level = queue.popleft()
            if page_url in seen or not _allowed(client, page_url):
                continue
            seen.add(page_url)
            try:
                resp = client.get(page_url)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.warning("crawl skip %s: %s", page_url, exc)
                continue
            pages_fetched += 1
            if "html" not in resp.headers.get("content-type", ""):
                continue

            soup = BeautifulSoup(resp.content, "lxml")
            for a in soup.find_all("a", href=True):
                href = urljoin(page_url, a["href"]).split("#")[0]
                parsed = urlparse(href)
                if parsed.scheme not in ("http", "https"):
                    continue
                if not parsed.netloc.endswith("nasa.gov") or href in seen:
                    continue
                text = a.get_text(" ", strip=True)
                if words and not any(w in (text + " " + href).lower() for w in words):
                    continue
                path = parsed.path.lower()
                if path.endswith(".pdf"):
                    seen.add(href)
                    yield DiscoveredDocument(text or path.rsplit("/", 1)[-1], href, "history", "pdf")
                    found += 1
                elif path.endswith((".htm", ".html")) or path.endswith("/") or "." not in path.rsplit("/", 1)[-1]:
                    seen.add(href)
                    yield DiscoveredDocument(text or href, href, "history", "html")
                    found += 1
                    if level + 1 <= depth:
                        queue.append((href, level + 1))
                if found >= limit:
                    return


# ------------------------------------------------------------------- Images
def discover_nasa_images(query: str, limit: int = 50, **_) -> Iterator[DiscoveredDocument]:
    """NASA Image & Video Library: the descriptions are good historical text."""
    found, page = 0, 1
    with httpx.Client(timeout=30, headers=HEADERS) as client:
        while found < limit:
            r = client.get(
                IMAGES_API,
                params={"q": query, "media_type": "image,video,audio",
                        "page": page, "page_size": min(100, limit)},
            )
            if r.status_code != 200:
                break
            items = r.json().get("collection", {}).get("items", [])
            if not items:
                break
            for it in items:
                d = (it.get("data") or [{}])[0]
                nid, desc = d.get("nasa_id"), (d.get("description") or "").strip()
                if not nid or len(desc) < 80:
                    continue
                title = d.get("title") or nid
                extras = []
                if d.get("location"):
                    extras.append(f"Location: {d['location']}")
                if d.get("center"):
                    extras.append(f"NASA center: {d['center']}")
                if d.get("keywords"):
                    extras.append("Keywords: " + ", ".join(d["keywords"]))
                yield DiscoveredDocument(
                    title=title,
                    url=f"https://images.nasa.gov/details/{nid}",
                    source_name="images",
                    kind_hint="text",
                    published_date=_parse_date(d.get("date_created")),
                    inline_text="\n\n".join([title, desc, *extras]),
                )
                found += 1
                if found >= limit:
                    return
            page += 1


DISCOVERERS = {
    "ntrs": discover_ntrs,
    "history": discover_nasa_history,
    "images": discover_nasa_images,
}


def discover(sources: list[str], query: str, limit: int, **kwargs) -> Iterator[DiscoveredDocument]:
    for name in sources:
        fn = DISCOVERERS.get(name)
        if fn is None:
            raise ValueError(f"Unknown source '{name}'. Choose from {list(DISCOVERERS)}")
        try:
            yield from fn(query=query, limit=limit, **kwargs)
        except httpx.HTTPError as exc:
            log.error("source %s failed: %s", name, exc)
