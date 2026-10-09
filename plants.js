// Little 8-bit plants for Salvia to chomp: the mini acacia palm, the Japanese maple
// bonsai in its rectangular pot, a parlour palm and a fan palm. Each is built from
// voxels in a small palette and stands on the ground she walks on, a few times her
// height. When she eats one its leaves go, chomp by chomp, and grow back later.
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
  roundPot(p, 2, 4, '#c0663a', '#d87a48');
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
  roundPot(p, 2, 4, '#e8e2d6', '#f4efe6');
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
  roundPot(p, 2, 3, '#5a5a5a', '#6e6e6e');
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

const KINDS = [
  { name: 'acacia', build: acacia, height: 3.0, words: '*nom* (the acacia palm)' },
  { name: 'bonsai', build: bonsai, height: 1.9, words: '*nom* (the maple bonsai!)' },
  { name: 'parlour palm', build: parlourPalm, height: 2.7, words: '*nom* (a palm)' },
  { name: 'fan palm', build: fanPalm, height: 2.4, words: '*munch* (the fan palm)' },
];

// --- a garden for one scene ---

function seeded(text) {
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

function grow(kind, rng, size) {
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

// Plants go a little way out from the holder (or the hill's crest), spread apart,
// on ground she can walk on. The same scene always gets the same garden.
export function plantGarden(ground, key, camera) {
  const rng = seeded(key);
  const { size, holderAt, cells } = ground;
  const [hx, hz] = holderAt;
  const ring = cells.filter((c) => {
    const d = Math.hypot(c[0] - hx, c[1] - hz);
    return d > size * 2.2 && d < size * 9;
  });
  // On the side facing the viewer, and inside the frame, so they're seen and tappable.
  const toCamera = new THREE.Vector2(camera.position.x - hx, camera.position.z - hz).normalize();
  const ndc = new THREE.Vector3();
  const seen = ring.filter((c) => {
    const away = new THREE.Vector2(c[0] - hx, c[1] - hz).normalize();
    ndc.set(c[0], c[2] + size, c[1]).project(camera);
    return away.dot(toCamera) > 0.2 && Math.abs(ndc.x) < 0.8 && ndc.y > -0.9 && ndc.y < 0.45;
  });
  const candidates = seen.length >= 12 ? seen : ring;
  const group = new THREE.Group();
  const plants = [];
  for (const kind of KINDS) {
    const apart = (c) => plants.every((p) => Math.hypot(c[0] - p.x, c[1] - p.z) > size * 2.6);
    let free = candidates.filter(apart);
    if (!free.length) free = ring.filter(apart); // no room in view: somewhere further round
    if (!free.length) break;
    const [x, z, y] = free[Math.floor(rng() * free.length)];
    const { mesh, matrices, leaves, unit, top } = grow(kind, rng, size);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rng() * Math.PI * 2;
    group.add(mesh);
    const eaten = new Set();
    let lastBite = 0;
    plants.push({
      name: kind.name,
      words: kind.words,
      mesh,
      x, z, y,
      height: unit * top,
      get left() { return leaves.length - eaten.size; },
      // A bite takes a few leaves.
      chomp() {
        lastBite = performance.now();
        const uneaten = leaves.filter((n) => !eaten.has(n));
        for (let k = 0; k < Math.min(uneaten.length, 3 + Math.floor(rng() * 4)); k++) {
          const n = uneaten.splice(Math.floor(rng() * uneaten.length), 1)[0];
          eaten.add(n);
          mesh.setMatrixAt(n, hidden);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
      // Leaves come back a while after the last bite.
      regrow(now) {
        if (!eaten.size || now - lastBite < 90000) return;
        for (const n of eaten) mesh.setMatrixAt(n, matrices[n]);
        eaten.clear();
        mesh.instanceMatrix.needsUpdate = true;
      },
    });
  }
  return { group, plants };
}
