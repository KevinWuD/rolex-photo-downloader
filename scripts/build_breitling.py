import asyncio, json, re, sys
from pathlib import Path

sys.path.insert(0, '/Users/kevin/Library/Python/3.9/lib/python/site-packages')
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parent.parent / 'data' / 'breitling_catalog.json'
SITEMAP = 'https://www.breitling.com/us-en/sitemap.xml'
PRODUCTS_API = 'https://www.breitling.com/api/products/?languageCode=EN_US&skus={skus}'
BATCH = 50


def get_skus_from_sitemap():
    import urllib.request
    req = urllib.request.Request(
        SITEMAP,
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    )
    xml = urllib.request.urlopen(req, timeout=20).read().decode()
    skus = re.findall(r'/watches/[a-z0-9-]+/[a-z0-9-]+/([A-Za-z0-9]{10,14})/', xml)
    return sorted(set(skus))


def val(node, field):
    try:
        obj = node.get(field) or {}
        vals = obj.get('values') or []
        if not vals:
            return ''
        t = vals[0].get('translation') or {}
        return t.get('plainText') or vals[0].get('name') or ''
    except Exception:
        return ''


def original_url(thumb_url):
    return re.sub(
        r'(https://[^/]+)/media/thumbnails/products/(.+)_thumbnail_\d+\.webp',
        r'\1/media/products/\2.png',
        thumb_url,
    )


def extract(node):
    diameter = val(node, 'diameter')
    return {
        'sku':        node['slug'],
        'name':       node.get('name', ''),
        'collection': (node.get('collections') or [{}])[0].get('name', ''),
        'images': [
            {'url': original_url(m['url']), 'shot': (node.get('media') or [{}])[i].get('shotType', '')}
            for i, m in enumerate(node.get('mediaLarge') or [])
            if m.get('url')
        ],
        'specs': {
            'movement':          val(node, 'movement'),
            'caliber':           val(node, 'caliber'),
            'power_reserve':     val(node, 'powerReserve'),
            'vibration':         val(node, 'vibration'),
            'jewels':            val(node, 'jewel'),
            'chronograph':       val(node, 'chronograph'),
            'diameter':          (diameter + ' mm') if diameter else '',
            'case_material':     val(node, 'caseMaterial'),
            'water_resistance':  val(node, 'waterResistance'),
            'crystal':           val(node, 'crystal'),
            'dial_color':        val(node, 'dialColor'),
            'strap_material':    val(node, 'strapMaterial'),
            'strap_color':       val(node, 'strapColor'),
            'buckle_type':       val(node, 'buckleType'),
            'buckle_material':   val(node, 'buckleMaterial'),
            'lug_width':         val(node, 'lug'),
        },
    }


async def fetch_all(skus, existing):
    todo = [s for s in skus if s not in existing]
    print(f'{len(existing)} cached, fetching {len(todo)} remaining...')
    if not todo:
        return existing

    results = dict(existing)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale='en-US',
        )
        page = await context.new_page()
        print('Warming up session...')
        await page.goto('https://www.breitling.com/us-en/', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(1500)

        batches = [todo[i:i+BATCH] for i in range(0, len(todo), BATCH)]
        done = 0
        for batch in batches:
            try:
                r = await context.request.get(
                    PRODUCTS_API.format(skus=','.join(batch)),
                    headers={'Accept': 'application/json', 'Referer': 'https://www.breitling.com/'},
                    timeout=20000,
                )
                data = await r.json()
                for edge in data['data']['products']['edges']:
                    node = edge['node']
                    sku = node['slug']
                    results[sku] = extract(node)
                done += len(batch)
                print(f'  {done}/{len(todo)} fetched')
                _save(results)
            except Exception as e:
                print(f'  ERROR batch starting {batch[0]}: {e}')

        await browser.close()

    return results


def _save(data):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def main():
    print('Fetching SKUs from sitemap...')
    skus = get_skus_from_sitemap()
    print(f'{len(skus)} SKUs found')

    existing = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text(encoding='utf-8'))
            print(f'Resuming — {len(existing)} already in catalog')
        except Exception:
            pass

    results = asyncio.run(fetch_all(skus, existing))
    _save(results)
    print(f'{len(results)} products -> {OUT}')


if __name__ == '__main__':
    main()
