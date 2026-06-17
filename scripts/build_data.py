import asyncio, csv, json, re, sys
from pathlib import Path

sys.path.insert(0, '/Users/kevin/Library/Python/3.9/lib/python/site-packages')
from playwright.async_api import async_playwright

CSV_IN = Path(__file__).resolve().parent.parent.parent / 'rolex_catalog.csv'
OUT    = Path(__file__).resolve().parent.parent / 'data' / 'rolex_catalog.json'

N360        = 250
RMC_RE      = re.compile(r'^m(.+)-(\d+)$')
CONCURRENCY = 6


def extract_specs(data):
    def lab(obj, key):
        return (obj.get('labels') or {}).get(key) or ''

    c = data.get('case', {})
    m = data.get('movement', {})
    d = data.get('dial', {})
    b = data.get('bracelet', {})
    return {
        'case_diameter':     lab(c, 'diameter'),
        'case_material':     lab(c, 'material'),
        'bezel':             lab(c, 'bezel'),
        'water_resistance':  lab(c, 'water_resistance'),
        'crystal':           lab(c, 'crystal'),
        'crown':             lab(c, 'winding_crown'),
        'movement':          lab(m, 'title'),
        'calibre':           lab(m, 'calibre'),
        'certification':     lab(m, 'certification'),
        'power_reserve':     lab(m, 'autonomy'),
        'precision':         lab(m, 'precision_static'),
        'functions':         lab(m, 'functions'),
        'oscillator':        lab(m, 'oscillator'),
        'dial':              lab(d, 'title'),
        'dial_details':      lab(d, 'details'),
        'bracelet':          lab(b, 'title'),
        'bracelet_material': lab(b, 'material'),
        'clasp':             lab(b, 'clasp_type'),
    }


async def fetch_specs(rmcs, existing):
    todo = [r for r in rmcs if r not in existing]
    print(f'{len(existing)} already cached, fetching {len(todo)} remaining...')
    if not todo:
        return existing

    results = dict(existing)
    sem = asyncio.Semaphore(CONCURRENCY)
    done = 0

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale='en-US',
        )
        page = await context.new_page()
        print('Warming up session...')
        await page.goto('https://www.rolex.com/en-us/watches', wait_until='networkidle', timeout=45000)
        await page.wait_for_timeout(2000)
        await page.close()

        async def fetch_one(rmc):
            nonlocal done
            async with sem:
                try:
                    r = await context.request.get(
                        f'https://www.rolex.com/api/catalog/watches/{rmc}?language=en-us',
                        headers={
                            'Accept': 'application/json',
                            'Referer': 'https://www.rolex.com/en-us/watches',
                        },
                    )
                    if r.status == 200:
                        data = await r.json()
                        results[rmc] = extract_specs(data)
                    else:
                        results[rmc] = {}
                        print(f'  HTTP {r.status} {rmc}')
                except Exception as e:
                    results[rmc] = {}
                    print(f'  ERROR {rmc}: {e}')
                finally:
                    done += 1
                    if done % 100 == 0 or done == len(todo):
                        print(f'  {done}/{len(todo)} fetched')
                        # checkpoint save
                        _save(results, rmcs)

        await asyncio.gather(*[fetch_one(rmc) for rmc in todo])
        await browser.close()

    return results


def _save(specs, all_rmcs):
    """Write a partial catalog.json so progress survives interruption."""
    with open(CSV_IN, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    catalog = {}
    for r in rows:
        m = RMC_RE.match(r['rmc'])
        if not m:
            continue
        ref = m.group(1).upper()
        has360 = r['has360'] == 'True'
        variant = {
            'rmc':         r['rmc'],
            'family':      r['family'],
            'case':        r['facet_case_title'],
            'material':    r['alt_material'].replace('alt-', '').replace('-', ' '),
            'case_id':     r['case_id'],
            'bracelet_id': r['bracelet_id'],
            'has360':      has360,
            'n360':        N360 if has360 else 0,
            'specs':       specs.get(r['rmc'], {}),
        }
        catalog.setdefault(ref, []).append(variant)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))


def main():
    with open(CSV_IN, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    # resume: load specs already cached in catalog.json
    existing_specs = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding='utf-8'))
            for variants in old.values():
                for v in variants:
                    if v.get('specs'):
                        existing_specs[v['rmc']] = v['specs']
            if existing_specs:
                print(f'Resuming — {len(existing_specs)} specs already in catalog.json')
        except Exception:
            pass

    all_rmcs = [r['rmc'] for r in rows if RMC_RE.match(r['rmc'])]
    specs = asyncio.run(fetch_specs(all_rmcs, existing_specs))
    _save(specs, all_rmcs)

    total = sum(len(v) for v in json.loads(OUT.read_text()).values())
    refs  = len(json.loads(OUT.read_text()))
    print(f'{refs} reference numbers, {total} variants -> {OUT}')


if __name__ == '__main__':
    main()
