// Little 8-bit plants for Salvia to chomp, after the ones in Berlin kitchens: the mini
// acacia palm, the Japanese maple bonsai in its rectangular pot, a parlour palm and a fan
// palm (cuttings in IKEA glasses of water), a monstera on a moss pole in terracotta, a
// spider plant and a papyrus in glasses too, and a snake plant in a dark pot. Each is built
// from voxels in a small palette and stands on the ground she walks on, a few times her
// height. Each scene draws 4 or 5 of them (the same kind can come twice). When she eats one
// its leaves go, chomp by chomp, and grow back later.
import * as THREE from 'three';

// --- building with voxels: grid units, y up, the pot's bottom at y = 0 ---

function sketch() {
  const voxels = [];
  const put = (x, y, z, colour, leaf = false) => voxels.push({ x, y, z, colour, leaf });
  return { voxels, put };
}

function roundPot(p, r, h, body, rim, soil = '#3e2a1a') {
  for (let y = 0; y < h; y++) {
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        const d = x * x + z * z;
        if (d > (r + 0.4) ** 2 || (y === 0 && d > r * r)) continue;
        const top = y === h - 1;
        p.put(x, y, z, top && d <= (r - 0.6) ** 2 ? soil : top ? rim : body);
      }
    }
  }
}

// An IKEA tumbler (the thick-bottomed POKAL kind) of water: a clear base, a rim, two
// highlight lines up the side, water inside with a few pale roots. The plant rises from it.
function glass(p, r, h, rng) {
  for (let y = 0; y < h; y++) {
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        const d = x * x + z * z;
        if (d > (r + 0.4) ** 2) continue;
        const wall = d > (r - 0.6) ** 2;
        const shine = (x === -r && z >= 0) || (z === r && x === -1);
        if (y === 0) p.put(x, y, z, '#cfe6ee'); // the thick bottom
        else if (wall) p.put(x, y, z, y === h - 1 ? '#f4fbfd' : shine ? '#ffffff' : y < h - 1 ? '#a9d8e8' : '#e3f3f8');
        else if (y === h - 2) p.put(x, y, z, rng() < 0.2 ? '#e8dfbe' : '#7fc2dc'); // the water's surface, roots in it
      }
    }
  }
}

// A frond: a line going out from (x, y, z) in a direction, drooping, with leaflets.
function frond(p, [x0, y0, z0], angle, length, droop, greens, rng) {
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  for (let s = 1; s <= length; s++) {
    const x = Math.round(x0 + dx * s);
    const z = Math.round(z0 + dz * s);
    const y = Math.round(y0 + s * 0.6 - (s * s) / droop);
    p.put(x, y, z, greens[s % greens.length], true);
    if (s >= 2 && s < length) { // leaflets either side, hanging a little lower
      p.put(Math.round(x - dz), y - 1, Math.round(z + dx), greens[(s + 1) % greens.length], true);
      p.put(Math.round(x + dz), y - 1, Math.round(z - dx), greens[(s + 2) % greens.length], true);
    }
    if (rng() < 0.08) p.put(x, y + 1, z, greens[0], true);
  }
}

function acacia(rng) {
  const p = sketch();
  glass(p, 2, 4, rng);
  for (let k = 0; k < 10; k++) p.put(Math.round(k * 0.12), 4 + k, 0, k % 2 ? '#8a5a32' : '#6e4526');
  const top = [1, 13, 0];
  const greens = ['#4f9a2c', '#6fbf3a', '#3f8424'];
  for (let a = 0; a < 7; a++) frond(p, top, a * ((2 * Math.PI) / 7) + 0.3, 6, 7, greens, rng);
  for (const [x, y, z] of [[1, 14, 0], [0, 14, 0], [1, 14, 1], [2, 14, 0], [1, 15, 0]]) p.put(x, y, z, greens[1], true);
  // acacia puffs: little yellow pom-poms in the crown
  for (let k = 0; k < 7; k++) {
    const a = rng() * Math.PI * 2;
    const s = 1 + Math.floor(rng() * 4);
    p.put(Math.round(1 + Math.cos(a) * s), 14 - Math.floor(s / 2), Math.round(Math.sin(a) * s), '#f2d23c', true);
  }
  return p.voxels;
}

function bonsai(rng) {
  const p = sketch();
  for (const [x, z] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) p.put(x, 0, z, '#2a3540'); // feet
  for (let y = 1; y <= 2; y++) {
    for (let x = -4; x <= 4; x++) {
      for (let z = -2; z <= 2; z++) {
        const inside = Math.abs(x) < 4 && Math.abs(z) < 2;
        p.put(x, y, z, y === 2 && inside ? (rng() < 0.25 ? '#5a8a3a' : '#3a2a1a') : y === 2 ? '#4a5d70' : '#3b4a5a');
      }
    }
  }
  const trunk = [[-1, 3], [-1, 4], [0, 5], [1, 6], [1, 7], [0, 8], [0, 9], [-1, 8], [-2, 8], [2, 7], [3, 7]];
  for (const [x, y] of trunk) p.put(x, y, 0, '#5a3a22');
  const reds = ['#c8321e', '#e0502a', '#a8241a', '#f07a3a'];
  const pad = (cx, cy, cz, rx, ry, rz) => {
    for (let x = -rx; x <= rx; x++) {
      for (let y = -ry; y <= ry; y++) {
        for (let z = -rz; z <= rz; z++) {
          if ((x / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2 + (z / (rz + 0.5)) ** 2 > 1) continue;
          p.put(cx + x, cy + y, cz + z, reds[Math.floor(rng() * reds.length)], true);
        }
      }
    }
  };
  pad(-3, 9, 0, 2, 1, 2);
  pad(4, 8, 0, 2, 1, 2);
  pad(0, 11, 0, 2, 1, 2);
  return p.voxels;
}

function parlourPalm(rng) {
  const p = sketch();
  glass(p, 2, 4, rng);
  const greens = ['#3f8f2c', '#5aa83a', '#2f7a24'];
  for (let k = 0; k < 5; k++) {
    const a = k * ((2 * Math.PI) / 5) + rng();
    const h = 7 + Math.floor(rng() * 4);
    let x = 0;
    let z = 0;
    for (let y = 4; y < 4 + h; y++) {
      x = Math.round(Math.cos(a) * (y - 4) * 0.22);
      z = Math.round(Math.sin(a) * (y - 4) * 0.22);
      p.put(x, y, z, '#4c7a2a');
    }
    frond(p, [x, 4 + h, z], a, 5, 6, greens, rng);
  }
  return p.voxels;
}

function fanPalm(rng) {
  const p = sketch();
  glass(p, 2, 3, rng);
  for (let y = 3; y < 7; y++) p.put(0, y, 0, y % 2 ? '#7a5a3a' : '#5e4430');
  const greens = ['#4c8f3a', '#6aa84a', '#3b7a2e'];
  for (let k = 0; k < 6; k++) {
    const a = k * ((2 * Math.PI) / 6) + 0.4;
    const dir = [Math.cos(a), Math.sin(a)];
    const side = [-dir[1], dir[0]];
    const end = [dir[0] * 3, 9 + (k % 2), dir[1] * 3];
    for (let s = 1; s <= 3; s++) p.put(Math.round(dir[0] * s), 6 + s, Math.round(dir[1] * s), '#6a7a3a');
    // the fan: a half disc of leaf, standing up, facing outward
    for (let s = -3; s <= 3; s++) {
      for (let u = 0; u <= 3; u++) {
        if (s * s + u * u > 10) continue;
        p.put(Math.round(end[0] + side[0] * s + dir[0] * u * 0.4), end[1] + u, Math.round(end[2] + side[1] * s + dir[1] * u * 0.4),
          greens[(s + u + 9) % 3], true);
      }
    }
    if (rng() < 0.3) p.put(Math.round(end[0]), end[1] + 4, Math.round(end[2]), greens[1], true);
  }
  return p.voxels;
}

// Monstera deliciosa: big split leaves on long stalks, climbing a moss pole, terracotta pot.
function monstera(rng) {
  const p = sketch();
  roundPot(p, 3, 4, '#b65a32', '#c86c40');
  for (let y = 4; y < 17; y++) p.put(0, y, 0, y % 3 ? '#6b5a3a' : '#5f7a34'); // the moss pole
  const greens = ['#2f7a2a', '#3f9a36', '#2a6a26'];
  for (let k = 0; k < 5; k++) {
    const a = k * 2.4 + rng() * 0.6;
    const dir = [Math.cos(a), Math.sin(a)];
    const side = [-dir[1], dir[0]];
    const y0 = 5 + k * 2.2;
    const reach = 3 + Math.floor(rng() * 2);
    for (let s = 1; s <= reach; s++) p.put(Math.round(dir[0] * s), Math.round(y0 + s * 0.5), Math.round(dir[1] * s), '#4f8a3a');
    const c = [dir[0] * (reach + 4), y0 + reach * 0.5, dir[1] * (reach + 4)];
    for (let s = -4; s <= 4; s++) {
      for (let t = -4; t <= 4; t++) {
        const heart = (s * s) / 17 + (t * t) / (s < 0 ? 12 : 17); // wider at the stalk end
        if (heart > 1) continue;
        if (Math.abs(t) >= 2 && (s + 4) % 2 === 0) continue; // the splits, in from the edge
        if (t === 0 && s > -4) { p.put(Math.round(c[0] + dir[0] * s), Math.round(c[1] - s * 0.25), Math.round(c[2] + dir[1] * s), '#7cbf4a', true); continue; } // the midrib
        p.put(Math.round(c[0] + dir[0] * s + side[0] * t), Math.round(c[1] - s * 0.25 - Math.abs(t) * 0.3),
          Math.round(c[2] + dir[1] * s + side[1] * t), greens[(s + t + 9) % 3], true);
      }
    }
  }
  return p.voxels;
}

// Spider plant (Chlorophytum comosum): arching striped blades, and runners with babies.
function spiderPlant(rng) {
  const p = sketch();
  glass(p, 2, 4, rng);
  for (let k = 0; k < 16; k++) {
    const a = k * 0.39 + rng() * 0.3;
    const length = 6 + Math.floor(rng() * 4);
    const colour = k % 4 === 0 ? '#e9ecc4' : k % 2 ? '#6fb43e' : '#4f9a2c';
    for (let s = 1; s <= length; s++) {
      p.put(Math.round(Math.cos(a) * s * 0.7), Math.round(4 + s * 1.5 - (s * s) / 6.5), Math.round(Math.sin(a) * s * 0.7), colour, true);
    }
  }
  for (let k = 0; k < 2; k++) { // runners hanging over the rim, a little plantlet at each end
    const a = rng() * Math.PI * 2;
    let end = [0, 0, 0];
    for (let s = 1; s <= 6; s++) {
      end = [Math.round(Math.cos(a) * s), Math.round(5 + s * 0.4 - (s * s) / 6), Math.round(Math.sin(a) * s)];
      p.put(...end, '#cfd6a0');
    }
    for (const [x, y, z] of [[0, 0, 0], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]]) p.put(end[0] + x, end[1] + y, end[2] + z, x || z ? '#4f9a2c' : '#e9ecc4', true);
  }
  return p.voxels;
}

// Snake plant (Sansevieria): stiff upright blades, banded, yellow at the edge, dark pot.
function snakePlant(rng) {
  const p = sketch();
  roundPot(p, 2, 4, '#2d2d2d', '#3a3a3a');
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05 + rng() * 0.4;
    const base = [Math.round(Math.cos(a) * 1), Math.round(Math.sin(a) * 1)];
    const lean = [Math.cos(a) * 0.12, Math.sin(a) * 0.12];
    const flat = [-Math.sin(a), Math.cos(a)];
    const h = 8 + Math.floor(rng() * 5);
    for (let y = 0; y < h; y++) {
      const width = y > h - 3 ? 0 : 1; // pointed at the top
      for (let w = -width; w <= width; w++) {
        const edge = w !== 0;
        const colour = edge ? (y % 2 ? '#c9c04a' : '#3f6a32') : (y % 3 === 0 ? '#6a9a52' : '#2f5a2a');
        p.put(Math.round(base[0] + lean[0] * y + flat[0] * w * 0.6), 4 + y, Math.round(base[1] + lean[1] * y + flat[1] * w * 0.6), colour, true);
      }
    }
  }
  return p.voxels;
}

// Papyrus / umbrella sedge (Cyperus): thin stems, each with a burst of drooping rays on top.
function papyrus(rng) {
  const p = sketch();
  glass(p, 2, 5, rng);
  const greens = ['#7cbf3a', '#9fd04a', '#5e9a34'];
  for (let k = 0; k < 5; k++) {
    const a = k * 1.26 + rng() * 0.5;
    const tilt = 0.2 + rng() * 0.12;
    const h = 8 + Math.floor(rng() * 6);
    let top = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      top = [Math.round(Math.cos(a) * y * tilt), 5 + y, Math.round(Math.sin(a) * y * tilt)];
      p.put(...top, '#5e9a34');
    }
    for (let ray = 0; ray < 6; ray++) {
      const b = ray * (Math.PI / 3) + rng() * 0.4;
      for (let s = 1; s <= 3; s++) {
        p.put(Math.round(top[0] + Math.cos(b) * s), top[1] + 1 - Math.floor((s * s) / 4), Math.round(top[2] + Math.sin(b) * s), greens[(ray + s) % 3], true);
      }
    }
  }
  return p.voxels;
}

export const KINDS = [
  { name: 'acacia', build: acacia, height: 3.0, words: '*nom* (the acacia palm)' },
  { name: 'bonsai', build: bonsai, height: 1.9, words: '*nom* (the maple bonsai!)' },
  { name: 'parlour palm', build: parlourPalm, height: 2.7, words: '*nom* (a palm)' },
  { name: 'fan palm', build: fanPalm, height: 2.4, words: '*munch* (the fan palm)' },
  { name: 'monstera', build: monstera, height: 3.4, words: '*chomp* (the monstera!)' },
  { name: 'spider plant', build: spiderPlant, height: 2.2, words: '*nom nom* (the spider plant)' },
  { name: 'snake plant', build: snakePlant, height: 2.6, words: '*crunch* (the snake plant)' },
  { name: 'papyrus', build: papyrus, height: 3.0, words: '*nibble* (the papyrus)' },
];

// --- a garden for one scene ---

export function seeded(text) {
  let a = 2166136261;
  for (const ch of text) a = Math.imul(a ^ ch.codePointAt(0), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

// A soft dark blob on the ground, so things sit in the scan rather than float on it.
let shadowTexture = null;
export function shadowBlob(radius) {
  if (!shadowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    shadowTexture = new THREE.CanvasTexture(canvas);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

export function grow(kind, rng, size) {
  const voxels = kind.build(rng);
  const top = Math.max(...voxels.map((v) => v.y)) + 1;
  const unit = (kind.height * size) / top; // one voxel, in the world
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), voxels.length);
  const matrices = voxels.map((v) => new THREE.Matrix4().makeTranslation(v.x, v.y + 0.5, v.z));
  const colour = new THREE.Color();
  voxels.forEach((v, n) => { mesh.setMatrixAt(n, matrices[n]); mesh.setColorAt(n, colour.set(v.colour)); });
  mesh.scale.setScalar(unit);
  const leaves = voxels.map((v, n) => (v.leaf ? n : -1)).filter((n) => n >= 0);
  return { mesh, matrices, leaves, unit, top };
}

// Salvia's mattress: the fridge sticker as a little bed, fringed at both ends like a kilim,
// hovering a little over the counter like Aladdin's carpet.
// The top has the label's blue tiles and evil-eye beads round the edge, and inside a
// tessellation of 16-pixel tiles: an evil eye in a diamond in each, eight-point stars where
// four tiles meet, joined by pale lines, with a little gold at each star's heart (the one
// warm colour). A cosy place for her to rest. Her pillow is a pixel cloud.
const INK = { n: '#1d3a8a', b: '#2f6fd0', l: '#9cc8ef', w: '#ffffff', k: '#111111' };
function bedTop() {
  const W = 112; // 6 × 4 tiles inside the border
  const H = 80;
  const B = 8;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const dot = (x, y, c) => { ctx.fillStyle = INK[c] ?? c; ctx.fillRect(x, y, 1, 1); };
  // the tessellation
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x - B) % 16;
    const v = (y - B) % 16;
    const cu = u - 7.5; // from the tile's centre
    const cv = v - 7.5;
    const qu = ((u + 8) % 16) - 7.5; // from the corner where four tiles meet
    const qv = ((v + 8) % 16) - 7.5;
    const eye = Math.hypot(cu, cv);
    const ring = Math.abs(cu) + Math.abs(cv);
    const star = (Math.abs(qu) <= 2.5 && Math.abs(qv) <= 2.5) || Math.abs(qu) + Math.abs(qv) <= 3.6;
    let c = '#fbf6ec'; // cream
    if (eye < 1.3) c = 'k';
    else if (eye < 2.3) c = 'l';
    else if (eye < 3.3) c = 'w';
    else if (eye < 4.3) c = 'n';
    else if (ring >= 5.6 && ring < 6.6) c = 'b'; // the diamond round each eye
    else if (star) c = Math.abs(qu) < 1 && Math.abs(qv) < 1 ? '#e8a838' : Math.abs(qu) + Math.abs(qv) > 2.6 ? 'b' : 'l';
    else if (Math.abs(qu) < 0.6 || Math.abs(qv) < 0.6) c = '#d4e4f4'; // pale lines from star to star
    dot(x, y, c);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let u; let v;
    if (y < B) [u, v] = [x, y]; else if (y >= H - B) [u, v] = [x, H - 1 - y];
    else if (x < B) [u, v] = [y, x]; else if (x >= W - B) [u, v] = [y, W - 1 - x];
    else continue;
    if (v === 0 || v === B - 1) { dot(x, y, 'n'); continue; }
    const d = Math.abs((u % 8) - 3.5) + Math.abs(v - 3.5);
    dot(x, y, d < 1.5 ? 'n' : d < 2.5 ? 'w' : d < 3.5 ? 'l' : 'b');
  }
  const bead = (cx, cy) => {
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const r = Math.hypot(x, y);
      if (r <= 4.9) dot(cx + x, cy + y, r > 3.8 ? 'n' : r > 2.7 ? 'w' : r > 1.6 ? 'l' : 'k');
    }
    dot(cx - 1, cy - 1, 'w');
  };
  for (const [x, y] of [[3.5, 3.5], [W - 4.5, 3.5], [3.5, H - 4.5], [W - 4.5, H - 4.5], [W / 2, 3.5], [W / 2, H - 4.5]]) bead(Math.round(x), Math.round(y));
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The sides: the border's band of blue tiles, one tile square, repeated along every edge.
function bedSide() {
  const T = 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = T;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const d = Math.abs(x - 3.5) + Math.abs(y - 3.5);
    ctx.fillStyle = INK[y === 0 || y === T - 1 ? 'n' : d < 1.5 ? 'n' : d < 2.5 ? 'w' : d < 3.5 ? 'l' : 'b'];
    ctx.fillRect(x, y, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A tiny pixel twinkle for the sparkles.
let sparkTexture = null;
function spark() {
  if (!sparkTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 5;
    const ctx = canvas.getContext('2d');
    for (const [x, y, c] of [[2, 0, '#9cc8ef'], [2, 1, '#ffffff'], [0, 2, '#9cc8ef'], [1, 2, '#ffffff'], [2, 2, '#ffffff'], [3, 2, '#ffffff'], [4, 2, '#9cc8ef'], [2, 3, '#ffffff'], [2, 4, '#9cc8ef']]) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
    sparkTexture = new THREE.CanvasTexture(canvas);
    sparkTexture.magFilter = THREE.NearestFilter;
    sparkTexture.minFilter = THREE.NearestFilter;
  }
  return sparkTexture;
}

// The mattress is one bendable sheet: a strip of N slices along its length, each placed on
// a centreline that is flat (rippling a little in the air) up to where it's rolled, and a
// spiral after that. Rolled right up it waits at the head end; when Salvia comes it unrolls.
export function makeBed(size) {
  const w = size * 2.3;
  const d = size * 1.6;
  const h = size * 0.1;
  const N = 64;
  const top = new THREE.MeshStandardMaterial({ map: bedTop(), roughness: 0.95, side: THREE.DoubleSide });
  const sides = new THREE.MeshStandardMaterial({ map: bedSide(), roughness: 0.95, side: THREE.DoubleSide });
  const group = new THREE.Group();
  const rug = new THREE.Group(); // everything that floats
  group.add(rug);

  // vertices: top, bottom, near side, far side (two rows of N+1 each), then the two ends
  const count = (N + 1) * 8 + 8;
  const position = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const index = [];
  const strip = (base, flip) => {
    for (let i = 0; i < N; i++) {
      const a = base + i * 2;
      if (flip) index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };
  const TOP = 0;
  const BOTTOM = (N + 1) * 2;
  const NEAR = (N + 1) * 4;
  const FAR = (N + 1) * 6;
  const ENDS = (N + 1) * 8;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    uv.set([u, 0, u, 1], (TOP + i * 2) * 2);
    uv.set([u, 0, u, 1], (BOTTOM + i * 2) * 2);
    uv.set([(u * w) / h, 0, (u * w) / h, 1], (NEAR + i * 2) * 2);
    uv.set([(u * w) / h, 0, (u * w) / h, 1], (FAR + i * 2) * 2);
  }
  for (let e = 0; e < 2; e++) uv.set([0, 0, d / h, 0, 0, 1, d / h, 1], (ENDS + e * 4) * 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  strip(TOP, false);
  strip(BOTTOM, true);
  const topCount = index.length;
  strip(NEAR, true);
  strip(FAR, false);
  for (let e = 0; e < 2; e++) { const a = ENDS + e * 4; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geometry.setIndex(index);
  geometry.addGroup(0, topCount, 0);
  geometry.addGroup(topCount, index.length - topCount, 1);
  const sheet = new THREE.Mesh(geometry, [top, sides]);
  sheet.frustumCulled = false;
  rug.add(sheet);

  // the fringe: soft tassels out of both short ends
  const thread = new THREE.MeshStandardMaterial({ color: '#f3eee0', roughness: 1 });
  const TASSELS = 11;
  const tassels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), thread, TASSELS * 2);
  tassels.frustumCulled = false;
  rug.add(tassels);
  const tasselLength = (k, end) => size * (0.14 + ((k * 7 + end * 3) % 5) * 0.012);

  // the pillow: a plain pixel cloud, white with a blue outline and a little light-blue
  // shading, as a sprite that always faces you
  const CW = 30;
  const CH = 17;
  const puffs = [[15, 7.5, 6.6], [8, 10.2, 4.6], [22, 9.6, 5.2], [11.5, 7, 3.6]];
  const inCloud = (x, y) => y <= 14 && x >= 2 && x <= 27 && puffs.some(([px, py, r]) => (x - px) ** 2 + (y - py) ** 2 <= r * r);
  const pixels = document.createElement('canvas');
  pixels.width = CW;
  pixels.height = CH;
  const g = pixels.getContext('2d');
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (!inCloud(x, y)) continue;
    const edge = !inCloud(x + 1, y) || !inCloud(x - 1, y) || !inCloud(x, y + 1) || !inCloud(x, y - 1);
    const shade = y >= 13 || (Math.abs(Math.hypot(x - 8, y - 12.6) - 2.6) < 0.5 && y < 12.4) || (Math.abs(Math.hypot(x - 21, y - 11.8) - 3.2) < 0.5 && y < 11.6);
    g.fillStyle = edge ? '#3a9ee6' : shade ? '#9fd0f4' : '#ffffff';
    g.fillRect(x, y, 1, 1);
  }
  const map = new THREE.CanvasTexture(pixels);
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map, alphaTest: 0.5 }));
  const cell = (d * 0.62) / CW;
  rug.add(cloud);

  // magic: a soft blue glow on the counter underneath, and twinkles drifting off the tassels
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext('2d');
  const grad = gc.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(120,180,255,0.9)');
  grad.addColorStop(0.5, 'rgba(80,140,240,0.35)');
  grad.addColorStop(1, 'rgba(60,110,230,0)');
  gc.fillStyle = grad;
  gc.fillRect(0, 0, 64, 64);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.3, d * 1.3), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = size * 0.015;
  glow.renderOrder = 2;
  group.add(glow);
  const sparks = [];
  const sparkMaterial = () => new THREE.SpriteMaterial({ map: spark(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  // the centreline: where along the length s (0 at the head) is, and which way it faces
  let roll = 1; // 1: rolled right up; 0: flat
  let want = 1;
  let visitedAt = -1e9;
  const P = Array.from({ length: N + 1 }, () => new THREE.Vector2());
  const Nrm = Array.from({ length: N + 1 }, () => new THREE.Vector2());
  const rIn = size * 0.05;
  function centreline(t) {
    const flat = w * (1 - roll);
    const rolled = w - flat;
    const rOut = Math.sqrt(rIn * rIn + (rolled * h * 1.1) / Math.PI); // its thickness wound round
    let phi = 0;
    const ds = w / N;
    for (let i = 0; i <= N; i++) {
      const s = i * ds;
      if (s <= flat) {
        const ripple = Math.sin((s / w) * Math.PI * 3.2 - t * 2.2) * size * 0.022 * (1 - roll);
        P[i].set(s, ripple);
      } else {
        const r = Math.max(rIn, rOut - (h * 1.1 * phi) / (2 * Math.PI));
        P[i].set(flat + r * Math.sin(phi), rOut - r * Math.cos(phi));
        phi += ds / r;
      }
    }
    for (let i = 0; i <= N; i++) {
      const a = P[Math.max(0, i - 1)];
      const b = P[Math.min(N, i + 1)];
      Nrm[i].set(-(b.y - a.y), b.x - a.x).normalize();
    }
  }
  const put = (n, x, y, z) => position.set([x, y, z], n * 3);
  function shape(t) {
    centreline(t);
    const hw = d / 2;
    for (let i = 0; i <= N; i++) {
      const c = P[i];
      const n = Nrm[i];
      const tx = c.x + (n.x * h) / 2 - w / 2;
      const ty = c.y + (n.y * h) / 2 + h / 2;
      const bx = c.x - (n.x * h) / 2 - w / 2;
      const by = c.y - (n.y * h) / 2 + h / 2;
      put(TOP + i * 2, tx, ty, -hw); put(TOP + i * 2 + 1, tx, ty, hw);
      put(BOTTOM + i * 2, bx, by, -hw); put(BOTTOM + i * 2 + 1, bx, by, hw);
      put(NEAR + i * 2, bx, by, hw); put(NEAR + i * 2 + 1, tx, ty, hw);
      put(FAR + i * 2, bx, by, -hw); put(FAR + i * 2 + 1, tx, ty, -hw);
    }
    for (let e = 0; e < 2; e++) {
      const i = e ? N : 0;
      const c = P[i];
      const n = Nrm[i];
      const a = ENDS + e * 4;
      put(a, c.x - (n.x * h) / 2 - w / 2, c.y - (n.y * h) / 2 + h / 2, -hw);
      put(a + 1, c.x - (n.x * h) / 2 - w / 2, c.y - (n.y * h) / 2 + h / 2, hw);
      put(a + 2, c.x + (n.x * h) / 2 - w / 2, c.y + (n.y * h) / 2 + h / 2, -hw);
      put(a + 3, c.x + (n.x * h) / 2 - w / 2, c.y + (n.y * h) / 2 + h / 2, hw);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    // tassels out of each end, along the sheet
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let e = 0; e < 2; e++) {
      const i = e ? N : 0;
      const tangent = new THREE.Vector2(Nrm[i].y, -Nrm[i].x).multiplyScalar(e ? 1 : -1);
      for (let k = 0; k < TASSELS; k++) {
        const length = tasselLength(k, e) * (e && roll > 0.5 ? 0 : 1); // the inner end hides in the roll
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(tangent.y, tangent.x));
        m.compose(new THREE.Vector3(P[i].x - w / 2 + (tangent.x * length) / 2, P[i].y + h / 2 + (tangent.y * length) / 2, -d / 2 + (d * (k + 0.5)) / TASSELS),
          q, new THREE.Vector3(Math.max(length, 1e-4), size * 0.02, size * 0.035));
        tassels.setMatrixAt(e * TASSELS + k, m);
      }
    }
    tassels.instanceMatrix.needsUpdate = true;
  }

  const hover = size * 0.14;
  let last = 0;
  const update = (now) => {
    const t = now / 1000;
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    want = now - visitedAt < 5000 ? 0 : 1; // open while she's there or on her way, then rolls up
    roll += Math.sign(want - roll) * Math.min(Math.abs(want - roll), dt * 0.7);
    rug.position.y = hover + Math.sin(t * 0.8) * size * 0.03;
    rug.rotation.x = Math.sin(t * 0.6) * 0.025; // a slow sway, like it's riding the air
    shape(t);
    // the pillow plumps up once it's open
    const open = Math.max(0, Math.min(1, (0.25 - roll) / 0.25));
    cloud.visible = open > 0.01;
    cloud.scale.set(CW * cell * open, CH * cell * open, 1);
    cloud.position.set(-w / 2 + w * 0.2, h + (CH * cell * open) * 0.42 + P[Math.round(N * 0.2)].y, 0);
    glow.material.opacity = 0.35 + 0.15 * Math.sin(t * 1.7) + 0.2 * (1 - roll);
    // twinkles
    if (Math.random() < dt * (3 + 5 * (1 - roll))) {
      const e = roll > 0.5 ? 0 : Math.round(Math.random());
      const i = e ? N : 0;
      const sp = new THREE.Sprite(sparkMaterial());
      sp.position.set(P[i].x - w / 2 + (e ? 1 : -1) * size * 0.15, P[i].y + h, -d / 2 + Math.random() * d);
      sp.userData = { born: t, rise: size * (0.25 + Math.random() * 0.25), y0: sp.position.y };
      rug.add(sp);
      sparks.push(sp);
    }
    for (let k = sparks.length - 1; k >= 0; k--) {
      const sp = sparks[k];
      const age = (t - sp.userData.born) / 1.8;
      if (age >= 1) { rug.remove(sp); sp.material.dispose(); sparks.splice(k, 1); continue; }
      sp.position.y = sp.userData.y0 + sp.userData.rise * age;
      const twinkle = Math.abs(Math.sin(age * 9 + k));
      sp.scale.setScalar(size * 0.07 * twinkle * (1 - age * 0.5));
      sp.material.opacity = 1 - age;
    }
  };
  update(0);
  const shadow = shadowBlob(Math.max(w, d) * 0.62);
  shadow.position.y = size * 0.01;
  group.add(shadow);
  return {
    group, w, d, h, update,
    top: () => rug.position.y + h,
    get open() { return roll < 0.1; },
    visit(now) { visitedAt = now; }, // she's on it, or heading there
  };
}

// Plants go a little way out from the holder (or the hill's crest), spread apart,
// on ground she can walk on. The same scene always gets the same garden.
export function plantGarden(ground, key) {
  const rng = seeded(key);
  const { size, holderAt, cells } = ground;
  const [hx, hz] = holderAt;
  // Keep the spoon corner (where the Theyyam comes) clear.
  const clear = (c) => !ground.ghost || Math.hypot(c[0] - ground.ghost[0], c[1] - ground.ghost[2]) > 0.5;
  const ring = cells.filter((c) => {
    const d = Math.hypot(c[0] - hx, c[1] - hz);
    return d > size * 2.2 && d < size * 9 && clear(c);
  });
  // On the side facing the radio's default view (the scans are framed from this
  // direction), so they're seen and tappable, and the same every visit.
  const toCamera = new THREE.Vector2(0.55, 1).normalize();
  const seen = ring.filter((c) => new THREE.Vector2(c[0] - hx, c[1] - hz).normalize().dot(toCamera) > 0.25);
  const candidates = seen.length >= 12 ? seen : ring;
  const group = new THREE.Group();
  const plants = [];
  const count = rng() < 0.5 ? 4 : 5;
  const kinds = Array.from({ length: count }, () => KINDS[Math.floor(rng() * KINDS.length)]);
  for (const kind of kinds) {
    const apart = (c) => plants.every((p) => Math.hypot(c[0] - p.x, c[1] - p.z) > size * 2.6);
    let free = candidates.filter(apart);
    if (!free.length) free = ring.filter(apart); // no room in view: somewhere further round
    if (!free.length) break;
    const [x, z, y] = free[Math.floor(rng() * free.length)];
    const { mesh, matrices, leaves, unit, top } = grow(kind, rng, size);
    mesh.position.set(x, y, z);
    const yaw = rng() * Math.PI * 2;
    mesh.rotation.y = yaw;
    group.add(mesh);
    const shadow = shadowBlob(unit * 3.2);
    shadow.position.set(x, y + unit * 0.05, z);
    group.add(shadow);
    const eaten = new Set();
    let lastBite = 0;
    let lastRegrow = 0;
    let wobbleAt = -1e9;
    plants.push({
      name: kind.name,
      words: kind.words,
      mesh,
      x, z, y,
      height: unit * top,
      get left() { return leaves.length - eaten.size; },
      // A nudge: the whole plant sways on its pot for a moment.
      wobble() { wobbleAt = performance.now(); },
      // A bite takes a few leaves.
      chomp() {
        lastBite = performance.now();
        wobbleAt = lastBite;
        const uneaten = leaves.filter((n) => !eaten.has(n));
        for (let k = 0; k < Math.min(uneaten.length, 3 + Math.floor(rng() * 4)); k++) {
          const n = uneaten.splice(Math.floor(rng() * uneaten.length), 1)[0];
          eaten.add(n);
          mesh.setMatrixAt(n, hidden);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
      // Leaves come back one by one, a while after the last bite; and the sway dies down.
      update(now) {
        const since = (now - wobbleAt) / 1000;
        const sway = since < 1.2 ? Math.sin(since * 22) * 0.09 * Math.exp(-since * 3.5) : 0;
        mesh.rotation.set(sway * 0.6, yaw, sway);
        if (!eaten.size || now - lastBite < 60000 || now - lastRegrow < 700) return;
        lastRegrow = now;
        const n = eaten.values().next().value;
        eaten.delete(n);
        mesh.setMatrixAt(n, matrices[n]);
        mesh.instanceMatrix.needsUpdate = true;
      },
    });
  }
  // The mattress goes down last, in view, clear of the plants.
  let bed = null;
  const roomy = (c) => plants.every((p) => Math.hypot(c[0] - p.x, c[1] - p.z) > size * 3) && Math.hypot(c[0] - hx, c[1] - hz) > size * 3;
  const spots = candidates.filter(roomy).length ? candidates.filter(roomy) : ring.filter(roomy);
  if (spots.length) {
    const [x, z, y] = spots[Math.floor(rng() * spots.length)];
    const made = makeBed(size);
    const yaw = rng() * Math.PI * 2;
    made.group.position.set(x, y, z);
    made.group.rotation.y = yaw;
    group.add(made.group);
    // on it? (in its own frame) — so she lies on top rather than in it
    const on = (px, pz) => {
      const dx = px - x;
      const dz = pz - z;
      const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      return Math.abs(lx) < made.w / 2 && Math.abs(lz) < made.d / 2;
    };
    bed = { x, z, y, get h() { return made.top(); }, on: (px, pz) => made.open && on(px, pz), update: made.update, visit: made.visit, onIt: on };
  }
  return { group, plants, bed };
}
