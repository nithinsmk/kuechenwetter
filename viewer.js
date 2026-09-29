import {
  SCAN_DIR, listScans, kindOf, nameOf, isSplatFile, createStage, describe, progressText,
} from './scan.js';

const nav = document.getElementById('scans');
const info = document.getElementById('info');
const statusEl = document.getElementById('status');
const hint = document.getElementById('hint');
const drop = document.getElementById('drop');

const stage = createStage(document.getElementById('stage'));

function setStatus(text) {
  statusEl.textContent = text || '';
  statusEl.hidden = !text;
}

async function show(source, label) {
  setStatus(`loading ${label}`);
  info.textContent = '';
  try {
    const object = await stage.show(source, (loaded, total) => setStatus(`loading ${label} · ${progressText(loaded, total)}`));
    if (!object) return; // a newer load took over
    info.textContent = `${kindOf(source.name)} · ${describe(object)}`;
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus(`couldn't load ${label}`);
  }
}

// --- scan list: scans/scans.json holds the file names, in the order to show them ---

let scans = [];

function markCurrent(name) {
  for (const button of nav.querySelectorAll('button')) {
    button.setAttribute('aria-current', String(button.dataset.name === name));
  }
}

function showFromHash() {
  const wanted = decodeURIComponent(location.hash.slice(1));
  const file = scans.find((f) => nameOf(f) === wanted) || scans[0];
  if (!file) return setStatus('no scans yet · drop a .glb or .ply here to view one');
  markCurrent(nameOf(file));
  show({ url: SCAN_DIR + encodeURIComponent(file), name: file }, nameOf(file));
}

async function init() {
  scans = await listScans();
  for (const file of scans) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${nameOf(file)} · ${kindOf(file)}`;
    button.dataset.name = nameOf(file);
    button.addEventListener('click', () => { location.hash = encodeURIComponent(nameOf(file)); });
    nav.appendChild(button);
  }
  window.addEventListener('hashchange', showFromHash);
  showFromHash();
}

// --- controls hint and reset ---

hint.textContent = window.matchMedia('(pointer: coarse)').matches
  ? 'drag to turn · pinch to zoom · two fingers to move'
  : 'drag to turn · scroll to zoom · right-drag to move';

document.getElementById('reset').addEventListener('click', () => stage.reset());

// --- drop a local .glb, .ply or .spz onto the page to look at it (not saved anywhere) ---

let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; drop.hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.hidden = true; } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  drop.hidden = true;
  const file = [...e.dataTransfer.files].find((f) => /\.glb$/i.test(f.name) || isSplatFile(f.name));
  if (!file) return setStatus('drop a .glb, .ply or .spz file');
  markCurrent(null);
  show({ url: URL.createObjectURL(file), name: file.name }, `${file.name} (local)`);
});

init();
