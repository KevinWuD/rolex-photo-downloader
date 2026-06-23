import asyncio, json, re, sys
from pathlib import Path

sys.path.insert(0, '/Users/kevin/Library/Python/3.9/lib/python/site-packages')
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

OUT = Path(__file__).resolve().parent.parent / 'data' / 'tudor_catalog.json'
CDN_HASH = '0yi5ee8b69yh3'
DEFAULT_ANGLES = ['upright-cb-with-drop-shadow', 'bracelet-c', 'upright-ob']
CONCURRENCY = 8

SPEC_SECTIONS = {
    'Case':           'case',
    'Movement':       'movement',
    'Power Reserve':  'power_reserve',
    'Winding Crown':  'winding_crown',
    'Waterproofness': 'waterproofness',
    'Bezel':          'bezel',
    'Dial':           'dial',
    'Crystal':        'crystal',
    'Bracelet':       'bracelet',
    'Strap':          'bracelet',
}


def slug_to_name(slug):
    return ' '.join(w.capitalize() for w in slug.replace('-', ' ').split())


def parse_specs(text):
    specs = {}
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    for line in lines:
        m = re.match(r'^Reference:\s*(.+)', line)
        if m:
            specs['reference'] = m.group(1).strip()
            break

    current_key = None
    buf = []
    for line in lines:
        if line in SPEC_SECTIONS:
            if current_key is not None:
                specs[current_key] = ' '.join(buf)
            current_key = SPEC_SECTIONS[line]
            buf = []
        elif current_key is not None and not line.startswith('Reference:') and line != 'WATCH SPECIFICATIONS':
            buf.append(line)
    if current_key is not None:
        specs[current_key] = ' '.join(buf)

    return specs


async def get_collections(page):
    print('Discovering collections...')
    await page.goto('https://www.tudorwatch.com/en/watches', wait_until='networkidle', timeout=30000)
    await page.wait_for_timeout(1500)
    html = await page.content()
    slugs = list(set(re.findall(r'href="/en/watches/([^/"]+)"', html)))
    print(f'  {len(slugs)} collections found')
    return slugs


async def get_products_for_collection(page, slug):
    resp = await page.goto(f'https://www.tudorwatch.com/en/watches/{slug}',
                           wait_until='networkidle', timeout=20000)
    if resp.status != 200:
        print(f'  {slug}: {resp.status}')
        return []
    await page.wait_for_timeout(500)
    html = await page.content()
    links = [l for l in re.findall(r'href="(/en/watches/[^"]+)"', html) if l.count('/') == 4]
    return list(set(links))


async def fetch_product(context, url):
    """Fetch a product page via context.request (no JS rendering, much faster)."""
    ref = url.rstrip('/').split('/')[-1]
    collection_slug = url.rstrip('/').split('/')[-2]

    try:
        resp = await context.request.get(
            f'https://www.tudorwatch.com{url}',
            headers={
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.tudorwatch.com/en/watches',
            },
        )
        if resp.status != 200:
            print(f'  {resp.status} {url}')
            return ref, None

        html = await resp.text()

        # Name from <title> tag
        title_m = re.search(r'<title>([^<]+)</title>', html)
        name = ref
        if title_m:
            raw = title_m.group(1)
            raw = re.sub(r'\s*\|\s*TUDOR.*$', '', raw).strip()
            raw = re.sub(r'\s*-\s*[mM][\w-]+$', '', raw).strip()
            if raw:
                name = raw

        # Catalogue angles
        angle_matches = re.findall(
            rf'catalogue/{CDN_HASH}/([^/"\'\s]+)/tudor-{re.escape(ref)}',
            html
        )
        angles = list(dict.fromkeys(angle_matches)) or DEFAULT_ANGLES

        # Extra images: wrist / beautyshots / ambiance
        extras = []
        for kind in ('wrist', 'beautyshots', 'ambiance'):
            pat = rf'tudorwatch/model-assets/{kind}/tudor-{re.escape(ref)}'
            if re.search(pat, html):
                extras.append(f'tudorwatch/model-assets/{kind}/tudor-{ref}')

        # Specs from #full-specifications section text
        specs_m = re.search(r'id="full-specifications"[^>]*>(.*?)</section>', html, re.DOTALL)
        specs = {}
        if specs_m:
            text = re.sub(r'<[^>]+>', '\n', specs_m.group(1))
            specs = parse_specs(text)

        return ref, {
            'ref':             ref,
            'name':            name,
            'collection':      slug_to_name(collection_slug),
            'collection_slug': collection_slug,
            'angles':          angles,
            'extras':          extras,
            'specs':           specs,
        }

    except Exception as e:
        print(f'  ERROR {url}: {e}')
        return ref, None


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
        page = await context.new_page()

        print('Warming up...')
        await page.goto('https://www.tudorwatch.com/en', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(1500)

        collection_slugs = await get_collections(page)

        all_product_urls = set()
        for slug in collection_slugs:
            links = await get_products_for_collection(page, slug)
            all_product_urls.update(links)
            if links:
                print(f'  {slug}: {len(links)} products')

        product_list = sorted(all_product_urls)
        todo = [u for u in product_list if u.rstrip('/').split('/')[-1] not in existing]
        print(f'\nTotal: {len(product_list)} products, {len(todo)} to fetch')

        results = dict(existing)
        sem = asyncio.Semaphore(CONCURRENCY)
        done_count = 0

        async def fetch_one(url):
            nonlocal done_count
            async with sem:
                ref, data = await fetch_product(context, url)
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
