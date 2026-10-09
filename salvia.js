// Salvia, the house cat, as the website's daemon. A white Persian, about a third the
// height of the cutlery holder, living inside whichever scan is showing. She arrives,
// checks in, sniffs about, eats the plant if there is one, sleeps, and runs off, then
// comes back later. Tap her and she turns into her next form: soft splat blobs like
// the scans (her default), a pixel sprite, or a faceted cartoon cat with big blue eyes.
//
// She measures the ground when a scan loads (rays cast down around the holder), so she
// walks on the counter, or on whatever surface the scan has.
import * as THREE from 'three';
import { SplatMesh } from '@sparkjsdev/spark';
import { plantGarden, shadowBlob } from './plants.js';
import { hamsaCanvas } from './hamsa.js';

const FORMS = ['splat', 'pixel', 'cartoon'];
const CAT_HEIGHT = 1.05; // in cat units, ears included
const OF_HOLDER = 2.5 / 8; // her height against the cutlery holder's (first an eighth, now 2.5 times that)
const ON_THE_HILL = 2.5; // and 2.5 times her first size on the hill too

// --- her shape, in cat units: facing +z, feet at y = 0 ---

const WHITE = new THREE.Color('#f4f3ef');
const SHADE = new THREE.Color('#d9d8dc');
const EAR = new THREE.Color('#c7b3b8');
const AQUA = new THREE.Color('#5fe0d0');
const EMERALD = new THREE.Color('#1f8a4c');
const PUPIL = new THREE.Color('#1d1d1b');
const NOSE = new THREE.Color('#c98a92');

const BODY = [
  { c: [0, 0.5, 0], r: [0.25, 0.22, 0.42], n: 2200 },
  { c: [0, 0.56, 0.3], r: [0.24, 0.25, 0.18], n: 900 }, // the ruff
];
const HEAD = [ // around the neck pivot
  { c: [0, 0.12, 0.1], r: [0.24, 0.22, 0.2], n: 1300 },
  { c: [0.13, 0.05, 0.17], r: [0.11, 0.09, 0.09], n: 200 },
  { c: [-0.13, 0.05, 0.17], r: [0.11, 0.09, 0.09], n: 200 },
];
const EARS = [
  { c: [0.14, 0.3, 0.05], r: [0.065, 0.085, 0.03], n: 140, tilt: -0.35 },
  { c: [-0.14, 0.3, 0.05], r: [0.065, 0.085, 0.03], n: 140, tilt: 0.35 },
];
const FACE = [ // eyes (her left aquamarine, her right emerald), slit pupils, glints, nose
  { c: [0.085, 0.15, 0.285], r: [0.05, 0.042, 0.015], n: 40, color: AQUA, size: 0.02 },
  { c: [-0.085, 0.15, 0.285], r: [0.05, 0.042, 0.015], n: 40, color: EMERALD, size: 0.02 },
  { c: [0.085, 0.15, 0.305], r: [0.011, 0.03, 0.005], n: 10, color: PUPIL, size: 0.01 },
  { c: [-0.085, 0.15, 0.305], r: [0.011, 0.03, 0.005], n: 10, color: PUPIL, size: 0.01 },
  { c: [0, 0.08, 0.3], r: [0.022, 0.015, 0.01], n: 10, color: NOSE, size: 0.012 },
  { c: [0.105, 0.172, 0.312], r: [0.004, 0.004, 0.002], n: 3, color: new THREE.Color('#ffffff'), size: 0.01 },
  { c: [-0.065, 0.172, 0.312], r: [0.004, 0.004, 0.002], n: 3, color: new THREE.Color('#ffffff'), size: 0.01 },
];
const TAIL = [ // around the tail pivot, a bushy plume going back and up
  { c: [0, 0.02, -0.08], r: [0.09, 0.09, 0.12], n: 220 },
  { c: [0, 0.1, -0.22], r: [0.1, 0.1, 0.12], n: 240 },
  { c: [0, 0.2, -0.34], r: [0.1, 0.1, 0.12], n: 240 },
  { c: [0, 0.3, -0.44], r: [0.085, 0.085, 0.1], n: 180 },
];
const LEG = [ // around the hip pivot
  { c: [0, -0.17, 0], r: [0.075, 0.2, 0.075], n: 240 },
  { c: [0, -0.33, 0.03], r: [0.08, 0.05, 0.1], n: 90 },
];
const NECK = [0, 0.68, 0.42];
const TAIL_BASE = [0, 0.58, -0.4];
const HIPS = [[0.13, 0.37, 0.26], [-0.13, 0.37, 0.26], [0.15, 0.38, -0.26], [-0.15, 0.38, -0.26]];

// --- three ways to build her ---

function rig() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  const eyes = new THREE.Group();
  const tail = new THREE.Group();
  const legs = HIPS.map((p) => new THREE.Group().translateX(p[0]).translateY(p[1]).translateZ(p[2]));
  head.position.set(...NECK);
  tail.position.set(...TAIL_BASE);
  head.add(eyes);
  body.add(head, tail, ...legs);
  root.add(body);
  return { root, body, head, eyes, tail, legs };
}

// Fur: blobs scattered over each ellipsoid's surface, darker underneath.
function furSplats(shapes, { colorOf } = {}) {
  return new SplatMesh({
    constructSplats: (splats) => {
      const center = new THREE.Vector3();
      const scales = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const color = new THREE.Color();
      const d = new THREE.Vector3();
      for (const s of shapes) {
        for (let i = 0; i < s.n; i++) {
          d.randomDirection();
          const depth = 0.9 + Math.random() * 0.14;
          center.set(s.c[0] + s.r[0] * d.x * depth, s.c[1] + s.r[1] * d.y * depth, s.c[2] + s.r[2] * d.z * depth);
          if (s.tilt) center.applyAxisAngle(new THREE.Vector3(0, 0, 1), s.tilt * (center.y - s.c[1]));
          const size = s.size ?? 0.034;
          if (s.color) {
            scales.set(size, size, size * 0.6);
            quaternion.identity();
          } else { // a strand: long one way, thin the other, lying along the surface and drooping a little
            scales.set(size * (0.9 + Math.random() * 0.7), size * 0.4, size * 0.4);
            const along = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize().lerp(new THREE.Vector3(0, -1, 0), 0.35).normalize();
            quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), along.lengthSq() ? along : d);
          }
          if (s.color) color.copy(s.color);
          else if (colorOf) color.copy(colorOf(s, d));
          else color.copy(WHITE).lerp(SHADE, Math.max(0, -d.y) * 0.8 + Math.random() * 0.12);
          splats.pushSplat(center, scales, quaternion, s.color ? 1 : 0.82, color);
        }
      }
    },
  });
}

// Her collar: a blue band round the neck with the evil-eye hamsa hanging at the front,
// on a pivot so it swings and bounces as she moves (see pose()).
function collar(r) {
  const at = [0, 0.64, 0.4];
  const radius = 0.19;
  const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.026, 6, 24),
    new THREE.MeshStandardMaterial({ color: '#2f5fd0', roughness: 0.45, flatShading: true }));
  band.position.set(...at);
  band.rotation.x = -0.64; // round the neck, which leans forward
  r.body.add(band);
  const pivot = new THREE.Group();
  pivot.position.set(at[0], at[1] - radius * 0.8, at[2] + radius * 0.62);
  const texture = new THREE.CanvasTexture(hamsaCanvas());
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const charm = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.16),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  charm.position.set(0, -0.09, 0.02);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.006, 4, 10),
    new THREE.MeshStandardMaterial({ color: '#c9d1dc', metalness: 0.7, roughness: 0.3 }));
  pivot.add(charm, ring);
  r.body.add(pivot);
  r.pendant = pivot;
  r.pendantY = pivot.position.y;
}

function buildSplat() {
  const r = rig();
  r.body.add(furSplats(BODY));
  r.head.add(furSplats(HEAD));
  r.head.add(furSplats(EARS, { colorOf: (s, d) => (d.z > 0.2 ? EAR : WHITE) }));
  r.eyes.add(furSplats([...FACE.slice(0, 4), ...FACE.slice(5)]));
  r.head.add(furSplats([FACE[4]]));
  r.tail.add(furSplats(TAIL));
  for (const leg of r.legs) leg.add(furSplats(LEG));
  collar(r);
  return r;
}

// The cartoon: faceted, big-headed, big blue eyes with a shine, a spiky ruff.
function buildCartoon() {
  const r = rig();
  const material = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness });
  const fur = material(WHITE);
  const add = (parent, geometry, mat, at, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...at);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  };
  const ball = (detail) => new THREE.IcosahedronGeometry(1, detail);

  add(r.body, ball(1), fur, [0, 0.46, 0], [0.27, 0.23, 0.42]);
  // the ruff: white spikes fanning out under the chin
  const spike = new THREE.ConeGeometry(0.05, 0.15, 4);
  for (let k = 0; k < 13; k++) {
    const a = -1.25 + (k / 12) * 2.5;
    add(r.body, spike, fur, [Math.sin(a) * 0.2, 0.5 - Math.abs(Math.sin(a)) * 0.05, 0.36 + Math.cos(a) * 0.06], [1, 1, 1], [Math.PI - 0.5, a * 0.6, 0]);
  }

  add(r.head, ball(2), fur, [0, 0.16, 0.12], [0.3, 0.28, 0.26]);
  for (const side of [1, -1]) {
    const iris = side > 0 ? AQUA : EMERALD;
    add(r.head, new THREE.ConeGeometry(0.09, 0.18, 4), fur, [side * 0.17, 0.42, 0.06], [1, 1, 0.7], [0, Math.PI / 4, -side * 0.35]);
    add(r.head, new THREE.ConeGeometry(0.055, 0.12, 4), material('#e4b3a6'), [side * 0.165, 0.41, 0.11], [1, 1, 0.4], [0, Math.PI / 4, -side * 0.35]);
    add(r.eyes, ball(1), material(iris, 0.3), [side * 0.11, 0.17, 0.365], [0.08, 0.085, 0.035]);
    add(r.eyes, ball(1), material(PUPIL, 0.2), [side * 0.11, 0.17, 0.392], [0.022, 0.066, 0.02]);
    add(r.eyes, ball(0), material('#ffffff', 0.1), [side * 0.11 + 0.025, 0.205, 0.41], [0.016, 0.016, 0.01]);
  }
  add(r.head, ball(0), material('#b98a80'), [0, 0.09, 0.39], [0.025, 0.018, 0.015]);

  // a short tail, curling up over the back
  [[0, 0.03, -0.06, 0.1], [0, 0.15, -0.13, 0.11], [0, 0.27, -0.1, 0.1], [0, 0.33, -0.02, 0.08]]
    .forEach(([x, y, z, size]) => add(r.tail, ball(0), fur, [x, y, z], [size, size, size]));

  // short, stubby legs
  for (const leg of r.legs) {
    add(leg, new THREE.CylinderGeometry(0.085, 0.095, 0.3, 6), fur, [0, -0.15, 0]);
    add(leg, ball(0), fur, [0, -0.33, 0.03], [0.1, 0.055, 0.11]);
  }
  collar(r);
  return r;
}

// Pixel art, 20 × 16, facing right: a Persian, flat-faced, with a big ruff, dense fur
// (w white, s shade, f pale highlight) and a plumed tail. k outline, p pink, a aquamarine
// eye, e emerald eye, d pupil, g glint.
// The body, rows 0–12 (collar 'c' under the chin); legs and the pendant are added per frame.
const BODY_PIXELS = [
  '.............kk.kk..', '............kpkkpk..', '...........kwfwwfwk.', '..........kwwswwswk.',
  '.kkk......kwadgedwk.', '.kwwk.....kwwwpwwwk.', '..kwwk..kkkwsfswfsk.', '...kwfkkwswccccccsk.',
  '....kwwwwfwwswwfsk..', '....kwswwwwwswwwk...', '....kwwwfswwwwfwk...', '.....kswwwwswwsk....',
  '.....kssssssssk.....',
];
const paint = (rows, x, y, text) => {
  const row = rows[y].split('');
  [...text].forEach((ch, i) => { if (ch !== '.' && x + i >= 0 && x + i < row.length) row[x + i] = ch; });
  rows[y] = row.join('');
};
// A leg: hip at column x, the foot swung forward (+1) or back (-1), or lifted mid-step.
function pixelLeg(rows, x, swing, ink, lifted) {
  paint(rows, x, 13, `k${ink}${ink}k`);
  paint(rows, x + Math.round(swing * 0.5), 14, lifted ? 'kkkk' : `k${ink}${ink}k`);
  if (!lifted) paint(rows, x + swing, 15, 'kkkk');
}
// Near legs white, far legs shaded and a step further on; diagonal pairs move together.
function pixelFrame({ nb = 0, fb = 0, nf = 0, ff = 0, lift = '', charm = [0, 0] }) {
  const rows = [...BODY_PIXELS, '.'.repeat(20), '.'.repeat(20), '.'.repeat(20)];
  pixelLeg(rows, 8, fb, 's', lift.includes('b'));
  pixelLeg(rows, 13, ff, 's', lift.includes('f'));
  pixelLeg(rows, 5, nb, 'w', lift.includes('B'));
  pixelLeg(rows, 10, nf, 'w', lift.includes('F'));
  const [dx, dy] = charm; // the hamsa on her chest, swinging
  paint(rows, 14 + dx, 8 + dy, 'h');
  paint(rows, 13 + dx, 9 + dy, 'owo');
  paint(rows, 14 + dx, 10 + dy, 'o');
  return rows;
}
const PIXELS = {
  stand: pixelFrame({}),
  walk0: pixelFrame({ nb: -1, ff: -1, fb: 1, nf: 1, charm: [1, 0] }),
  walk1: pixelFrame({ lift: 'Bf', charm: [0, 1] }),
  walk2: pixelFrame({ nb: 1, ff: 1, fb: -1, nf: -1, charm: [-1, 0] }),
  walk3: pixelFrame({ lift: 'bF', charm: [0, 1] }),
  rear: (() => {
    const rows = [
      '...........kk.kk....', '..........kpkkpk....', '.........kwfwwfwk...', '........kwwswwswk...',
      '........kwadgedwk...', '........kwwwpwwwkk..', '.......kwsccccccwwk.', '......kwwwwwwwwkwk..',
      '.....kwswwfwwwsk....', '.kk..kwwwwswwfwk....', '.kwk.kwwswwwwwsk....', '..kwkkwwwfwwwwk.....',
      '...kwkwsswwswk......', '....kkwwwwwwk.......', '.....kwwkkwwk.......', '.....kkkk.kkk.......'];
    paint(rows, 12, 7, 'h'); paint(rows, 11, 8, 'owo'); paint(rows, 12, 9, 'o');
    return rows;
  })(),
  sleep: (() => {
    const rows = [
      '....................', '....................', '....................', '....................',
      '....................', '....................', '..............kk.kk.', '.......kkkkkkkwkkwk.',
      '.....kkwwfwwswwwwwwk', '....kwwwwwwwwwwadgek', '...kwswwfwwsfwwwwpwk', '..kwwwwwwwwwwwwwwwk.',
      '..kwfwwswwwwfwwwwsk.', '..kswwwwwwwwwwwwssk.', '...kkkkkkkkkkkkkkk..', '....................'];
    for (let y = 8; y <= 11; y++) paint(rows, 13, y, 'c');
    paint(rows, 12, 12, 'o');
    return rows;
  })(),
};
const INK = { c: '#2f5fd0', h: '#c9d1dc', o: '#1d3fa8', k: '#55555a', w: '#f6f6f3', s: '#d3d3d8', f: '#ffffff', p: '#e6a3ad', a: '#5fe0d0', e: '#1f8a4c', d: '#1a1a1a', g: '#ffffff' };

function pixelTexture(rows) {
  const canvas = document.createElement('canvas');
  canvas.width = 20;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (INK[ch]) { ctx.fillStyle = INK[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildPixel() {
  const r = rig();
  const textures = Object.fromEntries(Object.entries(PIXELS).map(([k, rows]) => [k, pixelTexture(rows)]));
  const material = new THREE.SpriteMaterial({ map: textures.stand, transparent: true, alphaTest: 0.5 }); // clear pixels mustn't hide the scan
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 1.28, 1);
  sprite.position.y = 0.64;
  r.root.add(sprite);
  r.body.visible = false; // the sprite stands in for the whole rig
  r.sprite = { sprite, material, textures };
  return r;
}

const BUILD = { splat: buildSplat, pixel: buildPixel, cartoon: buildCartoon };

// --- the daemon ---

export function makeSalvia({ scene, camera, canvas, onTenPets, onPurring, onHiss }) {
  const holder = new THREE.Group(); // her place in the world: ground position and heading
  holder.visible = false;
  scene.add(holder);
  const shadow = shadowBlob(0.42);
  shadow.position.y = 0.012;
  holder.add(shadow);
  let formIndex = 0;
  let cat = null;

  function becomeForm(index) {
    if (cat) {
      holder.remove(cat.root);
      cat.root.traverse((o) => { o.dispose?.(); o.geometry?.dispose?.(); });
    }
    formIndex = index % FORMS.length;
    cat = BUILD[FORMS[formIndex]]();
    holder.add(cat.root);
  }
  becomeForm(0);

  // The speech bubble: a small chip that hangs over her for a moment.
  const bubble = document.createElement('p');
  bubble.id = 'salvia-says';
  bubble.hidden = true;
  document.body.append(bubble);
  let bubbleUntil = 0;
  const say = (text, ms = 2600) => { bubble.textContent = text; bubbleUntil = performance.now() + ms; };

  // --- the ground of the current scan ---

  let ground = null; // { floor, size, holderAt, cells: [[x, z]], heights, grid, ... }

  let measuring = 0;
  async function measure(object, focus, plant, ghost, tries = 0) {
    const id = ++measuring;
    quiet();
    uproot();
    if (reaper) { scene.remove(reaper.g); reaper = null; }
    ground = null;
    holder.visible = false;
    // Rays only hit a scan once it has been drawn, so wait for drawn frames (which also
    // means no work while the page is in a background tab).
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    if (id !== measuring) return;
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const c = focus.center;
    const half = Math.max(0.8, focus.radius * 2.2);
    const step = half / 13;
    const grid = new Map();
    let n = 0;
    for (let i = -13; i <= 13; i++) {
      for (let j = -13; j <= 13; j++) {
        const x = c.x + i * step;
        const z = c.z + j * step;
        ray.set(new THREE.Vector3(x, c.y + 3, z), down);
        const hit = ray.intersectObject(object, true)[0];
        if (hit) grid.set(`${i},${j}`, hit.point.y);
        if (++n % 60 === 0) await new Promise((done) => setTimeout(done, 0)); // stay responsive
      }
    }
    if (id !== measuring) return; // another scan took over meanwhile
    if (grid.size < 20) { // not drawn yet: try again shortly
      if (tries < 10) setTimeout(() => measure(object, focus, plant, ghost, tries + 1), 1500);
      return;
    }
    const near = [...grid.entries()].map(([k, y]) => [k.split(',').map(Number), y]);
    const dist = ([i, j]) => Math.hypot(i, j) * step;
    const ring = near.filter(([ij]) => dist(ij) > 0.18 && dist(ij) < 0.6).map(([, y]) => y).sort((a, b) => a - b);
    if (!ring.length) return;
    const floor = ring[Math.floor(ring.length * 0.35)];
    const tall = near.filter(([ij, y]) => dist(ij) < 0.35 && y > floor + 0.18);
    const tallYs = tall.map(([, y]) => y).sort((a, b) => a - b);
    const holderHeight = THREE.MathUtils.clamp((tallYs[Math.floor(tallYs.length * 0.12)] ?? floor + 0.3) - floor, 0.15, 0.6);
    const holderAt = tall.length
      ? tall.reduce((a, [[i, j]]) => [a[0] + (c.x + i * step) / tall.length, a[1] + (c.z + j * step) / tall.length], [0, 0])
      : [c.x, c.z];
    const size = holderHeight * OF_HOLDER;
    const cells = near
      .filter(([[i, j], y]) => Math.abs(y - floor) < size * 1.5
        && Math.hypot(c.x + i * step - holderAt[0], c.z + j * step - holderAt[1]) > 0.13 + size * 0.6)
      .map(([[i, j], y]) => [c.x + i * step, c.z + j * step, y]);
    if (cells.length < 8) return;
    const plantCell = plant
      ? cells.reduce((best, cell) => (Math.hypot(cell[0] - plant[0], cell[1] - plant[2]) < Math.hypot(best[0] - plant[0], best[1] - plant[2]) ? cell : best))
      : null;
    // The dark figure to the left of the drainer (seen from some views): she's wary of it.
    const ghostCell = ghost
      ? cells.reduce((best, cell) => (Math.hypot(cell[0] - ghost[0], cell[1] - ghost[2]) < Math.hypot(best[0] - ghost[0], best[1] - ghost[2]) ? cell : best))
      : null;
    ground = { floor, size, holderAt, cells, plant, plantCell, grid, step, c, ghost, ghostCell };
    plantFor(`kitchen ${c.x.toFixed(2)} ${c.z.toFixed(2)}`);
    holder.scale.setScalar(size / CAT_HEIGHT);
    plan('away', 3000 + Math.random() * 4000);
    if (pending) { const run = pending; pending = null; run(); }
  }

  function heightAt(x, z) {
    if (!ground) return 0;
    if (ground.heightAt) return ground.heightAt(x, z); // a scene that knows its own ground
    const { grid, step, c, floor } = ground;
    const fi = (x - c.x) / step;
    const fj = (z - c.z) / step;
    const i0 = Math.floor(fi);
    const j0 = Math.floor(fj);
    const h = (i, j) => {
      const y = grid.get(`${i},${j}`);
      return y === undefined || Math.abs(y - floor) > ground.size * 1.5 ? floor : y;
    };
    const tx = fi - i0;
    const tz = fj - j0;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(i0, j0), h(i0 + 1, j0), tx), THREE.MathUtils.lerp(h(i0, j0 + 1), h(i0 + 1, j0 + 1), tx), tz);
  }

  // --- what she's doing ---

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  let state = { name: 'away', until: 0 };
  let purring = false;
  let pending = null; // a scene asked for before the ground was measured
  const quiet = () => { if (purring) { purring = false; onPurring?.(false); } };

  // Her little 8-bit plants (plants.js), planted wherever she's walking.
  let garden = null;
  function uproot() {
    if (!garden) return;
    scene.remove(garden.group);
    garden.group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    garden = null;
  }
  function plantFor(key) {
    uproot();
    garden = plantGarden(ground, key, camera);
    scene.add(garden.group);
  }
  let target = null;
  let then = null;
  let speed = 0;

  function plan(name, ms = 0, extra = {}) {
    state = { name, until: performance.now() + ms, started: performance.now(), ...extra };
  }

  function walkTo(cell, fast, next) {
    target = new THREE.Vector2(cell[0], cell[1]);
    then = next;
    speed = ground.size * (fast ? 6 : 1.8); // about a body length a second, more when running
    plan(fast ? 'run' : 'walk', 60000);
  }

  function edgeCell() {
    const [hx, hz] = ground.holderAt;
    const far = [...ground.cells].sort((a, b) => Math.hypot(b[0] - hx, b[1] - hz) - Math.hypot(a[0] - hx, a[1] - hz));
    return pick(far.slice(0, Math.max(3, Math.floor(far.length * 0.08))));
  }

  function nearHolder() {
    const [hx, hz] = ground.holderAt;
    const close = ground.cells.filter((cell) => Math.hypot(cell[0] - hx, cell[1] - hz) < Math.max(0.24, ground.size * 2));
    return close.length ? pick(close) : pick(ground.cells);
  }

  function nextActivity() {
    const options = ['wander', 'wander', 'sniff', 'sniff', 'checkin', 'sleep', 'runaway'];
    if (ground.plantCell || garden?.plants.length) options.push('plant', 'plant', 'plant');
    const atFigure = ghostSpot();
    if (atFigure) options.push('spook', 'ghostnap');
    switch (pick(options)) {
      case 'spook': return walkTo(atFigure, false, () => { say('…?', 1500); plan('spook', 7000, { phase: 0 }); });
      case 'ghostnap': return walkTo(atFigure, false, () => {
        say('*curls up by it*');
        plan('sleep', 30000 + Math.random() * 20000, { reaper: true });
        setTimeout(() => { if (state.reaper && state.name === 'sleep') summonReaper(); }, 6000);
      });
      case 'wander': return walkTo(pick(ground.cells), false, nextActivity);
      case 'sniff': return walkTo(pick(ground.cells), false, () => { say('*sniff sniff*'); plan('sniff', 2500 + Math.random() * 2000); });
      case 'checkin': return walkTo(nearHolder(), false, () => { say(pick(['mrrp', 'mrrp?', '*checks in*'])); plan('sit', 4000 + Math.random() * 3000); });
      case 'plant':
        if (garden?.plants.length && (!ground.plantCell || Math.random() < 0.75)) return eatPlant(pick(garden.plants), false);
        return walkTo(ground.plantCell, false, () => { say(ground.plantWords ?? '*nom nom* (your plant)'); plan('eat', 5000 + Math.random() * 3000); });
      case 'sleep': return walkTo(pick(ground.cells), false, () => plan('sleep', 20000 + Math.random() * 25000));
      default: return walkTo(edgeCell(), true, () => { say('!'); plan('away', 40000 + Math.random() * 80000); });
    }
  }

  // Go to a plant and eat it, bite by bite.
  function eatPlant(plant, fast) {
    const near = ground.cells
      .map((cell) => ({ cell, d: Math.hypot(cell[0] - plant.x, cell[1] - plant.z) }))
      .filter(({ d }) => d < ground.size * 3);
    // Leaves higher than her head: she stands on her hind legs to reach, a little closer in.
    const rear = plant.y + plant.height * 0.6 > plant.y + ground.size * 0.8;
    const want = ground.size * (rear ? 0.85 : 1.1);
    const spot = near.length
      ? near.reduce((a, b) => (Math.abs(b.d - want) < Math.abs(a.d - want) ? b : a)).cell
      : [plant.x, plant.z, plant.y];
    walkTo(spot, fast, () => { say(plant.words); plan('eat', 6000 + Math.random() * 3000, { plant, bite: 0, rear }); });
  }

  // The grim reaper: he comes up out of the figure, glides over and lies down beside her.
  let reaper = null;
  // 8-bit: a voxel figure in a few colours, front view, 12 blocks tall.
  const REAPER = [
    '....kkkk....', '...kkkkkk...', '...kffffk...', '...kfeefk...', '...kffffk...', '..kkkkkkkk..',
    '.kkkkkkkkkk.', '.kkkkkkkkkkh', '.kkkkkkkkkkh', '..kkkkkkkk.h', '..kkkkkkkk.h', '.kkkkkkkkkkh',
  ];
  const REAPER_INK = { k: '#15131a', f: '#2a2630', e: '#9be36a', h: '#5a4632' };
  function buildReaper() {
    const g = new THREE.Group();
    const unit = (ground.size * 1.5) / REAPER.length;
    const blocks = [];
    REAPER.forEach((row, y) => [...row].forEach((ch, x) => { if (REAPER_INK[ch]) blocks.push([x - 5.5, REAPER.length - 1 - y + 0.5, 0, REAPER_INK[ch]]); }));
    // the scythe blade, out to the right of the handle
    for (let x = 0; x < 4; x++) blocks.push([6.5 + x, 11.5 - x * 0.5, 0, '#c2c6cf']);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1.2), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), blocks.length);
    const m = new THREE.Matrix4(); const col = new THREE.Color();
    blocks.forEach(([x, y, z, c], n) => { mesh.setMatrixAt(n, m.makeTranslation(x, y, z)); mesh.setColorAt(n, col.set(c)); });
    mesh.scale.setScalar(unit);
    g.add(mesh);
    const sh = shadowBlob(ground.size * 0.6); sh.position.y = 0.01; g.add(sh);
    g.userData.height = ground.size * 1.5;
    return g;
  }
  function summonReaper() {
    if (reaper || !ground?.ghost) return;
    const g = buildReaper();
    g.position.set(ground.ghost[0], heightAt(ground.ghost[0], ground.ghost[2]), ground.ghost[2]);
    scene.add(g);
    reaper = { g, born: performance.now(), phase: 'rise', lie: 0 };
    say('…', 800);
  }
  function updateReaper(now, dt) {
    const { g } = reaper;
    const h = g.userData.height;
    if (reaper.phase === 'rise') {
      const k = Math.min(1, (now - reaper.born) / 2500);
      g.position.y = heightAt(g.position.x, g.position.z) - h * (1 - k) * 1.1;
      g.rotation.y += dt * 0.3;
      if (k >= 1) { reaper.phase = 'glide'; }
    } else if (reaper.phase === 'glide') {
      const side = new THREE.Vector2(Math.cos(holder.rotation.y), -Math.sin(holder.rotation.y)).multiplyScalar(ground.size * 1.3);
      const aim = new THREE.Vector2(holder.position.x + side.x, holder.position.z + side.y);
      const here = new THREE.Vector2(g.position.x, g.position.z);
      const to = aim.clone().sub(here);
      if (to.length() < ground.size * 0.2 || state.name !== 'sleep') reaper.phase = 'lie';
      else {
        here.add(to.normalize().multiplyScalar(Math.min(to.length(), ground.size * 1.2 * dt)));
        g.position.set(here.x, heightAt(here.x, here.y) + Math.sin(now / 300) * ground.size * 0.03, here.y);
        g.rotation.y = Math.atan2(to.x, to.y) + Math.PI;
      }
    } else if (reaper.phase === 'lie') {
      reaper.lie = Math.min(1, reaper.lie + dt * 0.5);
      g.rotation.z = -1.45 * reaper.lie;
      g.rotation.y = holder.rotation.y;
      if (Math.floor(now / 1000) % 5 === 0 && now > bubbleUntil) say('z z z   z z z', 1200);
      if (state.name !== 'sleep') { reaper.phase = 'sink'; reaper.born = now; }
    } else { // sink: back into the ground, gone
      const k = Math.min(1, (now - reaper.born) / 2000);
      g.position.y = heightAt(g.position.x, g.position.z) - h * k;
      if (k >= 1) { scene.remove(g); g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); reaper = null; }
    }
  }

  // Where she goes to meet the figure: the walkable cell nearest it that's also on screen
  // right now (the figure only shows from some angles), or nothing if it's out of view.
  function ghostSpot() {
    if (!ground?.ghost) return null;
    const ndc = new THREE.Vector3();
    ndc.set(ground.ghost[0], ground.ghost[1] + ground.size, ground.ghost[2]).project(camera);
    if (ndc.z > 1 || Math.abs(ndc.x) > 0.95 || Math.abs(ndc.y) > 0.95) return null;
    const seen = ground.cells.filter((c) => {
      ndc.set(c[0], c[2] + ground.size * 0.5, c[1]).project(camera);
      return ndc.z < 1 && Math.abs(ndc.x) < 0.8 && Math.abs(ndc.y) < 0.85;
    });
    if (!seen.length) return null;
    const [gx, gz] = [ground.ghost[0], ground.ghost[2]];
    return seen.reduce((a, b) => (Math.hypot(b[0] - gx, b[1] - gz) < Math.hypot(a[0] - gx, a[1] - gz) ? b : a));
  }

  function arrive() {
    const start = edgeCell();
    holder.position.set(start[0], heightAt(start[0], start[1]), start[1]);
    holder.visible = true;
    say(pick(['*appears*', 'mrrp', '*pads in*']));
    walkTo(nearHolder(), false, nextActivity);
  }

  // --- every frame ---

  const facing = new THREE.Vector3();
  const there = new THREE.Vector3();
  let nextBlink = 3;
  let blinkUntil = 0;

  function pose(t, dt) {
    const { body, head, eyes, tail, legs } = cat;
    const walking = state.name === 'walk' || state.name === 'run';
    const swing = walking ? Math.sin(t * (state.name === 'run' ? 18 : 9)) * (state.name === 'run' ? 0.7 : 0.4) : 0;
    legs.forEach((leg, i) => {
      leg.rotation.x = state.name === 'sleep' ? -1.4 : (i === 0 || i === 3 ? swing : -swing);
      leg.visible = state.name !== 'sleep' || cat.sprite;
    });
    const rearing = state.name === 'eat' && state.rear;
    const spooked = state.name === 'spook' && state.phase > 0;
    const puff = spooked ? 1.3 : 1;
    body.scale.x = puff; body.scale.z = spooked ? 1.15 : 1;
    tail.scale.setScalar(spooked ? 1.7 : 1);
    body.position.y = state.name === 'sleep' ? -0.3 : walking ? Math.abs(swing) * (state.name === 'run' ? 0.07 : 0.025) : rearing ? 0.22 : 0;
    // Breathing: a slow swell of the chest, deeper asleep.
    body.scale.y = 1 + Math.sin(t * (state.name === 'sleep' ? 1.1 : 1.8)) * (state.name === 'sleep' ? 0.03 : walking ? 0 : 0.014);
    const sitting = state.name === 'sit' || state.name === 'friendly';
    body.rotation.x = rearing ? -0.95 : sitting ? -0.28 : spooked ? 0.35 : 0;
    if (spooked) { body.position.y = 0.12 + Math.sin(t * 30) * 0.01; legs.forEach((l) => { l.rotation.x = 0; }); }
    if (rearing) { legs[0].rotation.x = legs[1].rotation.x = -1.1 + Math.sin(t * 8) * 0.08; legs[2].rotation.x = legs[3].rotation.x = 0.85; }
    body.rotation.z = state.name === 'friendly' ? Math.sin(t * 2.2) * 0.12 : 0; // rubbing against your leg
    if (sitting) { legs[2].rotation.x = legs[3].rotation.x = -1.2; }
    head.rotation.x = spooked ? 0.45 : state.name === 'spook' ? -0.1 + Math.sin(t * 2) * 0.15 : rearing ? 0.2 + Math.sin(t * 8) * 0.08 : state.name === 'eat' ? 0.55 + Math.sin(t * 8) * 0.08
      : state.name === 'sniff' ? 0.4 + Math.sin(t * 14) * 0.06
        : state.name === 'sleep' ? 0.35 : sitting ? 0.28 : 0;
    head.rotation.z = state.name === 'friendly' ? Math.sin(t * 1.4) * 0.18 : walking ? swing * 0.08 : 0; // the head tilt
    if (walking) head.rotation.x += Math.abs(swing) * 0.12; // a nod with each step
    if (!rearing && !sitting) body.rotation.z = walking ? -swing * 0.06 : body.rotation.z; // the hips roll
    // Sitting, she looks round at whoever's watching.
    head.rotation.y = sitting
      ? THREE.MathUtils.clamp(Math.atan2(camera.position.x - holder.position.x, camera.position.z - holder.position.z) - holder.rotation.y, -0.9, 0.9)
      : state.name === 'sleep' ? 0.6 : 0;
    eyes.visible = state.name !== 'sleep';
    // A blink now and then.
    if (t > nextBlink) { blinkUntil = t + 0.13; nextBlink = t + 2.5 + Math.random() * 5; }
    eyes.scale.y = t < blinkUntil ? 0.08 : 1;
    tail.rotation.y = state.name === 'sleep' ? 1.7 : Math.sin(t * (walking ? 3 : 1.2)) * 0.35;
    tail.rotation.x = spooked ? -1.3 + Math.sin(t * 20) * 0.1 : state.name === 'sleep' ? 0.9 : state.name === 'run' ? 0.5 : state.name === 'friendly' ? -0.35 + Math.sin(t * 9) * 0.04 : 0;

    if (cat.pendant) {
      // The hamsa swings out with each step and settles back when she stops.
      const bounce = walking ? Math.abs(Math.sin(t * (state.name === 'run' ? 18 : 9))) : 0;
      cat.pendant.rotation.x = -0.12 - bounce * (state.name === 'run' ? 0.7 : 0.4) + Math.sin(t * 2.3) * 0.05;
      cat.pendant.rotation.z = walking ? swing * 0.4 : Math.sin(t * 1.7) * 0.06;
      cat.pendant.position.y = cat.pendantY + bounce * 0.012;
    }
    if (cat.sprite) {
      const { material, textures, sprite } = cat.sprite;
      const step = Math.floor(t * (state.name === 'run' ? 14 : 7)) % 4; // four frames to a stride
      material.map = state.name === 'sleep' ? textures.sleep : rearing ? textures.rear
        : walking ? textures[`walk${step}`] : textures.stand;
      sprite.material.rotation = walking ? (step % 2 ? 0 : (step === 0 ? 0.03 : -0.03)) : 0;
      // Face left or right on screen, whichever way she's heading.
      facing.set(Math.sin(holder.rotation.y), 0, Math.cos(holder.rotation.y)).add(holder.position).project(camera);
      there.copy(holder.position).project(camera);
      material.map.repeat.x = facing.x < there.x ? -1 : 1;
      material.map.offset.x = facing.x < there.x ? 1 : 0;
      cat.sprite.sprite.position.y = (state.name === 'sleep' ? 0.45 : 0.64) + (walking && step % 2 ? 0.035 : 0); // up on the passing frames
    }
  }

  function update(time) {
    if (!ground) return;
    const now = performance.now();
    const t = time / 1000;
    const dt = Math.min(0.25, (now - (update.last ?? now)) / 1000);
    update.last = now;

    if (state.name === 'away') {
      holder.visible = false;
      if (now > state.until) arrive();
    } else if (state.name === 'walk' || state.name === 'run') {
      const here = new THREE.Vector2(holder.position.x, holder.position.z);
      const to = target.clone().sub(here);
      const left = to.length();
      if (left < ground.size * 0.3) {
        const next = then;
        then = null;
        next?.();
      } else {
        const heading = Math.atan2(to.x, to.y);
        let turn = heading - holder.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        holder.rotation.y += turn * Math.min(1, dt * 6);
        const stepLength = Math.min(left, speed * dt);
        here.add(to.normalize().multiplyScalar(stepLength));
        // Ease up and down, so on the blocky hill she hops from step to step.
        const y = THREE.MathUtils.lerp(holder.position.y, heightAt(here.x, here.y), Math.min(1, dt * 14));
        holder.position.set(here.x, y, here.y);
      }
    } else if (state.name === 'friendly' && now <= state.until) {
      // Turn the whole body towards whoever called her.
      let turn = Math.atan2(camera.position.x - holder.position.x, camera.position.z - holder.position.z) - holder.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      holder.rotation.y += turn * Math.min(1, dt * 4);
    } else if (now > state.until) {
      if (state.name === 'sleep') say('*stretches*');
      if (state.name === 'friendly') say('*wanders off, satisfied*');
      if (state.name === 'eat') say(pick(['*licks paw*', '*burp*', '*washes face*', '*satisfied*']));
      if (state.name === 'sniff' && state.figure) { say('*keeps an eye on it*', 2000); plan('sit', 5000); return; }
      nextActivity();
    }

    if (state.name === 'spook') {
      // Face the figure; after a curious moment the fur goes up, a sidestep, a hiss, then she bolts.
      let turn = Math.atan2(ground.ghost[0] - holder.position.x, ground.ghost[2] - holder.position.z) - holder.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      holder.rotation.y += turn * Math.min(1, dt * 4);
      const age = now - state.started;
      if (state.phase === 0 && age > 2200) { state.phase = 1; say('!!!', 1200); }
      if (state.phase === 1 && age > 3200) { state.phase = 2; say('HSSSSSS', 1600); onHiss?.(); }
      if (state.phase >= 1) { // sidestepping away from it, stiff-legged
        const away = new THREE.Vector2(holder.position.x - ground.ghost[0], holder.position.z - ground.ghost[2]).normalize();
        holder.position.x += away.x * dt * ground.size * 0.35;
        holder.position.z += away.y * dt * ground.size * 0.35;
        holder.position.y = heightAt(holder.position.x, holder.position.z);
      }
      if (age > 5200) { say('*bolts*', 1200); walkTo(edgeCell(), true, () => { say('…', 1000); plan('sit', 3000); }); }
    }
    if (reaper) updateReaper(now, dt);
    if (state.name === 'eat' && state.plant) {
      const { plant } = state;
      let turn = Math.atan2(plant.x - holder.position.x, plant.z - holder.position.z) - holder.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      holder.rotation.y += turn * Math.min(1, dt * 5);
      if (now - state.bite > 1100) {
        state.bite = now;
        plant.chomp();
        if (now > bubbleUntil) say(pick(['*chomp*', '*crunch*', '*munch*', '*chomp chomp*']), 900);
        if (!plant.left) { say('*all gone*'); state.until = now; }
      }
    }
    for (const plant of garden?.plants ?? []) plant.update(now);
    if (state.name === 'sleep' && Math.floor(t) % 4 === 0 && now > bubbleUntil) say('z z z', 1500);
    if (state.name === 'friendly' && now > bubbleUntil) say(pick(['♥', 'prrrr ♥', '♥ ♥', '*headbutt*', '*slow blink*', 'prrrrrrr', '*rubs on you*']), 1700);
    // Purr the whole time she's being friendly.
    if ((state.name === 'friendly') !== purring) {
      purring = state.name === 'friendly';
      onPurring?.(purring);
    }
    if (holder.visible) pose(t, dt);

    // Keep the bubble over her head.
    bubble.hidden = !holder.visible || now > bubbleUntil;
    if (!bubble.hidden) {
      there.copy(holder.position).add(new THREE.Vector3(0, ground.size * 1.6, 0)).project(camera);
      bubble.style.left = `${((there.x + 1) / 2) * canvas.clientWidth}px`;
      bubble.style.top = `${((1 - there.y) / 2) * canvas.clientHeight}px`;
    }
  }

  // Tap her and she changes form (and wakes up).
  let down = null;
  let pets = 0;
  let lastPet = 0;
  // Is the pointer on her, or on a plant? (Her tap target grows with her on-screen size.)
  const ray = new THREE.Raycaster();
  function under(e) {
    if (!ground) return {};
    const rect = canvas.getBoundingClientRect();
    if (holder.visible) {
      there.copy(holder.position).add(new THREE.Vector3(0, ground.size * 0.5, 0)).project(camera);
      const sx = rect.left + ((there.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - there.y) / 2) * rect.height;
      facing.copy(holder.position).add(new THREE.Vector3(0, ground.size, 0)).project(camera);
      const tall = Math.abs(((1 - facing.y) / 2) * rect.height - sy) * 2;
      if (there.z < 1 && Math.hypot(e.clientX - sx, e.clientY - sy) < Math.max(26, tall * 0.65)) return { her: true };
    }
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    if (ground.ghost && ray.ray.intersectsSphere(new THREE.Sphere(new THREE.Vector3(ground.ghost[0], ground.ghost[1] + ground.size * 1.6, ground.ghost[2]), ground.size * 2.6))) return { figure: true };
    if (!garden) return {};
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(garden.plants.map((p) => p.mesh), false)[0];
    return { plant: hit && garden.plants.find((p) => p.mesh === hit.object) };
  }
  let hoverAt = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.timeStamp - hoverAt < 80) return;
    hoverAt = e.timeStamp;
    const { her, plant, figure } = under(e);
    canvas.style.cursor = her || plant || figure ? 'pointer' : '';
  });

  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || !ground || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const { her, plant, figure } = under(e);
    if (figure && !her) {
      // The figure: she comes over to investigate. Usually a sniff and a long look;
      // one time in three it gets to her.
      if (!holder.visible) arrive();
      say(pick(['…?', 'mrr?', '*ears forward*']), 1200);
      walkTo(ghostSpot() ?? ground.ghostCell, false, () => {
        if (Math.random() < 0.34) { say('…?', 1500); plan('spook', 7000, { phase: 0 }); }
        else { say(pick(['*sniff*', '*stares at it*', 'hm.']), 2000); plan('sniff', 2500, { figure: true }); }
      });
      return;
    }
    if (!her) {
      // Not her: a plant? Then she comes running to eat that one.
      if (!plant) return;
      plant.wobble();
      if (state.name === 'eat' && state.plant === plant) { // already at it: another bite
        plant.chomp();
        say(pick(['*chomp*', '*nom*', '*crunch*']), 900);
        state.until = Math.max(state.until, performance.now() + 4000);
        return;
      }
      if (state.name === 'away' || !holder.visible) {
        const start = edgeCell();
        holder.position.set(start[0], heightAt(start[0], start[1]), start[1]);
        holder.visible = true;
      }
      say(pick(['MRRP!', '!!', '*eyes the plant*']), 1200);
      eatPlant(plant, true);
      return;
    }
    // Each pet turns her into her next form; ten in a row (no pause over two seconds)
    // and she purrs the kitchen away.
    const now = performance.now();
    pets = now - lastPet < 2000 ? pets + 1 : 1;
    lastPet = now;
    becomeForm(formIndex + 1);
    if (pets >= 10) {
      pets = 0;
      say('*PRRRRRRRRRR*', 2000);
      setTimeout(() => onTenPets?.(), 1400);
    } else {
      say(pets >= 7 ? 'PRRRR' : pets >= 4 ? 'prrr' : pick(['*poof*', '*shimmer*', 'mrrp!']));
    }
    if (state.name === 'sleep') nextActivity();
  });

  const api = {
    enter: (object, focus, plant, ghost) => measure(object, focus, plant, ghost).catch((error) => console.warn('salvia:', error)),
    leave: () => { measuring++; if (reaper) { scene.remove(reaper.g); reaper = null; } ground = null; holder.visible = false; bubble.hidden = true; quiet(); uproot(); },
    // A scene that knows its own ground: { heightAt, cells: [[x, z, y]], size, holderAt, plantCell? }.
    walkOn: (spec) => {
      measuring++;
      quiet();
      ground = { ...spec, size: spec.size * ON_THE_HILL };
      holder.scale.setScalar(ground.size / CAT_HEIGHT);
      plantFor('hill');
      plan('away', 1500 + Math.random() * 2500);
    },
    update,
    // Someone shook the treats: she comes running to a spot in front of the holder,
    // facing whoever's watching, and is very friendly for a while. Shaking again while
    // she's there keeps her longer.
    call() {
      if (!ground) return false;
      if (state.name === 'friendly') {
        state.until = Math.max(state.until, performance.now() + 9000);
        say(pick(['♥ ♥ ♥', 'PRRRR ♥', '*nom?*']));
        return true;
      }
      // A spot she'll be seen in: low in the middle of the screen, as the camera is now.
      const ndc = new THREE.Vector3();
      const inView = ground.cells.map((cell) => {
        ndc.set(cell[0], cell[2] + ground.size * 0.5, cell[1]).project(camera);
        return { cell, x: ndc.x, y: ndc.y, z: ndc.z };
      }).filter((c) => c.z < 1 && Math.abs(c.x) < 0.45 && c.y > -0.8 && c.y < 0.1);
      const [hx, hz] = ground.holderAt;
      const toward = [hx + (camera.position.x - hx) * 0.3, hz + (camera.position.z - hz) * 0.3];
      const spot = inView.length
        ? inView.reduce((a, b) => (Math.hypot(b.x, b.y + 0.45) < Math.hypot(a.x, a.y + 0.45) ? b : a)).cell
        : ground.cells.reduce((best, cell) => (
          Math.hypot(cell[0] - toward[0], cell[1] - toward[1]) < Math.hypot(best[0] - toward[0], best[1] - toward[1]) ? cell : best));
      if (state.name === 'away' || !holder.visible) {
        const start = edgeCell();
        holder.position.set(start[0], heightAt(start[0], start[1]), start[1]);
        holder.visible = true;
      }
      say(pick(['MRROW!', 'MRRP?!', '!!!']), 1400);
      walkTo(spot, true, () => plan('friendly', 12000));
      return true;
    },
    // Things the camera can lock onto: [{ name, point: [x, y, z], size }].
    landmarks() {
      if (!ground) return [];
      const list = [];
      if (holder.visible) list.push({ name: 'Salvia', point: [holder.position.x, holder.position.y + ground.size * 0.5, holder.position.z], size: ground.size * 1.2 });
      const [hx, hz] = ground.holderAt;
      if (ground.heightAt) list.push({ name: 'the crest', point: [hx, heightAt(hx, hz) + ground.size, hz], size: ground.size * 4 });
      else {
        const tall = ground.size / OF_HOLDER;
        list.push({ name: 'the holder', point: [hx, ground.floor + tall * 0.5, hz], size: tall * 0.9 });
      }
      for (const p of garden?.plants ?? []) list.push({ name: p.name, point: [p.x, p.y + p.height * 0.5, p.z], size: p.height * 0.9 });
      if (ground.ghost) list.push({ name: 'the figure', point: [ground.ghost[0], ground.ghost[1] + ground.size * 1.5, ground.ghost[2]], size: ground.size * 3 });
      return list;
    },
    // Seen or not: hidden while the camera looks through her eyes.
    set seen(on) { if (cat) cat.root.visible = on; shadow.visible = on; },
    get size() { return ground?.size ?? 0; },
    get pixelFrames() { return cat?.sprite?.textures ?? null; }, // for checking the drawings
    get state() { return state.name; },
    get plants() { return garden?.plants ?? []; },
    eat: (index) => { if (!garden?.plants[index]) return; if (!holder.visible) arrive(); eatPlant(garden.plants[index], true); },
    get ground() { return ground && { floor: ground.floor, size: ground.size, holderAt: ground.holderAt, cells: ground.cells.length, plantCell: ground.plantCell }; },
    get where() { return holder.visible ? holder.position.toArray() : null; },
    get heading() { return holder.rotation.y; },
    get form() { return FORMS[formIndex]; },
    becomeForm,
    summon: () => { if (ground) { plan('away', 0); } },
    investigate: () => {
      if (!ground) { pending = () => api.investigate(); return; }
      if (!ground.ghostCell) return;
      if (!holder.visible) arrive();
      say(pick(['…?', 'mrr?', '*ears forward*']), 1200);
      walkTo(ghostSpot() ?? ground.ghostCell, false, () => { say(pick(['*sniff*', '*stares at it*', 'hm.']), 2000); plan('sniff', 2500, { figure: true }); });
    },
    spook: () => { if (!ground) { pending = () => api.spook(); return; } if (ground.ghostCell) { if (!holder.visible) arrive(); walkTo(ghostSpot() ?? ground.ghostCell, true, () => { say('…?', 1500); plan('spook', 7000, { phase: 0 }); }); } },
    ghostnap: () => { if (!ground) { pending = () => api.ghostnap(); return; } if (ground.ghostCell) { if (!holder.visible) arrive(); walkTo(ghostSpot() ?? ground.ghostCell, true, () => { plan('sleep', 40000, { reaper: true }); setTimeout(summonReaper, 1500); }); } },
  };
  return api;
}
