// Shared by the viewer and the compare page: loading, framing and disposing scans,
// whether they are meshes (.glb/.gltf) or Gaussian splats (.ply/.spz).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

export const SCAN_DIR = 'scans/';
export const SCAN_LIST = 'scans/scans.json';

export const isSplatFile = (name) => /\.(ply|spz)$/i.test(name);
export const kindOf = (name) => (isSplatFile(name) ? 'splat' : 'mesh');
export const nameOf = (file) => file.replace(/\.(glb|gltf|ply|spz)$/i, '');
export const fileName = (url) => decodeURIComponent(url.split(/[?#]/)[0].split('/').pop());
const fmt = (n) => Math.round(n).toLocaleString('en');

export async function listScans() {
  try {
    const response = await fetch(SCAN_LIST, { cache: 'no-store' });
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

// --- a canvas with a camera and orbit controls that can show meshes and splats ---

// options.fit: 'both' fits the whole object on screen; 'fill' lets it crop at the sides of
// a portrait screen, keeping the camera close (useful for splats with loose blobs around them).
export function createStage(container, options = {}) {
  const fit = options.fit ?? 'both';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Even, neutral light for meshes: Polycam textures already carry the room's light.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new SparkRenderer({ renderer }));

  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = true;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  let onFrame = null;
  renderer.setAnimationLoop((time) => {
    onFrame?.(time);
    controls.update();
    renderer.render(scene, camera);
  });

  let current = null;
  let loadId = 0;

  // Load a scan and swap it in. Resolves to the object, or null if a newer load took over.
  async function show(source, onProgress) {
    const id = ++loadId;
    let object;
    try {
      object = await loadScan(source, (loaded, total) => { if (id === loadId) onProgress?.(loaded, total); });
    } catch (error) {
      if (id === loadId && current) { scene.remove(current); disposeScan(current); current = null; }
      throw error;
    }
    if (id !== loadId) { disposeScan(object); return null; }
    return place(object);
  }

  // Swap in an object that's already built (a scan, or a scene made in code).
  function place(object) {
    ++loadId; // a slower load still running won't replace it
    if (current) { scene.remove(current); disposeScan(current); }
    current = object;
    scene.add(object);
    frame(camera, controls, boundsOf(object), fit);
    return object;
  }

  return {
    renderer, scene, camera, controls, show, place,
    reset: () => controls.reset(),
    get current() { return current; },
    set onFrame(fn) { onFrame = fn; }, // called every frame, before the controls update
  };
}

// --- loading ---

const gltfLoader = (manager) => new GLTFLoader(manager)
  .setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/'))
  .setMeshoptDecoder(MeshoptDecoder);

// source: { url, name, files?, focus? } where files maps a .gltf's relative file names to URLs,
// and focus ({ center: [x, y, z], radius }) says where to point the camera.
export async function loadScan({ url, name, files = {}, focus }, onProgress) {
  if (isSplatFile(name)) {
    const splat = await makeSplat(await fetchBytes(url, onProgress));
    if (focus) splat.userData.focus = new THREE.Sphere(new THREE.Vector3(...focus.center), focus.radius);
    return splat;
  }

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((u) => files[fileName(u)] || u);
  const gltf = await gltfLoader(manager).loadAsync(url, (e) => onProgress?.(e.loaded, e.lengthComputable ? e.total : 0));
  return gltf.scene;
}

async function fetchBytes(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes.buffer;
}

// Polycam writes its splats with the Y axis pointing down (it says so in the file header).
async function makeSplat(buffer) {
  const header = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(4096, buffer.byteLength)));
  const focus = plyFocus(buffer, header);
  const splat = new SplatMesh({ fileBytes: buffer });
  await splat.initialized;
  if (focus) splat.userData.focus = focus;
  if (/y-axis down/i.test(header)) splat.rotateX(Math.PI);
  return splat;
}

// Polycam splats keep the whole room as a far-off shell of blobs, so the bounding box
// is room-sized. Find the dense core instead: the median point, and the distance
// that takes in the nearest 40% of points.
const PLY_SIZES = { char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2,
  int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };

function plyFocus(buffer, header) {
  const end = header.indexOf('end_header\n');
  if (!header.startsWith('ply') || !header.includes('binary_little_endian') || end < 0) return null;
  const lines = header.slice(0, end).split('\n');
  const count = Number(lines.find((l) => l.startsWith('element vertex'))?.split(' ')[2]);
  let stride = 0;
  const offsets = {};
  for (const line of lines.filter((l) => l.startsWith('property'))) {
    const [, type, name] = line.trim().split(/\s+/);
    offsets[name] = { offset: stride, type };
    stride += PLY_SIZES[type] ?? 0;
  }
  if (!count || !['x', 'y', 'z'].every((k) => offsets[k]?.type.startsWith('float'))) return null;

  const view = new DataView(buffer, end + 'end_header\n'.length);
  const step = Math.max(1, Math.floor(count / 40000));
  const points = [];
  for (let i = 0; i < count; i += step) {
    const base = i * stride;
    points.push(['x', 'y', 'z'].map((k) => view.getFloat32(base + offsets[k].offset, true)));
  }
  const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const center = new THREE.Vector3(...[0, 1, 2].map((k) => median(points.map((p) => p[k]))));
  const distances = points.map((p) => center.distanceTo(new THREE.Vector3(...p))).sort((a, b) => a - b);
  return new THREE.Sphere(center, distances[Math.floor(distances.length * 0.4)]);
}

// --- measuring, framing, cleaning up ---

// The sphere the camera should frame, in world space.
export function boundsOf(object) {
  object.updateMatrixWorld(true);
  if (object.userData.focus) return object.userData.focus.clone().applyMatrix4(object.matrixWorld);
  const box = object instanceof SplatMesh
    ? object.getBoundingBox(true).clone().applyMatrix4(object.matrixWorld)
    : new THREE.Box3().setFromObject(object);
  return box.getBoundingSphere(new THREE.Sphere());
}

// "100,000 triangles" or "298,508 splats"
export function describe(object) {
  if (object instanceof SplatMesh) {
    const n = object.packedSplats?.numSplats ?? object.numSplats;
    return n ? `${fmt(n)} splats` : 'splat';
  }
  let triangles = 0;
  object.traverse((node) => {
    if (node.isMesh) triangles += (node.geometry.index ?? node.geometry.attributes.position).count / 3;
  });
  return `${fmt(triangles)} triangles`;
}

// Point the camera at the whole thing, from slightly above.
export function frame(camera, controls, sphere, fit = 'both') {
  const center = sphere.center.clone();
  const radius = sphere.radius || 1;
  // Fit whichever is narrower, so it also fits a portrait phone screen,
  // or with 'fill', don't pull back further than 60% of the height would need.
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const fov = fit === 'fill' ? Math.max(hFov, vFov * 0.6) : Math.min(vFov, hFov);
  const distance = radius / Math.sin(fov / 2) * 1.1;

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

export function setWireframe(object, on) {
  object?.traverse((node) => {
    if (node.isMesh) for (const material of [].concat(node.material)) material.wireframe = on;
  });
}

export function disposeScan(object) {
  if (object instanceof SplatMesh) return object.dispose();
  object.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.dispose();
    for (const material of [].concat(node.material)) {
      for (const value of Object.values(material)) if (value && value.isTexture) value.dispose();
      material.dispose();
    }
  });
}

export const progressText = (loaded, total) =>
  total ? `${Math.round((loaded / total) * 100)}%` : `${(loaded / 1e6).toFixed(1)} MB`;
