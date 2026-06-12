# Rolex Photo Downloader

Static, client-side tool: enter a Rolex reference number and download a
zipped set of catalog photos (multiple angles + 360° turntable frames)
straight from Rolex's media CDN.

No backend — everything runs in the browser. `data/catalog.json` is a
pre-built lookup table (reference number -> image identifiers) generated
offline by `scripts/build_data.py` from the Rolex catalog API.
