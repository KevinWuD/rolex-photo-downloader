# Rolex Photo Downloader

Pure static site (HTML/CSS/JS, no build step, no backend). User enters a
Rolex reference number, picks a variant/quality/360 option, and downloads
catalog photos as a ZIP (or individually by clicking an image).

## Files

- `index.html` — page structure
- `style.css` — light theme
- `app.js` — all logic (catalog lookup, URL building, fetch + JSZip + FileSaver)
- `data/catalog.json` — pre-built lookup table: reference number -> list of
  variants (`rmc`, `case_id`, `bracelet_id`, `has360`, `n360`, etc.)
- `scripts/build_data.py` — regenerates `data/catalog.json` from
  `../rolex_catalog.csv` (one level up, in `RolexMSRP/`)

## How images are fetched

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

## Updating the catalog

1. Re-run `RolexMSRP/download_catalog.py` to refresh `rolex_catalog.csv`
   (needs Playwright — Rolex's catalog API is behind Akamai, so a real
   browser session is required to fetch it).
2. Run `python3 scripts/build_data.py` to regenerate `data/catalog.json`.

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
