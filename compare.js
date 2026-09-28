import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

// Public samples, shown until you drop your own files. Different objects: see the note on the page.
const PH = 'https://dl.polyhaven.org/file/ph-assets/Models/';
const SAMPLE_MESH = {
  url: `${PH}gltf/1k/pot_enamel_01/pot_enamel_01_1k.gltf`,
  // Poly Haven keeps a model's files in different folders; point each relative path at its real home.
  files: {
    'pot_enamel_01.bin': `${PH}gltf/8k/pot_enamel_01/pot_enamel_01.bin`,
    'pot_enamel_01_diff_1k.jpg': `${PH}jpg/1k/pot_enamel_01/pot_enamel_01_diff_1k.jpg`,
    'pot_enamel_01_arm_1k.jpg': `${PH}jpg/1k/pot_enamel_01/pot_enamel_01_arm_1k.jpg`,
    'pot_enamel_01_nor_gl_1k.jpg': `${PH}jpg/1k/pot_enamel_01/pot_enamel_01_nor_gl_1k.jpg`,
  },
  source: 'sample: <a href="https://polyhaven.com/a/pot_enamel_01" target="_blank" rel="noopener">enamel pot</a>, Poly Haven, CC0 · a finished model, cleaner than a raw phone scan',
};
const SAMPLE_SPLAT = {
  url: 'https://sparkjs.dev/assets/splats/food/pad-thai.spz',
  flip: true,
  source: 'sample: pad thai, a real capture from the <a href="https://sparkjs.dev" target="_blank" rel="noopener">Spark</a> examples',
};

const fmt = (n) => n.toLocaleString('en');
const fileName = (url) => decodeURIComponent(url.split(/[?#]/)[0].split('/').pop());

// --- one pane = one renderer, scene, camera and set of controls ---

function makePane(id) {
  const el = document.getElementById(id);
  const view = el.querySelector('.view');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = true;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = view;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(view);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  const statusEl = el.querySelector('.status');
  return {
    el, renderer, scene, camera, controls, object: null, loadId: 0,
    status(text) { statusEl.textContent = text || ''; statusEl.hidden = !text; },
    source(html) { el.querySelector('.source').innerHTML = html; },
  };
}

// Point the camera at the whole thing, from slightly above.
function frame(pane, box) {
  const { camera, controls } = pane;
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.1;

  camera.near = radius / 200;
  camera.far = radius * 200;
  camera.position.copy(center).add(new THREE.Vector3(0.55, 0.45, 1).normalize().multiplyScalar(distance));
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.minDistance = radius * 0.02;
  controls.maxDistance = distance * 5;
  controls.update();
  controls.saveState();
}

function disposeMesh(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.dispose();
    for (const material of [].concat(node.material)) {
      for (const value of Object.values(material)) if (value && value.isTexture) value.dispose();
      material.dispose();
    }
  });
}

// --- mesh pane ---

const meshPane = makePane('mesh');
const pmrem = new THREE.PMREMGenerator(meshPane.renderer);
meshPane.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

let wireframe = false;
const structureBtn = meshPane.el.querySelector('[data-action="structure"]');

function applyWireframe() {
  meshPane.object?.traverse((node) => {
    if (node.isMesh) for (const m of [].concat(node.material)) m.wireframe = wireframe;
  });
  structureBtn.setAttribute('aria-pressed', String(wireframe));
}

structureBtn.addEventListener('click', () => { wireframe = !wireframe; applyWireframe(); });

// files: { 'name.ext': url } for resources the .gltf refers to by relative path.
function loadMesh(url, label, files = {}) {
  const pane = meshPane;
  const id = ++pane.loadId;
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) => files[fileName(u)] || u);
  pane.status(`loading ${label}`);

  new GLTFLoader(manager).load(
    url,
    (gltf) => {
      if (id !== pane.loadId) return disposeMesh(gltf.scene);
      if (pane.object) { pane.scene.remove(pane.object); disposeMesh(pane.object); }
      pane.object = gltf.scene;
      pane.scene.add(gltf.scene);
      applyWireframe();

      let triangles = 0;
      gltf.scene.traverse((n) => {
        if (n.isMesh) triangles += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3;
      });
      pane.el.querySelector('h2 span').textContent = `· GLTF · ${fmt(Math.round(triangles))} triangles`;
      frame(pane, new THREE.Box3().setFromObject(gltf.scene));
      pane.status('');
    },
    (e) => {
      if (id === pane.loadId && e.lengthComputable) pane.status(`loading ${label} · ${Math.round((e.loaded / e.total) * 100)}%`);
    },
    (error) => {
      if (id !== pane.loadId) return;
      console.error(error);
      pane.status(`couldn't load ${label}`);
    },
  );
}

// --- splat pane ---

const splatPane = makePane('splat');
splatPane.scene.add(new SparkRenderer({ renderer: splatPane.renderer }));

function worldBox(splat) {
  splat.updateMatrixWorld(true);
  return splat.getBoundingBox(true).clone().applyMatrix4(splat.matrixWorld);
}

splatPane.el.querySelector('[data-action="flip"]').addEventListener('click', () => {
  const splat = splatPane.object;
  if (!splat) return;
  splat.rotateX(Math.PI);
  frame(splatPane, worldBox(splat));
});

async function loadSplat(options, label, flip) {
  const pane = splatPane;
  const id = ++pane.loadId;
  pane.status(`loading ${label}`);

  let splat;
  try {
    splat = new SplatMesh(options);
    await splat.initialized;
  } catch (error) {
    console.error(error);
    if (id === pane.loadId) pane.status(`couldn't load ${label}`);
    return;
  }
  if (id !== pane.loadId) return splat.dispose();

  if (pane.object) { pane.scene.remove(pane.object); pane.object.dispose(); }
  if (flip) splat.quaternion.set(1, 0, 0, 0); // many splat files are stored upside down
  pane.object = splat;
  pane.scene.add(splat);

  const count = splat.packedSplats?.numSplats ?? splat.numSplats;
  pane.el.querySelector('h2 span').textContent = count ? `· Splat PLY · ${fmt(count)} splats` : '· Splat PLY';
  frame(pane, worldBox(splat));
  pane.status('');
}

// --- samples ---

meshPane.source(SAMPLE_MESH.source);
loadMesh(SAMPLE_MESH.url, 'sample mesh', SAMPLE_MESH.files);
splatPane.source(SAMPLE_SPLAT.source);
loadSplat({ url: SAMPLE_SPLAT.url }, 'sample splat', SAMPLE_SPLAT.flip);

// --- drop your own exports: .glb, or .gltf with its .bin and textures; .ply or .spz ---

const drop = document.getElementById('drop');
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; drop.hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; drop.hidden = true; } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  drop.hidden = true;
  const files = [...e.dataTransfer.files];
  document.getElementById('note').textContent =
    'Showing what you dropped. Drop again to replace; reload to see the samples.';

  const splatFile = files.find((f) => /\.(ply|spz)$/i.test(f.name));
  if (splatFile) {
    splatPane.source(`yours: ${splatFile.name}`);
    loadSplat({ fileBytes: await splatFile.arrayBuffer() }, splatFile.name, false);
  }

  const meshFile = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
  if (meshFile) {
    const urls = Object.fromEntries(files.map((f) => [f.name, URL.createObjectURL(f)]));
    meshPane.source(`yours: ${meshFile.name}`);
    loadMesh(urls[meshFile.name], meshFile.name, urls);
  }
});
