# Watch Photo Downloader

Pure static site (HTML/CSS/JS, no build step, no backend). Supports multiple
watch brands via tabs. User searches by reference/SKU, picks a variant, and
downloads catalog photos as a ZIP (or individually by clicking an image).

Currently supported brands: **Rolex**, **Breitling**.

## Files

- `index.html` — page structure
- `style.css` — light theme
- `app.js` — all logic (catalog lookup, URL building, fetch + JSZip + FileSaver)
- `data/rolex_catalog.json` — Rolex lookup table: reference number -> list of
  variants (`rmc`, `case_id`, `bracelet_id`, `has360`, `n360`, `specs`, etc.)
- `data/breitling_catalog.json` — Breitling lookup table: SKU -> product
  (`sku`, `name`, `collection`, `images`, `specs`)
- `scripts/build_data.py` — regenerates `data/rolex_catalog.json` from
  `../rolex_catalog.csv` (one level up, in `RolexMSRP/`)
- `scripts/build_breitling.py` — regenerates `data/breitling_catalog.json`
  by scraping Breitling's sitemap + API directly (no intermediate CSV)

## UI architecture

Brand switching uses a CSS visibility pattern — no JS show/hide per element:

- `document.body.className = 'brand-rolex'` or `'brand-breitling'`
- Elements with `.rolex-only` are hidden on Breitling and vice versa
- `body.brand-rolex .breitling-only { display: none !important }` in CSS

When adding a new brand: add a tab in `index.html`, a `.brand-X-only` CSS
rule in `style.css`, and handle the search/detail flow in `app.js` following
the same pattern.

## How images are fetched

### Rolex
Images come from Rolex's Cloudinary CDN (`media.rolex.com`), which sends
`Access-Control-Allow-Origin: *`, so the browser can `fetch()` them directly
as blobs — no proxy/backend needed.

- "Web" quality: `q_auto:best/f_jpg/c_limit,w_{2400|1200|300}` (JPG, resized)
- "Original" quality: no transform params at all -> original uploaded PNG
  (full resolution, alpha channel)
- 360 frames: `360/{case_id}-{bracelet_id}/{case_id}-{bracelet_id}--{NNN}`,
  always 250 frames (000-249), JPG only. "64 frames" mode samples 64 evenly
  spaced indices from the 250.

Angle paths live in `ANGLES` in `app.js`. The Cloudinary asset hash
(`a677b2c664f6`) and base path (`catalogue/2026/...`) are hardcoded — they
change when Rolex ships a new catalog season, so if lookups start 404ing,
re-check those against a live page.

### Breitling
Image URLs are stored directly in `breitling_catalog.json` (fetched at build
time). The browser loads them as plain `<img src>` — no fetch/ZIP for
Breitling, users right-click to save individually.

## Updating the catalog

Both build scripts support **resume**: if interrupted, re-running skips already
fetched entries. Both require Playwright (`pip install playwright &&
playwright install chromium`).

### Rolex (two steps)

```bash
# Step 1 — refresh the source CSV (needs Playwright to bypass Akamai)
python3 ../download_catalog.py          # run from RolexMSRP/, outputs rolex_catalog.csv

# Step 2 — build the JSON (fetches specs from Rolex API, also needs Playwright)
python3 scripts/build_data.py           # run from web/, outputs data/rolex_catalog.json
```

### Breitling (one step)

```bash
# Fetches SKUs from sitemap, calls Breitling API, writes JSON directly
python3 scripts/build_breitling.py      # run from web/, outputs data/breitling_catalog.json
```

## Local dev

No build step — just serve the directory:

```
python3 -m http.server 8765
```

## Remotes

Pushed to both:
- `origin` -> aswincnyc777/rolex-photo-downloader
- `personal` -> KevinWuD/rolex-photo-downloader

Commits use `wu.haoran2002@gmail.com` for contribution tracking.
