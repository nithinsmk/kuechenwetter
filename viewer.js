import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SCAN_LIST = 'scans/scans.json';
const SCAN_DIR = 'scans/';

const stage = document.getElementById('stage');
const nav = document.getElementById('scans');
const statusEl = document.getElementById('status');
const hint = document.getElementById('hint');
const resetBtn = document.getElementById('reset');
const drop = document.getElementById('drop');

// --- renderer, scene, camera ---

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Even, neutral light: Polycam scans already carry the room's light in their texture.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.screenSpacePanning = true;

function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

// --- loading ---

const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath(
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/'));
loader.setMeshoptDecoder(MeshoptDecoder);

let current = null;
let loadId = 0;

function setStatus(text) {
  statusEl.textContent = text || '';
  statusEl.hidden = !text;
}

function dispose(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.dispose();
    for (const material of [].concat(node.material)) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

// Centre the model and place the camera so the whole thing is in view.
function frame(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);

  const radius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
  // Fit whichever is narrower, so it also fits a portrait phone screen.
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.15;

  camera.near = radius / 100;
  camera.far = radius * 100;
  camera.position.set(0.55, 0.45, 1).normalize().multiplyScalar(distance);
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.minDistance = radius * 0.1;
  controls.maxDistance = distance * 4;
  controls.update();
  controls.saveState();
}

function load(url, label) {
  const id = ++loadId;
  setStatus(`loading ${label}`);

  loader.load(
    url,
    (gltf) => {
      if (id !== loadId) return dispose(gltf.scene);
      if (current) {
        scene.remove(current);
        dispose(current);
      }
      current = gltf.scene;
      scene.add(current);
      frame(current);
      setStatus('');
    },
    (event) => {
      if (id !== loadId) return;
      const text = event.lengthComputable
        ? `${Math.round((event.loaded / event.total) * 100)}%`
        : `${(event.loaded / 1e6).toFixed(1)} MB`;
      setStatus(`loading ${label} · ${text}`);
    },
    (error) => {
      if (id !== loadId) return;
      console.error(error);
      if (current) {
        scene.remove(current);
        dispose(current);
        current = null;
      }
      setStatus(`couldn't load ${label}`);
    },
  );
}

// --- scan list: scans/scans.json holds the file names, in the order to show them ---

const nameOf = (file) => file.replace(/\.(glb|gltf)$/i, '');
let scans = [];

function markCurrent(name) {
  for (const button of nav.querySelectorAll('button')) {
    button.setAttribute('aria-current', String(button.dataset.name === name));
  }
}

function showFromHash() {
  const wanted = decodeURIComponent(location.hash.slice(1));
  const file = scans.find((f) => nameOf(f) === wanted) || scans[0];
  if (!file) return setStatus('no scans yet · drop a .glb here to view one');
  markCurrent(nameOf(file));
  load(SCAN_DIR + encodeURIComponent(file), nameOf(file));
}

async function init() {
  try {
    const response = await fetch(SCAN_LIST, { cache: 'no-store' });
    scans = await response.json();
  } catch (error) {
    console.error(error);
  }

  if (scans.length > 1) {
    for (const file of scans) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = nameOf(file);
      button.dataset.name = nameOf(file);
      button.addEventListener('click', () => { location.hash = encodeURIComponent(nameOf(file)); });
      nav.appendChild(button);
    }
  } else if (scans.length === 1) {
    nav.textContent = nameOf(scans[0]);
  }

  window.addEventListener('hashchange', showFromHash);
  showFromHash();
}

// --- controls hint and reset ---

hint.textContent = window.matchMedia('(pointer: coarse)').matches
  ? 'drag to turn · pinch to zoom · two fingers to move'
  : 'drag to turn · scroll to zoom · right-drag to move';

resetBtn.addEventListener('click', () => controls.reset());

// --- drop a local .glb onto the page to look at it (not saved anywhere) ---

let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; drop.hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.hidden = true; } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  drop.hidden = true;
  const file = [...e.dataTransfer.files].find((f) => /\.glb$/i.test(f.name));
  if (!file) return setStatus('only .glb files can be dropped here');
  markCurrent(null);
  load(URL.createObjectURL(file), `${file.name} (local)`);
});

init();
