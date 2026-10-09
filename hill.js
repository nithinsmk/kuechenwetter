// The 8-bit green hill: our own blocky landscape after that famous desktop hill, built
// in code (nothing from the photograph). Voxels in a small palette, a banded sky,
// chunky clouds; the radio draws it at a low resolution so it comes out pixelated.
// Salvia roams it: she hops up to sit on the crest and eats the yellow flowers.
import * as THREE from 'three';

const V = 0.4; // one block
const SKY = ['#1d4fd1', '#2860dd', '#3672e6', '#4886ee', '#5c9af3', '#76aef6', '#92c2f9', '#b0d6fb'];
const GRASS = ['#2f8a1f', '#3fa628', '#56c22f', '#74d63c']; // shadow → sunlit
const MEADOW = ['#24701a', '#2e8820', '#3a9e26'];
const SIDE = ['#1d5c16', '#24701a'];
const EARTH = '#7a5328';
const FLOWER = '#f7d331';

function height(x, z) {
  const hill = 3.2 * Math.exp(-(((x + 2.5) / 6.5) ** 2) - (((z + 4) / 5) ** 2));
  const swell = 0.5 * Math.exp(-(((x - 9) / 6) ** 2) - (((z + 9) / 5) ** 2));
  return hill + swell + 0.05 * Math.sin(x * 0.7) * Math.cos(z * 0.5);
}

function sunlight(x, z) {
  const e = 0.05;
  const n = new THREE.Vector3(-(height(x + e, z) - height(x - e, z)) / (2 * e), 1, -(height(x, z + e) - height(x, z - e)) / (2 * e)).normalize();
  const lit = Math.max(0, n.dot(new THREE.Vector3(-0.45, 0.8, 0.4).normalize()));
  const cloudShadow = Math.exp(-(((x + 4) / 3.2) ** 2) - (((z + 0.5) / 2.2) ** 2));
  return lit * (1 - 0.45 * cloudShadow);
}

const earthAt = (x, z) => Math.abs(z - (3 + 0.25 * Math.sin(x * 0.3))) < V * 0.55;

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = SKY.length * 4;
  const ctx = canvas.getContext('2d');
  // Bands from deep blue at the top to pale at the horizon, with a dithered seam between.
  SKY.forEach((colour, i) => { ctx.fillStyle = colour; ctx.fillRect(0, i * 4, 2, 4); });
  for (let i = 1; i < SKY.length; i++) { ctx.fillStyle = SKY[i]; ctx.fillRect(0, i * 4 - 1, 1, 1); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildHill() {
  const group = new THREE.Group();
  const blocks = []; // [x, y, z, size, colour]
  const top = new Map(); // column key → top surface height
  const key = (i, j) => `${i},${j}`;
  const I = [-40, 40];
  const J = [-35, 30];

  for (let i = I[0]; i < I[1]; i++) {
    for (let j = J[0]; j < J[1]; j++) {
      top.set(key(i, j), Math.max(0, Math.round(height(i * V, j * V) / V)) * V);
    }
  }
  for (let i = I[0]; i < I[1]; i++) {
    for (let j = J[0]; j < J[1]; j++) {
      const x = i * V;
      const z = j * V;
      const y = top.get(key(i, j));
      const meadow = z > 3;
      let colour;
      if (earthAt(x, z)) colour = EARTH;
      else if (meadow) colour = MEADOW[Math.min(2, Math.floor(sunlight(x, z) * 2.4 + ((i + j) % 2) * 0.4))];
      else colour = GRASS[Math.min(3, Math.floor(sunlight(x, z) * 3.6 + ((i * 7 + j * 3) % 5 === 0 ? 0.6 : 0)))];
      blocks.push([x, y - V / 2, z, V, colour]);
      // Blocks below the top, down to the lowest neighbour, so the steps have sides.
      const lowest = Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => top.get(key(i + a, j + b)) ?? y));
      for (let below = y - V; below > lowest - V / 2; below -= V) blocks.push([x, below - V / 2, z, V, SIDE[(i + j) & 1]]);
      // A yellow flower now and then in the meadow.
      if (meadow && z < 8 && !earthAt(x, z) && Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1 < 0.03) {
        blocks.push([x, y + V * 0.2, z, V * 0.4, FLOWER]);
      }
    }
  }

  // Distant blue hills on the right, and chunky clouds: flat colours, not lit.
  const far = [];
  for (let x = 8; x < 40; x += 1.6) {
    const h = Math.round((2.2 * Math.exp(-(((x - 22) / 9) ** 2)) + 0.6) / 1.6);
    for (let k = 0; k < h; k++) far.push([x, k * 1.6 + 0.8, -38, 1.6, k === h - 1 ? '#7088b8' : '#5872a6']);
  }
  const random = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (let c = 0; c < 9; c++) {
    const cx = -26 + c * 6.5 + random() * 3;
    const cy = 7 + random() * 6;
    const cz = -30 - random() * 10;
    const width = 3 + Math.floor(random() * 4);
    for (let row = 0; row < 3; row++) {
      const w = width - row * (1 + Math.floor(random() * 2));
      for (let k = 0; k < w; k++) {
        far.push([cx + (k - w / 2) * 1.1 + row * 0.5, cy + row * 1.1, cz, 1.1, row === 0 ? '#d6e4fa' : '#ffffff']);
      }
    }
  }

  const m = new THREE.Matrix4();
  const colour = new THREE.Color();
  const instanced = (list, material) => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, list.length);
    list.forEach(([x, y, z, size, c], n) => {
      mesh.setMatrixAt(n, m.makeScale(size, size, size).setPosition(x, y, z));
      mesh.setColorAt(n, colour.set(c));
    });
    return mesh;
  };
  group.add(instanced(blocks, new THREE.MeshLambertMaterial()), instanced(far, new THREE.MeshBasicMaterial()));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5);
  sun.position.set(-4.5, 8, 4);
  group.add(sun, new THREE.AmbientLight('#ffffff', 1.1));
  group.userData.focus = new THREE.Sphere(new THREE.Vector3(0, 1.5, -1), 3);

  // Where Salvia can go: the hill and the meadow in front, block by block.
  const cells = [];
  for (let i = -22; i <= 22; i++) for (let j = -20; j <= 20; j++) cells.push([i * V, j * V, top.get(key(i, j))]);
  const flowers = blocks.filter((b) => b[4] === FLOWER && Math.abs(b[0]) < 8 && b[2] < 8);
  const flower = flowers[Math.floor(flowers.length / 2)];
  const heightAt = (x, z) => top.get(key(Math.round(x / V), Math.round(z / V))) ?? 0;

  return {
    group,
    sky: skyTexture(),
    view: { from: [1.2, 2.0, 12.5], to: [0, 2.0, -2] }, // in the meadow, looking across at the hill
    ground: {
      heightAt,
      cells,
      size: 0.55, // on the hill she's about a block and a half tall
      holderAt: [-2.4, -4], // the crest, where she goes to check in
      plantCell: flower && [flower[0], flower[2], heightAt(flower[0], flower[2])],
      plantWords: '*nom* (a flower)',
    },
  };
}
