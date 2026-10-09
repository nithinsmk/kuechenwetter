// The gallery: things cut out of the kitchen scans (scans/characters, made with
// tools/cut_character.py), floating in a slow ring like a mobile. Each one bobs and
// turns on its own; tap one to go up close. Scattered blobs and gaps are welcome.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

const DIR = 'scans/characters/';
const RING = 0.8; // radius of the ring the things hang on
const SIZE = 0.22; // every thing is scaled to about this radius
const $ = (id) => document.getElementById(id);
const dateOf = (scan) => scan.replace(/^(\d+)_(\d+)_\d+.*/, (_, d, m) => `${d.padStart(2, '0')}.${m.padStart(2, '0')}`);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new SparkRenderer({ renderer }));
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 0.4;
controls.maxDistance = 5;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

const home = new THREE.Vector3(0, 0.35, 2.4);
function resize() {
  const { clientWidth: w, clientHeight: h } = $('stage');
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Stand far enough back that the whole ring fits across, also on a tall phone screen.
  const halfWide = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  home.setLength(Math.max(2.4, (RING + SIZE * 1.4) / Math.tan(halfWide) + RING * 0.6));
  controls.maxDistance = home.length() * 1.6;
}
new ResizeObserver(resize).observe($('stage'));
resize();
camera.position.copy(home);

// --- the cast ---

const cast = [];

async function load() {
  const items = await fetch(`${DIR}characters.json`, { cache: 'no-store' }).then((r) => r.json());
  items.forEach((item, i) => {
    const angle = (i / items.length) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(angle) * RING, i % 2 ? 0.1 : -0.08, Math.cos(angle) * RING);
    const splat = new SplatMesh({ url: DIR + item.file });
    splat.scale.setScalar(SIZE / item.radius);
    holder.add(splat);
    scene.add(holder);

    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = 'tag';
    tag.textContent = item.title || item.name.replaceAll('-', ' ');
    tag.addEventListener('click', () => focusOn(entry));
    $('tags').append(tag);

    const entry = { item, holder, splat, tag, base: holder.position.y, phase: Math.random() * Math.PI * 2, spin: 0.12 + Math.random() * 0.18 };
    cast.push(entry);
  });
  $('status').hidden = true;
}

// --- going up close, and back ---

let focused = null;
let flight = null; // { from, to, fromTarget, toTarget, t0 }

function fly(toPosition, toTarget) {
  flight = { from: camera.position.clone(), to: toPosition, fromTarget: controls.target.clone(), toTarget, t0: performance.now() };
}

function focusOn(entry) {
  focused = entry;
  controls.autoRotate = false;
  const where = entry.holder.getWorldPosition(new THREE.Vector3());
  const away = where.clone().setY(0).normalize();
  fly(where.clone().add(away.multiplyScalar(1.15)).add(new THREE.Vector3(0, 0.1, 0)), where);
  $('caption-name').textContent = entry.tag.textContent;
  $('caption-from').textContent = `cut out of the ${dateOf(entry.item.scan)} scan`;
  $('caption').hidden = false;
  for (const c of cast) c.tag.classList.toggle('dim', c !== entry);
}

function back() {
  focused = null;
  controls.autoRotate = true;
  fly(home.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(camera.position.x, camera.position.z)), new THREE.Vector3());
  $('caption').hidden = true;
  for (const c of cast) c.tag.classList.remove('dim');
}

$('back').addEventListener('click', back);

// Tap a thing itself, not only its name.
const raycaster = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
  const hit = raycaster.intersectObjects(cast.map((c) => c.splat), false)[0];
  const entry = hit && cast.find((c) => c.splat === hit.object);
  if (entry) focusOn(entry);
  else if (focused) back();
});

// --- every frame ---

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const point = new THREE.Vector3();

renderer.setAnimationLoop((time) => {
  const s = time / 1000;
  for (const c of cast) {
    c.holder.position.y = c.base + 0.035 * Math.sin(s * 0.7 + c.phase);
    c.splat.rotation.y = s * c.spin + c.phase;
  }
  if (flight) {
    const t = Math.min(1, (time - flight.t0) / 1400);
    camera.position.lerpVectors(flight.from, flight.to, ease(t));
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease(t));
    if (t === 1) flight = null;
  }
  controls.update();
  renderer.render(scene, camera);

  // Names hang just below each thing; the far side of the ring fades back.
  const { clientWidth: w, clientHeight: h } = $('stage');
  for (const c of cast) {
    c.holder.getWorldPosition(point);
    point.y -= SIZE * 1.15;
    const depth = point.distanceTo(camera.position);
    point.project(camera);
    const visible = point.z < 1 && Math.abs(point.x) < 1.2 && Math.abs(point.y) < 1.2;
    c.tag.hidden = !visible;
    c.tag.style.transform = `translate(${((point.x + 1) / 2) * w}px, ${((1 - point.y) / 2) * h}px) translate(-50%, 0)`;
    c.tag.style.zIndex = String(1000 - Math.round(depth * 100));
    c.tag.style.opacity = focused ? '' : String(Math.max(0.35, Math.min(1, 2.6 - depth * 0.7)));
  }
});

if (new URLSearchParams(location.search).has('clean')) document.body.classList.add('clean');
load().catch((error) => { console.error(error); $('status').textContent = "couldn't load the gallery"; });

// Opened over the radio (gallery.html?over): going back just closes this frame, so the
// music, which is playing in the radio underneath, never stops.
if (new URLSearchParams(location.search).has('over') && window.parent !== window) {
  document.querySelector('.home').addEventListener('click', (event) => {
    event.preventDefault();
    window.parent.postMessage('close-gallery', location.origin);
  });
  addEventListener('keydown', (event) => { if (event.key === 'Escape') window.parent.postMessage('close-gallery', location.origin); });
}
