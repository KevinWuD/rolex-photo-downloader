const CDN_BASE = 'https://media.rolex.com/image/upload';
const HASH = 'a677b2c664f6';
const STATIC_WIDTH = 2400;
const FRAME_WIDTH = 1200;
const THUMB_WIDTH = 300;

// angle -> CDN path template (relative to catalogue/2026/, {rmc} placeholder)
const ANGLES = {
  main: 'upright-c/{rmc}',
  upright_shadow: 'upright-bba-with-shadow/{rmc}',
  showcase: 'showcase/{rmc}',
  bezel: 'bezel-constant-size-with-shadow/{rmc}',
  dial: 'raw-dial-constant-size-with-shadow/{rmc}',
};

let catalog = null;
let current = null; // currently selected variant

const els = {
  form: document.getElementById('searchForm'),
  input: document.getElementById('refInput'),
  status: document.getElementById('status'),
  variants: document.getElementById('variants'),
  detail: document.getElementById('detail'),
  previewImg: document.getElementById('previewImg'),
  thumbs: document.getElementById('thumbs'),
  detailTitle: document.getElementById('detailTitle'),
  detailCase: document.getElementById('detailCase'),
  specs: document.getElementById('specs'),
  opt360Group: document.getElementById('opt360Group'),
  downloadBtn: document.getElementById('downloadBtn'),
  progress: document.getElementById('progress'),
  progressFill: document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),
};

const SPEC_SECTIONS = [
  {
    label: 'Case',
    keys: ['case_diameter', 'case_material', 'bezel', 'water_resistance', 'crystal', 'crown'],
  },
  {
    label: 'Movement',
    keys: ['movement', 'calibre', 'certification', 'power_reserve', 'precision', 'functions', 'oscillator'],
  },
  { label: 'Dial',     keys: ['dial', 'dial_details'] },
  { label: 'Bracelet', keys: ['bracelet', 'bracelet_material', 'clasp'] },
];

const SPEC_LABELS = {
  case_diameter:     'Diameter',
  case_material:     'Material',
  bezel:             'Bezel',
  water_resistance:  'Water resistance',
  crystal:           'Crystal',
  crown:             'Crown',
  movement:          'Type',
  calibre:           'Calibre',
  certification:     'Certification',
  power_reserve:     'Power reserve',
  precision:         'Precision',
  functions:         'Functions',
  oscillator:        'Oscillator',
  dial:              'Dial',
  dial_details:      'Details',
  bracelet:          'Bracelet',
  bracelet_material: 'Material',
  clasp:             'Clasp',
};

function renderSpecs(v) {
  const s = v.specs;
  if (!s || Object.keys(s).length === 0) {
    els.specs.classList.add('hidden');
    return;
  }
  let html = '';
  for (const section of SPEC_SECTIONS) {
    const rows = section.keys
      .map(k => [SPEC_LABELS[k], s[k]])
      .filter(([, val]) => val);
    if (!rows.length) continue;
    html += `<div class="specs-section"><div class="specs-heading">${section.label}</div>`;
    for (const [label, val] of rows) {
      html += `<div class="specs-row"><span class="specs-label">${label}</span><span class="specs-val">${val}</span></div>`;
    }
    html += '</div>';
  }
  els.specs.innerHTML = html;
  els.specs.classList.remove('hidden');
}

function thumbUrl(path) {
  return `${CDN_BASE}/q_auto:best/f_jpg/c_limit,w_${THUMB_WIDTH}/v1/${HASH}/catalogue/2026/${path}`;
}

function staticUrl(path, quality) {
  if (quality === 'original') {
    return `${CDN_BASE}/v1/${HASH}/catalogue/2026/${path}`;
  }
  return `${CDN_BASE}/q_auto:best/f_jpg/c_limit,w_${STATIC_WIDTH}/v1/${HASH}/catalogue/2026/${path}`;
}

function frameUrl(path) {
  return `${CDN_BASE}/q_auto:best/f_jpg/c_limit,w_${FRAME_WIDTH}/v1/${HASH}/catalogue/2026/${path}`;
}

async function loadCatalog() {
  const res = await fetch('data/catalog.json');
  catalog = await res.json();
}

function normalizeRef(raw) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function onSearch(e) {
  e.preventDefault();
  els.variants.classList.add('hidden');
  els.detail.classList.add('hidden');
  els.status.classList.remove('error');
  els.variants.innerHTML = '';

  const ref = normalizeRef(els.input.value);
  if (!ref) return;

  const list = catalog[ref];
  if (!list) {
    els.status.textContent = `No match for "${ref}".`;
    els.status.classList.add('error');
    return;
  }

  if (list.length === 1) {
    els.status.textContent = '';
    selectVariant(list[0]);
    return;
  }

  els.status.textContent = `${list.length} variants found — pick one:`;
  els.variants.classList.remove('hidden');
  for (const v of list) {
    const card = document.createElement('div');
    card.className = 'variant-card';
    card.innerHTML = `
      <img class="vthumb" src="${thumbUrl(`upright-c/${v.rmc}`)}" alt="${v.rmc}" />
      <span class="vtitle">${v.family}</span>
      <span class="vrmc">${v.rmc}</span>
    `;
    card.addEventListener('click', () => selectVariant(v));
    els.variants.appendChild(card);
  }
}

function selectVariant(v) {
  current = v;
  els.status.textContent = '';
  els.variants.classList.add('hidden');
  els.detail.classList.remove('hidden');

  const mainPath = ANGLES.main.replace('{rmc}', v.rmc);
  els.previewImg.src = thumbUrl(mainPath);
  els.previewImg.title = 'main — click to download';
  els.previewImg.onclick = () => downloadSingle(v, 'main', mainPath);
  els.detailTitle.textContent = v.family;
  els.detailCase.textContent = v.rmc;
  renderSpecs(v);

  els.thumbs.innerHTML = '';
  for (const [name, template] of Object.entries(ANGLES)) {
    if (name === 'main') continue;
    const path = template.replace('{rmc}', v.rmc);
    const img = document.createElement('img');
    img.className = 'thumb';
    img.alt = name;
    img.title = `${name} — click to download`;
    img.src = thumbUrl(path);
    img.addEventListener('click', () => downloadSingle(v, name, path));
    els.thumbs.appendChild(img);
  }

  if (v.has360) {
    els.opt360Group.classList.remove('hidden');
  } else {
    els.opt360Group.classList.add('hidden');
    document.getElementById('opt360_64').checked = false;
    document.getElementById('opt360_250').checked = false;
  }

  resetProgress();
}

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

function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}

// Evenly sample 64 frames across n360 (matches the original 360_64 turntable preview).
function sample64(n360) {
  return Array.from({ length: 64 }, (_, i) => Math.round((i * (n360 - 1)) / 63));
}

async function downloadSingle(v, name, path) {
  try {
    const res = await fetch(staticUrl(path, 'web'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    saveAs(blob, `${v.rmc}_${name}.jpg`);
  } catch (err) {
    els.status.textContent = `Failed to download ${name}: ${err.message}`;
    els.status.classList.add('error');
  }
}

async function fetchWithLimit(jobs, concurrency, onProgress) {
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      const job = jobs[i];
      try {
        const res = await fetch(job.url);
        if (res.ok) {
          results[i] = { ...job, blob: await res.blob() };
        } else {
          results[i] = { ...job, blob: null };
        }
      } catch {
        results[i] = { ...job, blob: null };
      }
      done++;
      onProgress(done, jobs.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function onDownload() {
  if (!current) return;
  const jobs = buildJobs(current);
  if (jobs.length === 0) {
    els.status.textContent = 'Select at least one option.';
    els.status.classList.add('error');
    return;
  }

  els.downloadBtn.disabled = true;
  els.downloadBtn.textContent = 'Downloading…';
  els.progress.classList.remove('hidden');
  els.progressLabel.textContent = `0 / ${jobs.length}`;

  const results = await fetchWithLimit(jobs, 8, (done, total) => {
    const pct = Math.round((done / total) * 100);
    els.progressFill.style.width = `${pct}%`;
    els.progressLabel.textContent = `${done} / ${total}`;
  });

  els.downloadBtn.textContent = 'Zipping…';
  const zip = new JSZip();
  let failed = 0;
  for (const r of results) {
    if (r.blob) {
      zip.file(r.zipPath, r.blob);
    } else {
      failed++;
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${current.rmc}.zip`);

  els.downloadBtn.disabled = false;
  els.downloadBtn.textContent = 'Download ZIP';
  els.progressLabel.textContent = failed
    ? `Done — ${failed} file(s) failed and were skipped.`
    : 'Done.';
}

els.form.addEventListener('submit', onSearch);
els.downloadBtn.addEventListener('click', onDownload);

loadCatalog().then(() => {
  const total = Object.values(catalog).reduce((sum, list) => sum + list.length, 0);
  els.status.textContent = `Ready — ${total} watches loaded.`;
});
