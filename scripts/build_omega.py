import asyncio, json, re, sys
from pathlib import Path

sys.path.insert(0, '/Users/kevin/Library/Python/3.9/lib/python/site-packages')
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

OUT  = Path(__file__).resolve().parent.parent / 'data' / 'omega_catalog.json'
BASE = 'https://www.omegawatches.com/en-us'
CONCURRENCY = 4

COLLECTION_MAP = {
    'speedmaster':   'Speedmaster',
    'seamaster':     'Seamaster',
    'de-ville':      'De Ville',
    'constellation': 'Constellation',
    'specialities':  'Specialities',
}

# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_name(html):
    m = re.search(r'<title>([^|<]+)', html)
    if m:
        return re.sub(r'\s+', ' ', m.group(1)).strip()
    m = re.search(r'"name"\s*:\s*"([^"]+)"', html)
    return m.group(1).strip() if m else ''

def parse_sku(html):
    m = re.search(r'"sku"\s*:\s*"([\d.]+)"', html)
    return m.group(1) if m else None

def parse_images(html, ref):
    imgs = re.findall(
        rf'/media/catalog/product/o/m/([^"\'<\s?&]+{re.escape(ref)}[^"\'<\s?&]*\.(?:png|jpg|jpeg))',
        html
    )
    seen, result = set(), []
    for img in imgs:
        if img not in seen and '/cache/' not in img:
            seen.add(img)
            result.append(f'https://www.omegawatches.com/media/catalog/product/o/m/{img}')
    return result

def parse_specs_from_panel(panel_text):
    """Parse label/value pairs from Technical Data panel text."""
    specs = {}
    skip = {'open case measurement modal', 'open movement modal'}
    lines = [l.strip() for l in panel_text.split('\n') if l.strip()]
    i = 0
    while i < len(lines) - 1:
        label = lines[i]
        if label.lower() in skip:
            i += 1
            continue
        value_parts = []
        j = i + 1
        while j < len(lines):
            if lines[j].lower() in skip:
                j += 1
                continue
            # Next label is one that doesn't look like a value (short, title-case)
            next_is_label = (
                j + 1 < len(lines) and
                len(lines[j]) < 40 and
                not any(c.isdigit() for c in lines[j][:3])
            )
            value_parts.append(lines[j])
            j += 1
            break
        value = ' '.join(value_parts).strip()
        if label and value and len(label) < 60:
            key = label.lower().replace(' ', '_').replace('-', '_').replace('‑', '_')
            specs[key] = value
        i = j
    return specs

# ── Discovery ─────────────────────────────────────────────────────────────────

async def discover_products(page):
    """Return all product URLs from all collection pages."""
    await page.goto(f'{BASE}/watches', wait_until='domcontentloaded', timeout=30000)
    await page.wait_for_timeout(2000)
    html = await page.content()

    # Find collection URLs
    cols = list(dict.fromkeys(
        re.findall(r'href="(https://www\.omegawatches\.com/en-us/watches/[^"]+)"', html)
    ))
    # Filter to direct sub-collection pages
    cols = [c for c in cols if c.count('/') == 7]  # /en-us/watches/{name}
    print(f'  {len(cols)} collection pages')

    product_urls = set()
    for col_url in cols:
        resp = await page.goto(col_url, wait_until='domcontentloaded', timeout=20000)
        if resp and resp.status == 200:
            await page.wait_for_timeout(1500)
            col_html = await page.content()
            found = re.findall(
                r'href="(https://www\.omegawatches\.com/en-us/watch-[^"]+)"',
                col_html
            )
            col_name = col_url.rstrip('/').split('/')[-1]
            print(f'  {col_name}: {len(found)} products')
            product_urls.update(found)

    return list(product_urls)

# ── Per-product scrape ────────────────────────────────────────────────────────

async def scrape_product(context, url, collection):
    ref_m = re.search(r'-(\d{14})$', url)
    if not ref_m:
        return None, None
    ref = ref_m.group(1)

    try:
        page = await context.new_page()
        resp = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        if not resp or resp.status != 200:
            await page.close()
            return ref, None
        await page.wait_for_timeout(1500)
        html = await page.content()

        sku  = parse_sku(html)
        name = parse_name(html)
        imgs = parse_images(html, ref)

        if not imgs:
            await page.close()
            return ref, None

        # Click Technical Data tab to reveal specs
        specs = {}
        try:
            await page.evaluate("(() => { const s=document.getElementById('onetrust-consent-sdk'); if(s) s.remove(); })()")
            await page.evaluate("(() => { const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim().toUpperCase().includes('TECHNICAL DATA')); if(b) b.click(); })()")
            await page.wait_for_timeout(800)
            panel_text = await page.evaluate("""(() => {
                const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase().includes('TECHNICAL DATA'));
                if (!btn) return '';
                const id = btn.getAttribute('aria-controls');
                const panel = id ? document.getElementById(id) : null;
                return panel ? panel.innerText : '';
            })()""")
            if panel_text:
                specs = parse_specs_from_panel(panel_text)
        except Exception:
            pass

        await page.close()

        return ref, {
            'ref':        ref,
            'sku':        sku or ref,
            'name':       name,
            'collection': collection,
            'images':     imgs,
            'specs':      specs,
        }
    except Exception as e:
        print(f'  ERROR {url}: {e}')
        return ref, None

# ── Main ──────────────────────────────────────────────────────────────────────

def _save(data):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

async def main():
    existing = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text('utf-8'))
            print(f'Resuming — {len(existing)} already cached')
        except Exception:
            pass

    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        )

        nav_page = await context.new_page()
        print('Warming up...')
        await nav_page.goto(f'{BASE}/', wait_until='domcontentloaded', timeout=30000)
        await nav_page.wait_for_timeout(2000)

        print('Discovering products...')
        product_urls = await discover_products(nav_page)
        await nav_page.close()
        print(f'Total: {len(product_urls)} product URLs')

        def col_from_url(url):
            for slug, name in COLLECTION_MAP.items():
                if f'/watch-omega-{slug}-' in url or url.endswith(f'/watch-omega-{slug}'):
                    return name
            m = re.search(r'/watch-omega-([a-z]+)', url)
            return m.group(1).capitalize() if m else 'Other'

        todo = [u for u in product_urls
                if (m := re.search(r'-(\d{14})$', u)) and m.group(1) not in existing]
        print(f'To fetch: {len(todo)}')

        results = dict(existing)
        sem = asyncio.Semaphore(CONCURRENCY)
        done_count = 0

        async def fetch_one(url):
            nonlocal done_count
            async with sem:
                col = col_from_url(url)
                ref, data = await scrape_product(context, url, col)
                if data:
                    results[ref] = data
                done_count += 1
                if done_count % 20 == 0 or done_count == len(todo):
                    _save(results)
                    print(f'  {done_count}/{len(todo)} done, {len(results)} in catalog')

        await asyncio.gather(*[fetch_one(u) for u in todo])
        await browser.close()

    _save(results)
    print(f'\nDone: {len(results)} watches -> {OUT}')

if __name__ == '__main__':
    asyncio.run(main())
