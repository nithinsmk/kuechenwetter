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

const FORMS = ['splat', 'pixel', 'cartoon'];
const CAT_HEIGHT = 1.05; // in cat units, ears included
const OF_HOLDER = 2.5 / 8; // her height against the cutlery holder's (first an eighth, now 2.5 times that)
const ON_THE_HILL = 2.5; // and 2.5 times her first size on the hill too

// --- her shape, in cat units: facing +z, feet at y = 0 ---

const WHITE = new THREE.Color('#f4f3ef');
const SHADE = new THREE.Color('#d9d8dc');
const EAR = new THREE.Color('#c7b3b8');
const EYE = new THREE.Color('#8dbb4f');
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
const FACE = [ // eyes, pupils, nose
  { c: [0.085, 0.15, 0.285], r: [0.042, 0.032, 0.015], n: 30, color: EYE, size: 0.018 },
  { c: [-0.085, 0.15, 0.285], r: [0.042, 0.032, 0.02], n: 30, color: EYE, size: 0.018 },
  { c: [0.085, 0.15, 0.302], r: [0.01, 0.026, 0.006], n: 8, color: PUPIL, size: 0.01 },
  { c: [-0.085, 0.15, 0.302], r: [0.01, 0.026, 0.008], n: 8, color: PUPIL, size: 0.01 },
  { c: [0, 0.08, 0.3], r: [0.022, 0.015, 0.01], n: 10, color: NOSE, size: 0.012 },
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
          scales.set(size * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6));
          quaternion.random();
          if (s.color) color.copy(s.color);
          else if (colorOf) color.copy(colorOf(s, d));
          else color.copy(WHITE).lerp(SHADE, Math.max(0, -d.y) * 0.8 + Math.random() * 0.12);
          splats.pushSplat(center, scales, quaternion, s.color ? 1 : 0.82, color);
        }
      }
    },
  });
}

function buildSplat() {
  const r = rig();
  r.body.add(furSplats(BODY));
  r.head.add(furSplats(HEAD));
  r.head.add(furSplats(EARS, { colorOf: (s, d) => (d.z > 0.2 ? EAR : WHITE) }));
  r.eyes.add(furSplats(FACE.slice(0, 4)));
  r.head.add(furSplats(FACE.slice(4)));
  r.tail.add(furSplats(TAIL));
  for (const leg of r.legs) leg.add(furSplats(LEG));
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
    add(r.head, new THREE.ConeGeometry(0.09, 0.18, 4), fur, [side * 0.17, 0.42, 0.06], [1, 1, 0.7], [0, Math.PI / 4, -side * 0.35]);
    add(r.head, new THREE.ConeGeometry(0.055, 0.12, 4), material('#e4b3a6'), [side * 0.165, 0.41, 0.11], [1, 1, 0.4], [0, Math.PI / 4, -side * 0.35]);
    add(r.eyes, ball(1), material('#5a78b8', 0.3), [side * 0.11, 0.17, 0.365], [0.075, 0.08, 0.035]);
    add(r.eyes, ball(1), material(PUPIL, 0.2), [side * 0.11, 0.17, 0.392], [0.035, 0.062, 0.02]);
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
  return r;
}

// Pixel art, 16 × 12, facing right. k outline, w white, s shade, p pink, e green eye.
const PIXELS = {
  stand: [
    '..........k...k.', '.........kpk.kpk', '.........kwwwwwk', '.........kwewewk',
    '.kk......kwwpwwk', '.kwk.kkkkkwwwwk.', '..kwkwwwwwwwwwk.', '...kwwwwwwwwwsk.',
    '...kswwwwwwwwsk.', '....kssssssssk..', '....kwk...kwk...', '....kwwk..kwwk..'],
  walk: [
    '..........k...k.', '.........kpk.kpk', '.........kwwwwwk', '.........kwewewk',
    '.kk......kwwpwwk', '.kwk.kkkkkwwwwk.', '..kwkwwwwwwwwwk.', '...kwwwwwwwwwsk.',
    '...kswwwwwwwwsk.', '....kssssssssk..', '...kwk.....kwk..', '...kwwk....kwwk.'],
  walk2: [
    '..........k...k.', '.........kpk.kpk', '.........kwwwwwk', '.........kwewewk',
    '.kk......kwwpwwk', '.kwk.kkkkkwwwwk.', '..kwkwwwwwwwwwk.', '...kwwwwwwwwwsk.',
    '...kswwwwwwwwsk.', '....kssssssssk..', '.....kwk.kwk....', '.....kwwkkwwk...'],
  sleep: [
    '................', '................', '................', '................',
    '................', '..........k..k..', '.....kkkkkwkkwk.', '...kkwwwwwwwwwwk',
    '..kwwwwwwwwkwkwk', '.kwwwwwwwwwwwpwk', '.kswwwwwwwwwwwsk', '..kkkkkkkkkkkkk.'],
};
const INK = { k: '#55555a', w: '#f6f6f3', s: '#d3d3d8', p: '#e6a3ad', e: '#86b54a' };

function pixelTexture(rows) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 12;
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
  const material = new THREE.SpriteMaterial({ map: textures.stand, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.45, 1.1, 1);
  sprite.position.y = 0.55;
  r.root.add(sprite);
  r.body.visible = false; // the sprite stands in for the whole rig
  r.sprite = { sprite, material, textures };
  return r;
}

const BUILD = { splat: buildSplat, pixel: buildPixel, cartoon: buildCartoon };

// --- the daemon ---

export function makeSalvia({ scene, camera, canvas, onTenPets, onPurring }) {
  const holder = new THREE.Group(); // her place in the world: ground position and heading
  holder.visible = false;
  scene.add(holder);
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
  async function measure(object, focus, plant, tries = 0) {
    const id = ++measuring;
    quiet();
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
      if (tries < 10) setTimeout(() => measure(object, focus, plant, tries + 1), 1500);
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
    ground = { floor, size, holderAt, cells, plant, plantCell, grid, step, c };
    holder.scale.setScalar(size / CAT_HEIGHT);
    plan('away', 3000 + Math.random() * 4000);
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
  const quiet = () => { if (purring) { purring = false; onPurring?.(false); } };
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
    if (ground.plantCell) options.push('plant', 'plant');
    switch (pick(options)) {
      case 'wander': return walkTo(pick(ground.cells), false, nextActivity);
      case 'sniff': return walkTo(pick(ground.cells), false, () => { say('*sniff sniff*'); plan('sniff', 2500 + Math.random() * 2000); });
      case 'checkin': return walkTo(nearHolder(), false, () => { say(pick(['mrrp', 'mrrp?', '*checks in*'])); plan('sit', 4000 + Math.random() * 3000); });
      case 'plant': return walkTo(ground.plantCell, false, () => { say(ground.plantWords ?? '*nom nom* (your plant)'); plan('eat', 5000 + Math.random() * 3000); });
      case 'sleep': return walkTo(pick(ground.cells), false, () => plan('sleep', 20000 + Math.random() * 25000));
      default: return walkTo(edgeCell(), true, () => { say('!'); plan('away', 40000 + Math.random() * 80000); });
    }
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

  function pose(t, dt) {
    const { body, head, eyes, tail, legs } = cat;
    const walking = state.name === 'walk' || state.name === 'run';
    const swing = walking ? Math.sin(t * (state.name === 'run' ? 18 : 9)) * (state.name === 'run' ? 0.7 : 0.4) : 0;
    legs.forEach((leg, i) => {
      leg.rotation.x = state.name === 'sleep' ? -1.4 : (i === 0 || i === 3 ? swing : -swing);
      leg.visible = state.name !== 'sleep' || cat.sprite;
    });
    body.position.y = state.name === 'sleep' ? -0.3 : walking ? Math.abs(swing) * 0.02 : 0;
    const sitting = state.name === 'sit' || state.name === 'friendly';
    body.rotation.x = sitting ? -0.28 : 0;
    body.rotation.z = state.name === 'friendly' ? Math.sin(t * 2.2) * 0.12 : 0; // rubbing against your leg
    if (sitting) { legs[2].rotation.x = legs[3].rotation.x = -1.2; }
    head.rotation.x = state.name === 'eat' ? 0.55 + Math.sin(t * 8) * 0.08
      : state.name === 'sniff' ? 0.4 + Math.sin(t * 14) * 0.06
        : state.name === 'sleep' ? 0.35 : sitting ? 0.28 : 0;
    head.rotation.z = state.name === 'friendly' ? Math.sin(t * 1.4) * 0.18 : 0; // the head tilt
    // Sitting, she looks round at whoever's watching.
    head.rotation.y = sitting
      ? THREE.MathUtils.clamp(Math.atan2(camera.position.x - holder.position.x, camera.position.z - holder.position.z) - holder.rotation.y, -0.9, 0.9)
      : state.name === 'sleep' ? 0.6 : 0;
    eyes.visible = state.name !== 'sleep';
    tail.rotation.y = state.name === 'sleep' ? 1.7 : Math.sin(t * (walking ? 3 : 1.2)) * 0.35;
    tail.rotation.x = state.name === 'sleep' ? 0.9 : state.name === 'run' ? 0.5 : state.name === 'friendly' ? -0.35 + Math.sin(t * 9) * 0.04 : 0;

    if (cat.sprite) {
      const { material, textures } = cat.sprite;
      material.map = state.name === 'sleep' ? textures.sleep
        : walking ? (Math.sin(t * (state.name === 'run' ? 18 : 9)) > 0 ? textures.walk : textures.walk2) : textures.stand;
      // Face left or right on screen, whichever way she's heading.
      facing.set(Math.sin(holder.rotation.y), 0, Math.cos(holder.rotation.y)).add(holder.position).project(camera);
      there.copy(holder.position).project(camera);
      material.map.repeat.x = facing.x < there.x ? -1 : 1;
      material.map.offset.x = facing.x < there.x ? 1 : 0;
      cat.sprite.sprite.position.y = state.name === 'sleep' ? 0.4 : 0.55;
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
      nextActivity();
    }

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
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || !holder.visible || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const rect = canvas.getBoundingClientRect();
    there.copy(holder.position).add(new THREE.Vector3(0, ground.size * 0.5, 0)).project(camera);
    const sx = rect.left + ((there.x + 1) / 2) * rect.width;
    const sy = rect.top + ((1 - there.y) / 2) * rect.height;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 28) return;
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

  return {
    enter: (object, focus, plant) => measure(object, focus, plant).catch((error) => console.warn('salvia:', error)),
    leave: () => { measuring++; ground = null; holder.visible = false; bubble.hidden = true; quiet(); },
    // A scene that knows its own ground: { heightAt, cells: [[x, z, y]], size, holderAt, plantCell? }.
    walkOn: (spec) => {
      measuring++;
      quiet();
      ground = { ...spec, size: spec.size * ON_THE_HILL };
      holder.scale.setScalar(ground.size / CAT_HEIGHT);
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
    get state() { return state.name; },
    get ground() { return ground && { floor: ground.floor, size: ground.size, holderAt: ground.holderAt, cells: ground.cells.length, plantCell: ground.plantCell }; },
    get where() { return holder.visible ? holder.position.toArray() : null; },
    get heading() { return holder.rotation.y; },
    get form() { return FORMS[formIndex]; },
    becomeForm,
    summon: () => { if (ground) { plan('away', 0); } },
  };
}
