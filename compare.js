import {
  SCAN_DIR, listScans, kindOf, nameOf, createStage, describe, boundsOf, frame, setWireframe, progressText,
} from './scan.js';

// One pane per kind: meshes on the left, splats on the right.
function makePane(kind) {
  const el = document.getElementById(kind);
  const stage = createStage(el.querySelector('.view'));
  const statusEl = el.querySelector('.status');
  const status = (text) => { statusEl.textContent = text || ''; statusEl.hidden = !text; };

  async function show(source, label) {
    status(`loading ${label}`);
    el.querySelector('.count').textContent = '';
    try {
      const object = await stage.show(source, (loaded, total) => status(`loading ${label} · ${progressText(loaded, total)}`));
      if (!object) return;
      if (kind === 'mesh') setWireframe(object, wireframe);
      el.querySelector('.count').textContent = ` · ${describe(object)}`;
      status('');
    } catch (error) {
      console.error(error);
      status(`couldn't load ${label}`);
    }
  }

  function list(files) {
    const nav = el.querySelector('nav');
    nav.replaceChildren();
    for (const file of files) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = nameOf(file);
      button.addEventListener('click', () => {
        for (const b of nav.children) b.setAttribute('aria-current', String(b === button));
        show({ url: SCAN_DIR + encodeURIComponent(file), name: file }, nameOf(file));
      });
      nav.appendChild(button);
    }
    nav.firstChild?.click();
  }

  return { el, stage, show, list, status };
}

const meshPane = makePane('mesh');
const splatPane = makePane('splat');

let wireframe = false;
const structureBtn = meshPane.el.querySelector('[data-action="structure"]');
structureBtn.addEventListener('click', () => {
  wireframe = !wireframe;
  setWireframe(meshPane.stage.current, wireframe);
  structureBtn.setAttribute('aria-pressed', String(wireframe));
});

// For splats that come in upside down (Polycam's are turned automatically).
splatPane.el.querySelector('[data-action="flip"]').addEventListener('click', () => {
  const { current, camera, controls } = splatPane.stage;
  if (!current) return;
  current.rotateX(Math.PI);
  frame(camera, controls, boundsOf(current));
});

const scans = await listScans();
meshPane.list(scans.filter((f) => kindOf(f) === 'mesh'));
splatPane.list(scans.filter((f) => kindOf(f) === 'splat'));

// --- drop other exports: .glb (or .gltf with its .bin and textures), .ply or .spz ---

const drop = document.getElementById('drop');
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; drop.hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.hidden = true; } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  drop.hidden = true;
  const files = [...e.dataTransfer.files];
  const urls = Object.fromEntries(files.map((f) => [f.name, URL.createObjectURL(f)]));

  const splatFile = files.find((f) => kindOf(f.name) === 'splat');
  if (splatFile) {
    for (const b of splatPane.el.querySelectorAll('nav button')) b.setAttribute('aria-current', 'false');
    splatPane.show({ url: urls[splatFile.name], name: splatFile.name }, `${splatFile.name} (local)`);
  }

  const meshFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
  if (meshFile) {
    for (const b of meshPane.el.querySelectorAll('nav button')) b.setAttribute('aria-current', 'false');
    meshPane.show({ url: urls[meshFile.name], name: meshFile.name, files: urls }, `${meshFile.name} (local)`);
  }
});
