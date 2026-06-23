// ── CDN / URL helpers ────────────────────────────────────────────────────────

// Rolex
const CDN_BASE    = 'https://media.rolex.com/image/upload';
const HASH        = 'a677b2c664f6';

// Tudor
const TUDOR_CDN  = 'https://media.tudorwatch.com/image/upload';
const TUDOR_HASH = '0yi5ee8b69yh3';
const STATIC_WIDTH = 2400;
const FRAME_WIDTH  = 1200;
const THUMB_WIDTH  = 300;

const ANGLES = {
  main:          'upright-c/{rmc}',
  upright_shadow:'upright-bba-with-shadow/{rmc}',
  showcase:      'showcase/{rmc}',
  bezel:         'bezel-constant-size-with-shadow/{rmc}',
  dial:          'raw-dial-constant-size-with-shadow/{rmc}',
};

function tudorUrl(ref, angle, quality) {
  const path = `v1/catalogue/${TUDOR_HASH}/${angle}/tudor-${ref}`;
  if (quality === 'web') return `${TUDOR_CDN}/q_auto:best/f_jpg/c_limit,w_2400/${path}`;
  return `${TUDOR_CDN}/${path}`;
}
function tudorThumbUrl(ref, angle) {
  return `${TUDOR_CDN}/q_auto:best/f_jpg/c_limit,w_300/v1/catalogue/${TUDOR_HASH}/${angle}/tudor-${ref}`;
}
function tudorExtraUrl(path, quality) {
  if (quality === 'web') return `${TUDOR_CDN}/q_auto:best/f_jpg/c_limit,w_2400/v1/${path}`;
  if (quality === 'thumb') return `${TUDOR_CDN}/q_auto:best/f_jpg/c_limit,w_300/v1/${path}`;
  return `${TUDOR_CDN}/v1/${path}`;
}

function thumbUrl(path) {
  return `${CDN_BASE}/q_auto:best/f_jpg/c_limit,w_${THUMB_WIDTH}/v1/${HASH}/catalogue/2026/${path}`;
}
function staticUrl(path, quality) {
  if (quality === 'original') return `${CDN_BASE}/v1/${HASH}/catalogue/2026/${path}`;
  return `${CDN_BASE}/q_auto:best/f_jpg/c_limit,w_${STATIC_WIDTH}/v1/${HASH}/catalogue/2026/${path}`;
}
function frameUrl(path) {
  return `${CDN_BASE}/q_auto:best/f_jpg/c_limit,w_${FRAME_WIDTH}/v1/${HASH}/catalogue/2026/${path}`;
}

// ── State ─────────────────────────────────────────────────────────────────────

let brand    = 'rolex';
let catalogs = { rolex: null, breitling: null, tudor: null, omega: null };
let current  = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────

const els = {
  form:          document.getElementById('searchForm'),
  input:         document.getElementById('refInput'),
  status:        document.getElementById('status'),
  variants:      document.getElementById('variants'),
  detail:        document.getElementById('detail'),
  previewImg:    document.getElementById('previewImg'),
  thumbs:        document.getElementById('thumbs'),
  detailTitle:   document.getElementById('detailTitle'),
  detailCase:    document.getElementById('detailCase'),
  specs:         document.getElementById('specs'),
  opt360Group:   document.getElementById('opt360Group'),
  downloadBtn:   document.getElementById('downloadBtn'),
  progress:      document.getElementById('progress'),
  progressFill:  document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),
  breitlingImages:   document.getElementById('breitlingImages'),
  omegaImages:       document.getElementById('omegaImages'),
  tudorPreviewImg:   document.getElementById('tudorPreviewImg'),
  tudorThumbs:       document.getElementById('tudorThumbs'),
  tudorDownloadBtn:  document.getElementById('tudorDownloadBtn'),
  tudorProgress:     document.getElementById('tudorProgress'),
  tudorProgressFill: document.getElementById('tudorProgressFill'),
  tudorProgressLabel:document.getElementById('tudorProgressLabel'),
};

// ── Spec config ───────────────────────────────────────────────────────────────

const ROLEX_SPEC_SECTIONS = [
  { label: 'Case',     keys: ['case_diameter','case_material','bezel','water_resistance','crystal','crown'] },
  { label: 'Movement', keys: ['movement','calibre','certification','power_reserve','precision','functions','oscillator'] },
  { label: 'Dial',     keys: ['dial','dial_details'] },
  { label: 'Bracelet', keys: ['bracelet','bracelet_material','clasp'] },
];
const ROLEX_SPEC_LABELS = {
  case_diameter:'Diameter', case_material:'Material', bezel:'Bezel',
  water_resistance:'Water resistance', crystal:'Crystal', crown:'Crown',
  movement:'Type', calibre:'Calibre', certification:'Certification',
  power_reserve:'Power reserve', precision:'Precision', functions:'Functions',
  oscillator:'Oscillator', dial:'Dial', dial_details:'Details',
  bracelet:'Bracelet', bracelet_material:'Material', clasp:'Clasp',
};

const OMEGA_SPEC_SECTIONS = [
  { label: 'Movement', keys: ['caliber','movement_type','power_reserve'] },
  { label: 'Case',     keys: ['reference','case_diameter','thickness','between_lugs','lug_to_lug','case','water_resistance','crystal','total_product_weight_(approx.)'] },
  { label: 'Dial',     keys: ['dial_color'] },
  { label: 'Bracelet', keys: ['bracelet','clasp'] },
];
const OMEGA_SPEC_LABELS = {
  caliber:'Calibre', movement_type:'Type', power_reserve:'Power reserve',
  reference:'Reference', case_diameter:'Diameter', thickness:'Thickness',
  between_lugs:'Between lugs', lug_to_lug:'Lug-to-lug', case:'Case material',
  water_resistance:'Water resistance', crystal:'Crystal',
  'total_product_weight_(approx.)':'Weight',
  dial_color:'Dial color', bracelet:'Bracelet', clasp:'Clasp',
};

const TUDOR_SPEC_SECTIONS = [
  { label: 'Movement', keys: ['movement', 'power_reserve'] },
  { label: 'Case',     keys: ['case', 'waterproofness', 'crystal', 'bezel', 'winding_crown'] },
  { label: 'Dial',     keys: ['dial'] },
  { label: 'Bracelet', keys: ['bracelet'] },
];
const TUDOR_SPEC_LABELS = {
  movement: 'Type', power_reserve: 'Power reserve',
  case: 'Case', waterproofness: 'Water resistance', crystal: 'Crystal',
  bezel: 'Bezel', winding_crown: 'Crown',
  dial: 'Dial',
  bracelet: 'Bracelet',
};

const BREITLING_SPEC_SECTIONS = [
  { label: 'Movement', keys: ['movement','caliber','power_reserve','vibration','jewels','chronograph'] },
  { label: 'Case',     keys: ['diameter','case_material','water_resistance','crystal'] },
  { label: 'Dial',     keys: ['dial_color'] },
  { label: 'Strap',    keys: ['strap_material','strap_color','buckle_type','buckle_material','lug_width'] },
];
const BREITLING_SPEC_LABELS = {
  movement:'Type', caliber:'Calibre', power_reserve:'Power reserve',
  vibration:'Frequency', jewels:'Jewels', chronograph:'Chronograph',
  diameter:'Diameter', case_material:'Material', water_resistance:'Water resistance',
  crystal:'Crystal', dial_color:'Dial', strap_material:'Strap material',
  strap_color:'Strap color', buckle_type:'Buckle', buckle_material:'Buckle material',
  lug_width:'Lug width',
};

// ── Tab switching ─────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchBrand(tab.dataset.brand));
});

async function switchBrand(b) {
  brand = b;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.brand === b));
  document.body.className = `brand-${b}`;
  els.input.placeholder = 'Search by reference number or model name';
  resetSearch();
  await loadCatalog(b);
  els.status.textContent = `Ready — ${brandTotal(b)} watches loaded.`;
}

function resetSearch() {
  els.input.value = '';
  els.variants.classList.add('hidden');
  els.variants.innerHTML = '';
  els.detail.classList.add('hidden');
  els.status.textContent = '';
  els.status.classList.remove('error');
}

// ── Catalog loading ───────────────────────────────────────────────────────────

async function loadCatalog(b) {
  if (catalogs[b]) return;
  const file = b === 'rolex' ? 'data/rolex_catalog.json'
    : b === 'breitling' ? 'data/breitling_catalog.json'
    : b === 'tudor' ? 'data/tudor_catalog.json'
    : 'data/omega_catalog.json';
  const res  = await fetch(file);
  catalogs[b] = await res.json();
}

function brandTotal(b) {
  if (!catalogs[b]) return 0;
  if (b === 'rolex') return Object.values(catalogs.rolex).reduce((s, l) => s + l.length, 0);
  return Object.keys(catalogs[b]).length;
}

function normalizeRef(raw) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

// ── Search ────────────────────────────────────────────────────────────────────

function onSearch(e) {
  e.preventDefault();
  els.variants.classList.add('hidden');
  els.detail.classList.add('hidden');
  els.status.classList.remove('error');
  els.variants.innerHTML = '';

  const q = normalizeRef(els.input.value);
  if (!q) return;

  if (brand === 'rolex') searchRolex(q);
  else if (brand === 'breitling') searchBreitling(q);
  else if (brand === 'tudor') searchTudor(q);
  else searchOmega(q);
}

function searchRolex(q) {
  // Try exact ref lookup first
  const list = catalogs.rolex[q];
  if (list) {
    if (list.length === 1) { els.status.textContent = ''; selectRolexVariant(list[0]); return; }
    els.status.textContent = `${list.length} variants — pick one:`;
    showPicker(list, selectRolexVariant, rolexPickerCard);
    return;
  }
  // Fall back to family name search
  const qn = q.replace(/\s+/g, '');
  const matches = Object.values(catalogs.rolex).flat().filter(v =>
    v.family.toUpperCase().replace(/\s+/g, '').includes(qn) ||
    v.rmc.toUpperCase().replace(/\s+/g, '').includes(qn)
  );
  if (!matches.length) {
    els.status.textContent = `No match for "${q}".`;
    els.status.classList.add('error');
    return;
  }
  if (matches.length === 1) { els.status.textContent = ''; selectRolexVariant(matches[0]); return; }
  els.status.textContent = `${matches.length} variants — pick one:`;
  showPicker(matches, selectRolexVariant, rolexPickerCard);
}

function rolexPickerCard(v) {
  return `
    <img class="vthumb" src="${thumbUrl(`upright-c/${v.rmc}`)}" alt="${v.rmc}" />
    <span class="vtitle">${v.family}</span>
    <span class="vrmc">${v.rmc}</span>
  `;
}

function searchBreitling(q) {
  const qn = q.replace(/\s+/g, '');
  const all = Object.values(catalogs.breitling);
  const matches = all.filter(p =>
    p.sku.replace(/\s+/g, '').includes(qn) ||
    p.collection.toUpperCase().replace(/\s+/g, '').includes(qn) ||
    p.name.toUpperCase().replace(/\s+/g, '').includes(qn)
  );
  if (!matches.length) {
    els.status.textContent = `No match for "${q}".`;
    els.status.classList.add('error');
    return;
  }
  if (matches.length === 1) { els.status.textContent = ''; selectBreitlingProduct(matches[0]); return; }
  els.status.textContent = `${matches.length} results — pick one:`;
  showPicker(matches, selectBreitlingProduct, p => `
    <img class="vthumb" src="${(p.images[0] || {}).url || ''}" alt="${p.sku}" />
    <span class="vtitle">${p.collection}</span>
    <span class="vrmc">${p.sku}</span>
  `);
}

function showPicker(items, onSelect, renderFn) {
  els.variants.classList.remove('hidden');
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = renderFn(item);
    card.addEventListener('click', () => { els.variants.classList.add('hidden'); onSelect(item); });
    els.variants.appendChild(card);
  }
}

// ── Rolex detail ──────────────────────────────────────────────────────────────

function selectRolexVariant(v) {
  current = v;
  els.detail.classList.remove('hidden');

  const mainPath = ANGLES.main.replace('{rmc}', v.rmc);
  els.previewImg.src    = thumbUrl(mainPath);
  els.previewImg.title  = 'main — click to download';
  els.previewImg.onclick = () => downloadSingle(v, 'main', mainPath);

  els.detailTitle.textContent = v.family;
  els.detailCase.textContent  = v.rmc;

  els.thumbs.innerHTML = '';
  for (const [name, template] of Object.entries(ANGLES)) {
    if (name === 'main') continue;
    const path = template.replace('{rmc}', v.rmc);
    const img  = document.createElement('img');
    img.className = 'thumb';
    img.alt   = name;
    img.title = `${name} — click to download`;
    img.src   = thumbUrl(path);
    img.addEventListener('click', () => downloadSingle(v, name, path));
    els.thumbs.appendChild(img);
  }

  if (v.has360) {
    els.opt360Group.classList.remove('hidden');
  } else {
    els.opt360Group.classList.add('hidden');
    document.getElementById('opt360_64').checked  = false;
    document.getElementById('opt360_250').checked = false;
  }

  resetProgress();
  renderSpecs(v.specs, ROLEX_SPEC_SECTIONS, ROLEX_SPEC_LABELS);
}

// ── Breitling detail ──────────────────────────────────────────────────────────

function selectBreitlingProduct(p) {
  current = p;
  els.detail.classList.remove('hidden');
  els.detailTitle.textContent = p.collection;
  els.detailCase.textContent  = p.sku;

  els.breitlingImages.innerHTML = '';
  for (const img of p.images) {
    const el   = document.createElement('img');
    el.src     = img.url;
    el.alt     = img.shot || p.name;
    el.title   = img.shot || '';
    el.className = 'breitling-img';
    els.breitlingImages.appendChild(el);
  }

  renderSpecs(p.specs, BREITLING_SPEC_SECTIONS, BREITLING_SPEC_LABELS);
}

// ── Omega search + detail ────────────────────────────────────────────────────

function searchOmega(q) {
  const qn = q.replace(/\s+/g, '').replace(/\./g, '');
  const all = Object.values(catalogs.omega);
  const matches = all.filter(p =>
    p.ref.replace(/\./g, '').includes(qn) ||
    p.sku.replace(/\./g, '').includes(qn) ||
    p.collection.toUpperCase().replace(/\s+/g, '').includes(qn) ||
    p.name.toUpperCase().replace(/[\s.]/g, '').includes(qn)
  );
  if (!matches.length) {
    els.status.textContent = `No match for "${q}".`;
    els.status.classList.add('error');
    return;
  }
  if (matches.length === 1) { els.status.textContent = ''; selectOmegaProduct(matches[0]); return; }
  els.status.textContent = `${matches.length} results — pick one:`;
  showPicker(matches, selectOmegaProduct, p => `
    <img class="vthumb" src="${(p.images[0] || '').replace('.png', '.png?w=100')}" alt="${p.ref}" />
    <span class="vtitle">${p.collection}</span>
    <span class="vrmc">${p.sku}</span>
  `);
}

function selectOmegaProduct(p) {
  current = p;
  els.detail.classList.remove('hidden');
  els.detailTitle.textContent = p.collection;
  els.detailCase.textContent  = p.sku;

  els.omegaImages.innerHTML = '';
  for (const url of p.images) {
    const img = document.createElement('img');
    img.src       = url + '?w=500';
    img.alt       = p.name;
    img.title     = p.name;
    img.className = 'breitling-img';
    els.omegaImages.appendChild(img);
  }

  renderSpecs(p.specs, OMEGA_SPEC_SECTIONS, OMEGA_SPEC_LABELS);
}

// ── Tudor search + detail + download ─────────────────────────────────────────

function searchTudor(q) {
  const qn = q.replace(/\s+/g, '');
  const all = Object.values(catalogs.tudor);
  const matches = all.filter(p =>
    p.ref.toUpperCase().replace(/\s+/g, '').includes(qn) ||
    p.collection.toUpperCase().replace(/\s+/g, '').includes(qn) ||
    p.name.toUpperCase().replace(/\s+/g, '').includes(qn)
  );
  if (!matches.length) {
    els.status.textContent = `No match for "${q}".`;
    els.status.classList.add('error');
    return;
  }
  if (matches.length === 1) { els.status.textContent = ''; selectTudorWatch(matches[0]); return; }
  els.status.textContent = `${matches.length} results — pick one:`;
  showPicker(matches, selectTudorWatch, p => `
    <img class="vthumb" src="${tudorThumbUrl(p.ref, p.angles[0])}" alt="${p.ref}" />
    <span class="vtitle">${p.collection}</span>
    <span class="vrmc">${p.ref}</span>
  `);
}

function selectTudorWatch(watch) {
  current = watch;
  els.detail.classList.remove('hidden');
  els.detailTitle.textContent = watch.collection;
  els.detailCase.textContent  = watch.ref;

  const [mainAngle, ...restAngles] = watch.angles;
  els.tudorPreviewImg.src    = tudorThumbUrl(watch.ref, mainAngle);
  els.tudorPreviewImg.title  = `${mainAngle} — click to download`;
  els.tudorPreviewImg.onclick = () => downloadTudorSingle(watch, mainAngle);

  els.tudorThumbs.innerHTML = '';
  for (const angle of restAngles) {
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src   = tudorThumbUrl(watch.ref, angle);
    img.alt   = angle;
    img.title = `${angle} — click to download`;
    img.addEventListener('click', () => downloadTudorSingle(watch, angle));
    els.tudorThumbs.appendChild(img);
  }
  for (const path of (watch.extras || [])) {
    const label = path.split('/').at(-2); // wrist / beautyshots / ambiance
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src   = tudorExtraUrl(path, 'thumb');
    img.alt   = label;
    img.title = `${label} — click to download`;
    img.addEventListener('click', () => downloadTudorExtra(watch, path, label));
    els.tudorThumbs.appendChild(img);
  }

  resetTudorProgress();
  renderSpecs(watch.specs, TUDOR_SPEC_SECTIONS, TUDOR_SPEC_LABELS);
}

function resetTudorProgress() {
  els.tudorProgress.classList.add('hidden');
  els.tudorProgressFill.style.width = '0%';
  els.tudorProgressLabel.textContent = '';
  els.tudorDownloadBtn.disabled = false;
  els.tudorDownloadBtn.textContent = 'Download ZIP';
}

async function downloadTudorSingle(watch, angle) {
  try {
    const res = await fetch(tudorUrl(watch.ref, angle, 'web'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    saveAs(await res.blob(), `${watch.ref}_${angle}.jpg`);
  } catch (err) {
    els.status.textContent = `Failed: ${err.message}`;
    els.status.classList.add('error');
  }
}

async function downloadTudorExtra(watch, path, label) {
  try {
    const res = await fetch(tudorExtraUrl(path, 'web'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    saveAs(await res.blob(), `${watch.ref}_${label}.jpg`);
  } catch (err) {
    els.status.textContent = `Failed: ${err.message}`;
    els.status.classList.add('error');
  }
}

function buildTudorJobs(watch) {
  const jobs = [];
  if (document.getElementById('tudorOptWeb').checked) {
    for (const angle of watch.angles)
      jobs.push({ url: tudorUrl(watch.ref, angle, 'web'), zipPath: `web/${angle}.jpg` });
    for (const path of (watch.extras || [])) {
      const label = path.split('/').at(-2);
      jobs.push({ url: tudorExtraUrl(path, 'web'), zipPath: `web/${label}.jpg` });
    }
  }
  if (document.getElementById('tudorOptOrig').checked) {
    for (const angle of watch.angles)
      jobs.push({ url: tudorUrl(watch.ref, angle, 'original'), zipPath: `original/${angle}.png` });
    for (const path of (watch.extras || [])) {
      const label = path.split('/').at(-2);
      jobs.push({ url: tudorExtraUrl(path, 'original'), zipPath: `original/${label}.png` });
    }
  }
  return jobs;
}

async function onTudorDownload() {
  if (!current || brand !== 'tudor') return;
  const jobs = buildTudorJobs(current);
  if (!jobs.length) {
    els.status.textContent = 'Select at least one option.';
    els.status.classList.add('error');
    return;
  }
  els.tudorDownloadBtn.disabled = true;
  els.tudorDownloadBtn.textContent = 'Downloading…';
  els.tudorProgress.classList.remove('hidden');
  els.tudorProgressLabel.textContent = `0 / ${jobs.length}`;

  const results = await fetchWithLimit(jobs, 8, (done, total) => {
    els.tudorProgressFill.style.width = `${Math.round((done / total) * 100)}%`;
    els.tudorProgressLabel.textContent = `${done} / ${total}`;
  });

  els.tudorDownloadBtn.textContent = 'Zipping…';
  const zip = new JSZip();
  let failed = 0;
  for (const r of results) r.blob ? zip.file(r.zipPath, r.blob) : failed++;

  saveAs(await zip.generateAsync({ type: 'blob' }), `${current.ref}.zip`);
  els.tudorDownloadBtn.disabled = false;
  els.tudorDownloadBtn.textContent = 'Download ZIP';
  els.tudorProgressLabel.textContent = failed ? `Done — ${failed} file(s) failed.` : 'Done.';
}

// ── Specs ─────────────────────────────────────────────────────────────────────

function renderSpecs(specs, sections, labels) {
  if (!specs || !Object.keys(specs).length) { els.specs.classList.add('hidden'); return; }
  let html = '';
  for (const section of sections) {
    const rows = section.keys.map(k => [labels[k], specs[k]]).filter(([, v]) => v);
    if (!rows.length) continue;
    html += `<div class="specs-section"><div class="specs-heading">${section.label}</div>`;
    for (const [label, val] of rows)
      html += `<div class="specs-row"><span class="specs-label">${label}</span><span class="specs-val">${val}</span></div>`;
    html += '</div>';
  }
  els.specs.innerHTML = html;
  els.specs.classList.remove('hidden');
}

// ── Rolex download ────────────────────────────────────────────────────────────

function resetProgress() {
  els.progress.classList.add('hidden');
  els.progressFill.style.width = '0%';
  els.progressLabel.textContent = '';
  els.downloadBtn.disabled = false;
  els.downloadBtn.textContent = 'Download ZIP';
}

function buildJobs(v) {
  const jobs = [];
  if (document.getElementById('optStaticWeb').checked) {
    for (const [name, template] of Object.entries(ANGLES)) {
      const path = template.replace('{rmc}', v.rmc);
      jobs.push({ url: staticUrl(path, 'web'), zipPath: `web/${name}.jpg` });
    }
  }
  if (document.getElementById('optStaticOrig').checked) {
    for (const [name, template] of Object.entries(ANGLES)) {
      const path = template.replace('{rmc}', v.rmc);
      jobs.push({ url: staticUrl(path, 'original'), zipPath: `original/${name}.png` });
    }
  }
  if (v.has360 && document.getElementById('opt360_64').checked) {
    const key = `${v.case_id}-${v.bracelet_id}`;
    for (const frame of sample64(v.n360)) {
      const idx = String(frame).padStart(3, '0');
      jobs.push({ url: frameUrl(`360/${key}/${key}--${idx}`), zipPath: `360_64/${idx}.jpg` });
    }
  }
  if (v.has360 && document.getElementById('opt360_250').checked) {
    const key = `${v.case_id}-${v.bracelet_id}`;
    for (const frame of range(v.n360)) {
      const idx = String(frame).padStart(3, '0');
      jobs.push({ url: frameUrl(`360/${key}/${key}--${idx}`), zipPath: `360_all/${idx}.jpg` });
    }
  }
  return jobs;
}

function range(n) { return Array.from({ length: n }, (_, i) => i); }
function sample64(n360) {
  return Array.from({ length: 64 }, (_, i) => Math.round((i * (n360 - 1)) / 63));
}

async function downloadSingle(v, name, path) {
  try {
    const res = await fetch(staticUrl(path, 'web'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    saveAs(await res.blob(), `${v.rmc}_${name}.jpg`);
  } catch (err) {
    els.status.textContent = `Failed to download ${name}: ${err.message}`;
    els.status.classList.add('error');
  }
}

async function fetchWithLimit(jobs, concurrency, onProgress) {
  const results = new Array(jobs.length);
  let next = 0, done = 0;
  async function worker() {
    while (next < jobs.length) {
      const i = next++, job = jobs[i];
      try {
        const res = await fetch(job.url);
        results[i] = { ...job, blob: res.ok ? await res.blob() : null };
      } catch { results[i] = { ...job, blob: null }; }
      onProgress(++done, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

async function onDownload() {
  if (!current || brand !== 'rolex') return;
  const jobs = buildJobs(current);
  if (!jobs.length) {
    els.status.textContent = 'Select at least one option.';
    els.status.classList.add('error');
    return;
  }
  els.downloadBtn.disabled = true;
  els.downloadBtn.textContent = 'Downloading…';
  els.progress.classList.remove('hidden');
  els.progressLabel.textContent = `0 / ${jobs.length}`;

  const results = await fetchWithLimit(jobs, 8, (done, total) => {
    els.progressFill.style.width = `${Math.round((done / total) * 100)}%`;
    els.progressLabel.textContent = `${done} / ${total}`;
  });

  els.downloadBtn.textContent = 'Zipping…';
  const zip = new JSZip();
  let failed = 0;
  for (const r of results) r.blob ? zip.file(r.zipPath, r.blob) : failed++;

  saveAs(await zip.generateAsync({ type: 'blob' }), `${current.rmc}.zip`);
  els.downloadBtn.disabled = false;
  els.downloadBtn.textContent = 'Download ZIP';
  els.progressLabel.textContent = failed ? `Done — ${failed} file(s) failed.` : 'Done.';
}

// ── Init ──────────────────────────────────────────────────────────────────────

els.form.addEventListener('submit', onSearch);
els.downloadBtn.addEventListener('click', onDownload);
els.tudorDownloadBtn.addEventListener('click', onTudorDownload);

loadCatalog('rolex').then(() => {
  els.status.textContent = `Ready — ${brandTotal('rolex')} watches loaded.`;
});
