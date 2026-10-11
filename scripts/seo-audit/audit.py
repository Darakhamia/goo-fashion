#!/usr/bin/env python3
"""
SEO-проверка живого сайта: обходит sitemap.xml и несколько страниц вне его,
снимает с HTML то, что видит поисковик, и печатает сводку по проверкам
из docs/SEO_PLAN.md. Только стандартная библиотека Python 3.9+.

    python3 scripts/seo-audit/audit.py                       # прод
    python3 scripts/seo-audit/audit.py --base http://localhost:3000
    python3 scripts/seo-audit/audit.py --json /tmp/seo.json  # сырые данные

Запросы идут с User-Agent Googlebot: Next отдаёт ботам метаданные в <head>
блокирующе, а обычным браузерам может дописывать их потоком. Время ответа
не меряется — через прокси оно ничего не говорит; вес и разметка — факт.
"""
import argparse
import collections
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

# Публичные страницы, которых нет в sitemap.xml, но которые открываются по ссылкам.
EXTRA_PATHS = ["/builder", "/subscribe", "/cart"]


class Page(HTMLParser):
    """Собирает со страницы теги, важные для поиска."""

    SKIP_TEXT = {"script", "style", "noscript", "template", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = None
        self.meta = {}
        self.canonical = None
        self.h1 = []
        self.jsonld = []
        self.links = []  # (href, rel)
        self.images = 0
        self.images_no_alt = 0
        self.text = []
        self._stack = []
        self._title_buf = None
        self._h1_buf = None
        self._jsonld_buf = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self._stack.append(tag)
        if tag == "title" and self.title is None:
            self._title_buf = []
        elif tag == "meta":
            key = a.get("name") or a.get("property")
            if key and key not in self.meta:
                self.meta[key] = a.get("content")
        elif tag == "link" and "canonical" in (a.get("rel") or "").split():
            self.canonical = a.get("href")
        elif tag == "h1":
            self._h1_buf = []
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._jsonld_buf = []
        elif tag == "a" and a.get("href"):
            self.links.append((a["href"], (a.get("rel") or "").split()))
        elif tag == "img":
            self.images += 1
            if "alt" not in a:
                self.images_no_alt += 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self._pop(tag)

    def handle_endtag(self, tag):
        if tag == "title" and self._title_buf is not None:
            self.title = "".join(self._title_buf).strip()
            self._title_buf = None
        elif tag == "h1" and self._h1_buf is not None:
            self.h1.append(" ".join("".join(self._h1_buf).split()))
            self._h1_buf = None
        elif tag == "script" and self._jsonld_buf is not None:
            try:
                data = json.loads("".join(self._jsonld_buf))
                self.jsonld.extend(data if isinstance(data, list) else [data])
            except ValueError:
                self.jsonld.append({"@type": "INVALID_JSON"})
            self._jsonld_buf = None
        self._pop(tag)

    def _pop(self, tag):
        if tag in self._stack:
            while self._stack and self._stack.pop() != tag:
                pass

    def handle_data(self, data):
        if self._title_buf is not None:
            self._title_buf.append(data)
        if self._h1_buf is not None:
            self._h1_buf.append(data)
        if self._jsonld_buf is not None:
            self._jsonld_buf.append(data)
        if not self.SKIP_TEXT.intersection(self._stack):
            self.text.append(data)


def fetch(url):
    req = Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
    try:
        with urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except HTTPError as e:
        return e.code, e.read()
    except URLError as e:
        return 0, str(e).encode()


def analyze(url, base_host):
    status, body = fetch(url)
    p = Page()
    p.feed(body.decode("utf-8", "replace"))
    text = " ".join(" ".join(p.text).split())
    internal, external = [], []
    for href, rel in p.links:
        host = urlparse(urljoin(url, href)).hostname or ""
        if host.endswith(base_host):
            internal.append(urljoin(url, href))
        elif href.startswith("http"):
            external.append((href, rel))
    return {
        "url": url,
        "status": status,
        "bytes": len(body),
        "title": p.title,
        "description": p.meta.get("description"),
        "robots": p.meta.get("robots"),
        "canonical": p.canonical,
        "og_url": p.meta.get("og:url"),
        "og_title": p.meta.get("og:title"),
        "og_image": p.meta.get("og:image"),
        "twitter_title": p.meta.get("twitter:title"),
        "h1": p.h1,
        "jsonld": p.jsonld,
        "images": p.images,
        "images_no_alt": p.images_no_alt,
        "words": len(re.findall(r"\w+", text)),
        "text": text,
        "internal": internal,
        "external": external,
    }


def kind(url):
    path = urlparse(url).path.strip("/")
    return path.split("/")[0] if path else "home"


def norm(url):
    return (url or "").rstrip("/")


def same_page(a, b):
    """Один ли адрес: путь и query без хоста — стенд пишет в canonical боевой домен."""
    if not a or not b:
        return False
    pa, pb = urlparse(a), urlparse(b)
    return (pa.path.rstrip("/"), pa.query) == (pb.path.rstrip("/"), pb.query)


def offer_prices(product):
    """(цена, валюта) из Offer или AggregateOffer в JSON-LD товара."""
    offers = product.get("offers") or {}
    if offers.get("@type") == "AggregateOffer":
        return [(offers.get("lowPrice"), offers.get("priceCurrency"))]
    return [(offers.get("price"), offers.get("priceCurrency"))]


def price_visible(amount, text):
    """Есть ли цена из JSON-LD на странице — целым числом с разделителем тысяч."""
    if amount is None:
        return True
    whole = f"{int(float(amount)):,}"
    rounded = f"{round(float(amount)):,}"
    return any(re.search(rf"(?<![\d,]){re.escape(n)}(?![\d,])", text) for n in {whole, rounded})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="https://goo-fashion.com")
    ap.add_argument("--json", help="куда сохранить сырые данные по каждой странице")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    base = args.base.rstrip("/")
    base_host = urlparse(base).hostname
    status, sm = fetch(f"{base}/sitemap.xml")
    if status != 200:
        sys.exit(f"sitemap.xml: HTTP {status}")
    sitemap_urls = re.findall(r"<loc>([^<]+)</loc>", sm.decode())
    # sitemap пишет боевой домен; при --base на стенд меряем стенд
    sitemap_urls = [base + urlparse(u).path for u in sitemap_urls]
    urls = sitemap_urls + [base + p for p in EXTRA_PATHS]

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        pages = list(ex.map(lambda u: analyze(u, base_host), urls))
    if args.json:
        with open(args.json, "w") as f:
            json.dump(pages, f, ensure_ascii=False, indent=1)

    ok = [p for p in pages if p["status"] == 200]
    indexable = [p for p in ok if "noindex" not in (p["robots"] or "")]
    by_kind = collections.Counter(kind(p["url"]) for p in pages[: len(sitemap_urls)])

    print(f"# SEO-сводка {base}\n")
    print(f"sitemap.xml: {len(sitemap_urls)} URL — " + ", ".join(f"{k} {v}" for k, v in by_kind.most_common()))
    print(f"проверено страниц: {len(pages)} (из них вне sitemap: {len(EXTRA_PATHS)})\n")

    def report(name, bad, show=lambda p: p["url"], limit=12):
        mark = "OK " if not bad else "!! "
        print(f"{mark}{name}: {len(bad)}")
        for p in bad[:limit]:
            print(f"     {show(p)}")
        if len(bad) > limit:
            print(f"     … и ещё {len(bad) - limit}")

    report("не 200 в sitemap", [p for p in pages[: len(sitemap_urls)] if p["status"] != 200],
           lambda p: f'{p["status"]} {p["url"]}')
    report("noindex в sitemap", [p for p in pages[: len(sitemap_urls)] if "noindex" in (p["robots"] or "")])
    report("canonical не на свой адрес", [p for p in indexable if not same_page(p["canonical"], p["url"])],
           lambda p: f'{p["url"]} → {p["canonical"]}')
    report("og:url нет или не свой адрес", [p for p in indexable if not same_page(p["og_url"], p["url"])],
           lambda p: f'{p["url"]} → {p["og_url"]}')

    for field, label in (("title", "title"), ("description", "description")):
        groups = collections.defaultdict(list)
        for p in indexable:
            groups[(p[field] or "").strip()].append(p)
        dups = [(v, ps) for v, ps in groups.items() if len(ps) > 1]
        n = sum(len(ps) for _, ps in dups)
        print(f'{"OK " if not dups else "!! "}дубли {label}: {n} страниц в {len(dups)} группах')
        for v, ps in sorted(dups, key=lambda x: -len(x[1]))[:5]:
            print(f'     ×{len(ps)} «{v[:70]}»'.replace("\n", "⏎"))

    report("без description", [p for p in indexable if not p["description"]])
    report("description длиннее 160", [p for p in indexable if len(p["description"] or "") > 160])
    report("description обрезан посреди текста (ровно 155, без точки)",
           [p for p in indexable if len(p["description"] or "") == 155 and not p["description"].rstrip().endswith((".", "!", "?", "…"))])
    report("description с переносами строк", [p for p in indexable if "\n" in (p["description"] or "")])
    report("title длиннее 60", [p for p in indexable if len(p["title"] or "") > 60],
           lambda p: f'{len(p["title"])} {p["title"]}', limit=5)
    report("H1 не ровно один", [p for p in indexable if len(p["h1"]) != 1],
           lambda p: f'{p["url"]} — H1: {p["h1"]}')
    report("без og:image", [p for p in indexable if not p["og_image"]])
    report("twitter:title не совпадает с og:title",
           [p for p in indexable if p["twitter_title"] and p["twitter_title"] != p["og_title"]],
           lambda p: f'{p["url"]} — «{p["twitter_title"]}»')
    report("картинки без alt", [p for p in ok if p["images_no_alt"]],
           lambda p: f'{p["url"]} — {p["images_no_alt"]}')

    products = [p for p in indexable if kind(p["url"]) == "product"]
    mismatch = []
    for p in products:
        prod = next((j for j in p["jsonld"] if j.get("@type") == "Product"), None)
        if not prod:
            continue
        for amount, currency in offer_prices(prod):
            if not price_visible(amount, p["text"]):
                mismatch.append((p, amount, currency))
    report("товары: цены из JSON-LD нет на странице",
           [m[0] for m in mismatch],
           lambda p: next(f'{p["url"]} — JSON-LD {a} {c}' for q, a, c in mismatch if q is p), limit=5)
    report("товары без JSON-LD Product", [p for p in products if not any(j.get("@type") == "Product" for j in p["jsonld"])])

    ext = [(p, href, rel) for p in ok for href, rel in p["external"] if kind(p["url"]) in ("product", "outfit", "home")]
    unsponsored = [x for x in ext if "sponsored" not in x[2] and "nofollow" not in x[2]]
    print(f'{"OK " if not unsponsored else "!! "}ссылки в магазины без rel="sponsored"/"nofollow": '
          f"{len(unsponsored)} из {len(ext)}")

    browse = next((p for p in ok if norm(p["url"]) == base + "/browse"), None)
    if browse:
        n = len({u for u in browse["internal"] if "/product/" in u or "/outfit/" in u})
        print(f'{"OK " if n else "!! "}/browse: ссылок на товары и образы в HTML: {n}, '
              f'картинок: {browse["images"]}, слов: {browse["words"]}')

    print("\nТипы JSON-LD по разделам:")
    types = collections.defaultdict(collections.Counter)
    for p in indexable:
        types[kind(p["url"])][", ".join(sorted(str(j.get("@type")) for j in p["jsonld"])) or "—"] += 1
    for k, c in types.items():
        print(f"  {k}: " + "; ".join(f"{t} ×{n}" for t, n in c.most_common()))


if __name__ == "__main__":
    main()
