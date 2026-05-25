#!/usr/bin/env python3
"""
AWIN CSV → Supabase import script for GOO Fashion.

Usage:
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  python3 scripts/import_awin.py

Files are hardcoded below. Edit FILES list if paths differ.
"""

import gzip, csv, re, os, sys, json, time
from collections import defaultdict
from supabase import create_client

# ─── Configuration ────────────────────────────────────────────────────────────

FILES = [
    "/root/.claude/uploads/c887b56c-38ef-4b10-915a-454958161212/4a16756a-123260114621en_GBDefault.csv.gz",
    "/root/.claude/uploads/c887b56c-38ef-4b10-915a-454958161212/a047b844-datafeed_2883929_1.csv.gz",
    "/root/.claude/uploads/c887b56c-38ef-4b10-915a-454958161212/df34516b-datafeed_2883929_2.csv_2.gz",
]

BATCH_SIZE = 50  # rows per Supabase insert batch

# ─── Fashion filter ───────────────────────────────────────────────────────────

SKIP_CAT_RE = re.compile(
    r'workwear|work boot|work trainer|work shoe|work glove|hi.?vis|'
    r'undergarment|lingerie|safety|ppe|glove|tool|garden|electrical|'
    r'plumbing|automotive|pet|baby', re.I
)
SKIP_NAME_RE = re.compile(
    r'work wear|hi.?vis|safety boot|drill|wrench|spanner|socket set|'
    r'waistcoat|reflective vest', re.I
)
FASHION_BRANDS_FILE2 = {
    'tommy jeans', 'farah', 'remus uomo', 'vinci', 'gant',
    'bravo', 'emensuits',
}

# ─── Category mapping ─────────────────────────────────────────────────────────

CAT_MAP = {
    r'trouser|pant(?!y)|chino|jogger|legging': 'bottoms',
    r'jeans?|denim(?! jacket)': 'jeans',
    r'\bshort\b': 'shorts',
    r'skirt': 'skirts',
    r'dress|gown|midi|maxi': 'dresses',
    r'suit|blazer': 'blazers',
    r'jacket|coat|parka|anorak|bomber|trench|windbreaker': 'outerwear',
    r'knitwear|knit|sweater|jumper|cardigan': 'knitwear',
    r'hoodie|sweatshirt|pullover': 'tops',
    r'\bshirt\b|polo|blouse': 'shirts',
    r'\btop\b|t.?shirt|tee': 'tops',
    r'footwear|shoe|boot|trainer|sneaker|sandal|loafer|pump|heel': 'footwear',
    r'bag|backpack|tote|clutch|handbag|luggage': 'bags',
    r'swim|bikini|beachwear': 'swimwear',
    r'jumpsuit|playsuit|overall': 'jumpsuits',
    r'formal shirt': 'shirts',
    r'polo shirt': 'shirts',
}
GENDER_RE = re.compile(r'\b(women|girls|ladies|femme|female)\b|\bwomens?\b', re.I)
MENS_RE   = re.compile(r'\b(men|boys|homme|male)\b|\bmens?\b', re.I)

def map_category(category_raw: str, name: str) -> tuple[str, str | None]:
    text = (category_raw + ' ' + name).lower()
    for pattern, cat in CAT_MAP.items():
        if re.search(pattern, text):
            break
    else:
        cat = 'accessories'
    gender = None
    if GENDER_RE.search(category_raw + ' ' + name):
        gender = 'women'
    elif MENS_RE.search(category_raw + ' ' + name):
        gender = 'men'
    return cat, gender

# ─── Name cleaning ────────────────────────────────────────────────────────────

SIZE_SUFFIX = re.compile(
    r'\s*[\|]\s*\S.*$'
    r'|\s+(?:UK\s+)?(?:\d{1,3}(?:\.\d)?|XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|'
    r'One\s*Size|OS|ONESIZE|T_\w+)\s*$', re.IGNORECASE
)

def clean_name(raw: str) -> str:
    n = raw.strip().strip('"')
    n = SIZE_SUFFIX.sub('', n).strip()
    # Remove trailing size/color like " | Navy S" or " - Black - M"
    n = re.sub(r'\s+[-–]\s+\w[\w\s]*$', '', n).strip()
    return n

# ─── Image helpers ────────────────────────────────────────────────────────────

def boost(url: str) -> str:
    if not url:
        return url
    url = url.replace('w=200', 'w=800').replace('h=200', 'h=800')
    url = url.replace('w=70',  'w=800').replace('h=70',  'h=800')
    return url

def collect_images(row: dict) -> list[str]:
    g = lambda *keys: next((row.get(k,'').strip() for k in keys if row.get(k,'').strip()), '')
    # Priority: merchant CDN (Shopify etc.) → AWIN proxy → extras
    merchant_img = g('merchant_image_url')
    aw_img       = boost(g('aw_image_url'))
    alt1         = g('alternate_image')
    alt2         = g('alternate_image_two')
    alt3         = g('alternate_image_three')
    alt4         = g('alternate_image_four')
    large        = g('large_image')

    # For Shopify CDN images prefer merchant_image_url as the cleanest source
    candidates = [merchant_img, aw_img, alt1, alt3, alt4, large, alt2]
    seen, result = set(), []
    for u in candidates:
        if u and u not in seen:
            seen.add(u)
            result.append(u)
    return result

# ─── Row filter ───────────────────────────────────────────────────────────────

def is_fashion(row: dict, file_idx: int) -> bool:
    brand = (row.get('brand_name','') or row.get('merchant_name','')).lower()
    cat   = (row.get('merchant_category','') or row.get('category_name','')).lower()
    name  = row.get('product_name','').lower()

    if row.get('in_stock','') == '0':
        return False
    if SKIP_NAME_RE.search(name):
        return False

    if file_idx == 0:  # Brian Oak — skip undergarments
        return 'undergarment' not in cat

    if file_idx == 1:  # Mixed feed — allowlist only
        if SKIP_CAT_RE.search(cat):
            return False
        return any(fb in brand for fb in FASHION_BRANDS_FILE2)

    return True  # file 3 — all luxury

# ─── Group size variants → one product ────────────────────────────────────────

def group_variants(rows: list[dict]) -> dict:
    """Pick best representative row and collect sizes from all variants."""
    best = rows[0]
    sizes = set()
    for r in rows:
        sz = r.get('Fashion:size','').strip() or r.get('size_stock_amount','').strip()
        if sz:
            sizes.update(s.strip() for s in sz.split(',') if s.strip())
    return {'row': best, 'sizes': sorted(sizes), 'variant_count': len(rows)}

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    url = os.environ.get('SUPABASE_URL','').strip()
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY','').strip()
    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars", file=sys.stderr)
        sys.exit(1)

    sb = create_client(url, key)
    print(f"Connected to Supabase: {url[:40]}...")

    # ── Load & filter ────────────────────────────────────────────────────────
    print("\nLoading CSV files...")
    all_rows = []
    for fidx, path in enumerate(FILES):
        with gzip.open(path, 'rt', encoding='utf-8', errors='replace') as f:
            rows = list(csv.DictReader(f))
        fashion = [r for r in rows if is_fashion(r, fidx)]
        for r in fashion:
            r['__file'] = fidx
        all_rows.extend(fashion)
        print(f"  File {fidx+1}: {len(rows)} rows → {len(fashion)} fashion")

    print(f"\nTotal fashion rows: {len(all_rows)}")

    # ── Group size variants ──────────────────────────────────────────────────
    groups: dict[tuple, list] = defaultdict(list)
    for row in all_rows:
        raw   = row.get('product_name','').strip().strip('"')
        brand = row.get('brand_name','') or row.get('merchant_name','')
        key_  = (clean_name(raw), brand)
        groups[key_].append(row)

    products = {k: group_variants(v) for k, v in groups.items()}
    print(f"Unique products after grouping: {len(products)}")

    # ── Fetch existing source_urls to skip dupes ─────────────────────────────
    print("\nFetching existing product source_urls from Supabase...")
    existing_urls: set[str] = set()
    offset = 0
    while True:
        resp = sb.table('products').select('source_url').range(offset, offset + 999).execute()
        batch = [r['source_url'] for r in (resp.data or []) if r.get('source_url')]
        existing_urls.update(batch)
        if len(resp.data or []) < 1000:
            break
        offset += 1000
    print(f"  Found {len(existing_urls)} existing products in DB")

    # ── Build DB rows ────────────────────────────────────────────────────────
    to_insert = []
    skipped_no_img = skipped_no_price = skipped_duplicate = 0

    for (name, brand_), info in products.items():
        row    = info['row']
        sizes  = info['sizes']

        images = collect_images(row)
        if not images:
            skipped_no_img += 1
            continue

        price_raw = row.get('search_price','').strip()
        price = float(re.sub(r'[^\d.]', '', price_raw)) if price_raw else 0
        if not price:
            skipped_no_price += 1
            continue

        referral_url = row.get('aw_deep_link','').strip() or row.get('merchant_deep_link','').strip()
        if referral_url and referral_url in existing_urls:
            skipped_duplicate += 1
            continue

        rrp_raw = row.get('rrp_price','') or row.get('product_price_old','')
        rrp = float(re.sub(r'[^\d.]', '', rrp_raw)) if rrp_raw else 0
        price_max = rrp if rrp and rrp > price else price

        currency = row.get('currency','GBP') or 'GBP'
        if not currency.strip():
            currency = 'GBP'

        cat_raw = row.get('merchant_category','') or row.get('category_name','')
        category, gender = map_category(cat_raw, name)

        colour = row.get('colour','') or row.get('color','') or row.get('Fashion:swatch','')
        colors = [c.strip() for c in colour.split(',') if c.strip()] if colour else []

        material_raw = row.get('specifications','') or row.get('material','') or row.get('Fashion:material','')
        desc = row.get('description','') or row.get('product_short_description','') or ''

        retailer = {
            'name':         brand_ or row.get('merchant_name','Store'),
            'url':          referral_url,
            'price':        price,
            'currency':     currency,
            'availability': 'in stock',
            'isOfficial':   True,
        } if referral_url else None

        db_row = {
            'name':         name[:255],
            'brand':        (brand_ or '')[:100],
            'category':     category,
            'description':  desc[:2000],
            'image_url':    images[0],
            'images':       images,
            'colors':       colors,
            'sizes':        sizes,
            'material':     material_raw[:500],
            'retailers':    [retailer] if retailer else [],
            'price_min':    price,
            'price_max':    price_max,
            'currency':     currency,
            'is_new':       True,
            'is_saved':     False,
            'style_keywords': [],
            'gender':       gender,
            'source_url':   referral_url or None,
            'status':       'published',
            'ai_tags':      [],
        }
        to_insert.append(db_row)

    print(f"\nSkipped — no image: {skipped_no_img}")
    print(f"Skipped — no price:  {skipped_no_price}")
    print(f"Skipped — duplicate: {skipped_duplicate}")
    print(f"Ready to import:     {len(to_insert)}")

    if not to_insert:
        print("Nothing to import.")
        return

    # ── Batch insert ─────────────────────────────────────────────────────────
    print(f"\nInserting in batches of {BATCH_SIZE}...")
    inserted = errors = 0
    for i in range(0, len(to_insert), BATCH_SIZE):
        batch = to_insert[i:i + BATCH_SIZE]
        try:
            sb.table('products').insert(batch).execute()
            inserted += len(batch)
            print(f"  [{i+len(batch)}/{len(to_insert)}] inserted {len(batch)}", end='\r')
        except Exception as e:
            errors += len(batch)
            print(f"\n  ERROR batch {i}: {e}")
        time.sleep(0.05)  # gentle rate limiting

    print(f"\n\nDone! Inserted: {inserted} | Errors: {errors}")

if __name__ == '__main__':
    main()
