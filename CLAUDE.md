# Watch Photo Downloader

Pure static site (HTML/CSS/JS, no build step, no backend). Supports multiple
watch brands via tabs. User searches by reference/SKU, picks a variant, and
downloads catalog photos as a ZIP (or individually by clicking an image).

Currently supported brands: **Rolex**, **Breitling**, **Tudor**, **Omega**.

## Files

- `index.html` — page structure
- `style.css` — light theme
- `app.js` — all logic (catalog lookup, URL building, fetch + JSZip + FileSaver)
- `data/rolex_catalog.json` — Rolex lookup table: reference number -> list of
  variants (`rmc`, `case_id`, `bracelet_id`, `has360`, `n360`, `specs`, etc.)
- `data/breitling_catalog.json` — Breitling lookup table: SKU -> product
  (`sku`, `name`, `collection`, `images`, `specs`)
- `data/tudor_catalog.json` — Tudor lookup table: ref -> product
  (`ref`, `name`, `collection`, `collection_slug`, `angles`, `extras`, `specs`)
- `scripts/build_data.py` — regenerates `data/rolex_catalog.json` from
  `../rolex_catalog.csv` (one level up, in `RolexMSRP/`)
- `scripts/build_breitling.py` — regenerates `data/breitling_catalog.json`
  by scraping Breitling's sitemap + API directly (no intermediate CSV)
- `scripts/build_tudor.py` — regenerates `data/tudor_catalog.json` by
  scraping tudorwatch.com product pages (requires `playwright-stealth`)
- `data/omega_catalog.json` — Omega lookup table: ref (14-digit) -> product
  (`ref`, `sku`, `name`, `collection`, `images`, `specs`)
- `scripts/build_omega.py` — regenerates `data/omega_catalog.json` by
  scraping omegawatches.com product pages (requires `playwright-stealth`)

## UI architecture

Brand switching uses a CSS visibility pattern — no JS show/hide per element:

- `document.body.className = 'brand-rolex'` or `'brand-breitling'`
- Elements with `.rolex-only` are hidden on Breitling and vice versa
- `body.brand-rolex .breitling-only { display: none !important }` in CSS

When adding a new brand: add a tab in `index.html`, a `.brand-X-only` CSS
rule in `style.css`, and handle the search/detail flow in `app.js` following
the same pattern.

## Search

All brands support searching by **ref number** and **collection/family name**.
Input is normalized (uppercased, spaces stripped) before matching, so
"Black Bay 58", "black bay 58", and "BLACKBAY58" all find the same results.
Rolex falls back to name search if the exact ref key isn't found.

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

### Omega
Image URLs are stored in `omega_catalog.json` (fetched at build time) and
loaded as plain `<img src>` — no ZIP download. Omega's Akamai CDN blocks
cross-origin `fetch()` and also blocks programmatic HTTP requests
(`context.request`), so full `page.goto()` is required for the build script.

- Images are on `www.omegawatches.com/media/catalog/product/o/m/{filename}`
- Filenames include the 14-digit ref and a content hash (e.g. `-3ccf4a.png`)
  and cannot be predicted — must be extracted from the page HTML
- Image types: main, `watch-wrist`, `portrait-1` through `portrait-N`, `head-watch`
- Specs come from the "Technical Data" collapsible tab on the product page;
  the build script removes the cookie banner and clicks the tab via JS
- `build_omega.py` needs `playwright-stealth`; supports resume
- Collections: Speedmaster, Seamaster, De Ville, Constellation

### Tudor
Images come from `media.tudorwatch.com` (Cloudinary), which sends
`Access-Control-Allow-Origin: *`, so ZIP download works just like Rolex.

- CDN base: `https://media.tudorwatch.com/image/upload`
- Hash (Cloudinary folder): `0yi5ee8b69yh3` (hardcoded — update if 404s appear)
- **Catalogue angles** (always 3, stored in `angles` array):
  - URL: `v1/catalogue/{HASH}/{angle}/tudor-{ref}`
  - Typical angles: `upright-cb-with-drop-shadow`, `bracelet-c`, `upright-ob`
  - RMC format: `tudor-` prefix + ref (e.g., `tudor-m7939a1a0ru-0001`)
- **Extra images** (optional, ~half of watches, stored in `extras` array):
  - URL: `v1/{path}` where path is e.g. `tudorwatch/model-assets/wrist/tudor-{ref}`
  - Types: `wrist`, `beautyshots`, `ambiance`
- Web quality prefix: `q_auto:best/f_jpg/c_limit,w_2400/`
- Tudor's site has no catalog API — images are server-rendered into HTML.
  `build_tudor.py` uses `playwright-stealth` + `context.request` (fast HTTP,
  no JS rendering) to scrape pages concurrently after a one-time warmup.

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

### Tudor (one step, needs playwright-stealth)

```bash
# Discovers all collections, scrapes each product page for images + specs
python3 scripts/build_tudor.py          # run from web/, outputs data/tudor_catalog.json
```

Tudor's site blocks plain Playwright — `playwright-stealth` is required.
The script supports resume: re-running skips already-fetched entries.
If you add new fields to the catalog schema, delete `tudor_catalog.json`
first to force a full re-fetch.

### Omega (one step, needs playwright-stealth)

```bash
# Discovers all collections, scrapes each product page for images + specs
python3 scripts/build_omega.py          # run from web/, outputs data/omega_catalog.json
```

Omega's site blocks both plain Playwright AND `context.request` — must use
full `page.goto()` (slower than Tudor). `playwright-stealth` is required.
Concurrency is set to 4 to reduce Akamai HTTP2 errors. Supports resume.
If many HTTP2 errors occur mid-run, just re-run — resume will fill the gaps.

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
