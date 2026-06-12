import csv, json, re
from pathlib import Path

CSV_IN = Path(__file__).resolve().parent.parent.parent / 'rolex_catalog.csv'
OUT    = Path(__file__).resolve().parent.parent / 'data' / 'catalog.json'

# All known 360 turntables on rolex.com use 250 frames (verified by sampling
# multiple case/bracelet combos directly against the CDN).
N360 = 250

RMC_RE = re.compile(r'^m(.+)-(\d+)$')


def main():
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
            'rmc': r['rmc'],
            'family': r['family'],
            'case': r['facet_case_title'],
            'material': r['alt_material'].replace('alt-', '').replace('-', ' '),
            'case_id': r['case_id'],
            'bracelet_id': r['bracelet_id'],
            'has360': has360,
            'n360': N360 if has360 else 0,
        }
        catalog.setdefault(ref, []).append(variant)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))

    print(f'{len(catalog)} reference numbers, {len(rows)} variants -> {OUT}')


if __name__ == '__main__':
    main()
