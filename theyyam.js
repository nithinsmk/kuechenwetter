// The Theyyam: a small 8-bit Theyyam (Nithin's sprite sheet, cut into sprites/theyyam.png)
// who visits the dish-rack corner by the overturned spoon. A fire-like glow builds, a
// silent lightning bolt strikes the spot, and he's there. Each visit he does one thing,
// at random: stands and watches, hops back and forth over the spoon, dances on the spoon,
// dances and spins, plays with Salvia (circling her), or lies down to sleep beside her.
// Then he spins faster and faster (becoming a real spinning top, the top-view frame
// wrapped over a squashed ellipsoid) and vanishes in a puff of embers. Visits are private
// to each screen.
import * as THREE from 'three';

const BEHAVIOURS = ['watch', 'hop', 'spoon', 'dance', 'play', 'sleep'];

function radial(colours) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  colours.forEach(([at, c]) => g.addColorStop(at, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function makeTheyyam({ scene, camera, canvas, salvia, onLeave }) {
  let atlas = null; // { texture, cell: [w, h], size: [w, h], frames: { name: [x, y, w, h] }, top: texture }
  let visit = null;
  const group = new THREE.Group();
  scene.add(group);

  async function load() {
    if (atlas) return atlas;
    const [meta, image] = await Promise.all([
      fetch('sprites/theyyam.json').then((r) => r.json()),
      new Promise((done, fail) => { const i = new Image(); i.onload = () => done(i); i.onerror = fail; i.src = 'sprites/theyyam.png'; }),
    ]);
    const texture = new THREE.Texture(image);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    // the top-view frame on its own, for the spinning top
    const [x, y, w, h] = meta.frames.spin5;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = w;
    c.getContext('2d').drawImage(image, x, y + h - w, w, w, 0, 0, w, w);
    const top = new THREE.CanvasTexture(c);
    top.magFilter = THREE.NearestFilter;
    top.colorSpace = THREE.SRGBColorSpace;
    atlas = { texture, top, cell: meta.cell, size: [image.width, image.height], frames: meta.frames };
    return atlas;
  }

  // --- pieces ---

  function sprite() {
    const map = atlas.texture.clone();
    map.needsUpdate = true;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.5 }));
    s.renderOrder = 2;
    return s;
  }
  function show(s, name, flip = false) {
    const [x, y, w, h] = atlas.frames[name];
    const [W, H] = atlas.size;
    const map = s.material.map;
    map.repeat.set((flip ? -w : w) / W, h / H);
    map.offset.set((flip ? x + w : x) / W, 1 - (y + h) / H);
  }
  function spinningTop(size) {
    const geometry = new THREE.SphereGeometry(1, 28, 14);
    const uv = geometry.attributes.uv;
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) * 0.5, 0.5 - pos.getZ(i) * 0.5); // seen from above
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: atlas.top, transparent: true, alphaTest: 0.4 }));
    mesh.scale.set(size * 0.55, size * 0.25, size * 0.55);
    return mesh;
  }
  const glowTexture = radial([[0, 'rgba(255,220,120,1)'], [0.35, 'rgba(255,120,30,0.7)'], [1, 'rgba(255,60,0,0)']]);
  function glow() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.renderOrder = 3;
    return s;
  }
  const emberTexture = radial([[0, 'rgba(255,240,180,1)'], [0.5, 'rgba(255,140,40,0.8)'], [1, 'rgba(255,80,0,0)']]);
  const embers = [];
  function ember(at, size, up = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emberTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * size, Math.random() * size * 0.3, (Math.random() - 0.5) * size));
    s.scale.setScalar(size * (0.08 + Math.random() * 0.08));
    group.add(s);
    embers.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * size * 0.6, size * (0.5 + Math.random()) * up, (Math.random() - 0.5) * size * 0.6), life: 1 + Math.random() });
  }

  // The silent strike: a jagged pixel bolt from the top of the screen onto the spot, and a flash.
  function strike(at) {
    const p = at.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    const sx = rect.left + ((p.x + 1) / 2) * rect.width;
    const sy = rect.top + ((1 - p.y) / 2) * rect.height;
    let x = sx + (Math.random() - 0.5) * 120;
    const points = [[x, -10]];
    for (let y = 0; y < sy; y += 26 + Math.random() * 26) {
      x += (Math.random() - 0.5) * 50;
      x += (sx - x) * (y / sy) * 0.35;
      points.push([Math.round(x / 4) * 4, Math.round(y / 4) * 4]);
    }
    points.push([sx, sy]);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'strike');
    svg.innerHTML = `<polyline points="${points.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#bff6ff" stroke-width="9" stroke-linejoin="miter" opacity="0.6"/>`
      + `<polyline points="${points.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="miter"/>`;
    const flash = Object.assign(document.createElement('div'), { className: 'strike-flash' });
    document.body.append(svg, flash);
    setTimeout(() => { svg.remove(); flash.remove(); }, 700);
  }

  // --- a visit ---

  function salviaSize() { return salvia.size || 0.1; }

  async function start(spot, kind) {
    if (visit) return false;
    await load();
    const size = salviaSize() * 1.05; // about her height
    const ground = new THREE.Vector3(...spot.at);
    const s = sprite();
    s.visible = false;
    const halo = glow();
    halo.position.copy(ground).add(new THREE.Vector3(0, size * 0.4, 0));
    group.add(s, halo);
    visit = { kind: kind ?? BEHAVIOURS[Math.floor(Math.random() * BEHAVIOURS.length)], phase: 'glow', t0: performance.now(), s, halo, size, ground, spot, pos: ground.clone(), top: null };
    return visit.kind;
  }

  function finish() {
    if (!visit) return;
    group.remove(visit.s, visit.halo);
    if (visit.top) group.remove(visit.top);
    visit.s.material.map.dispose();
    visit = null;
    onLeave?.();
  }

  // the spoon, as two ends on the counter, and the points either side of it
  function spoonMid(v) { return new THREE.Vector3().addVectors(v.spot.bowl, v.spot.handle).multiplyScalar(0.5); }
  function across(v, side) {
    const along = new THREE.Vector3().subVectors(v.spot.handle, v.spot.bowl).setY(0).normalize();
    const n = new THREE.Vector3(-along.z, 0, along.x).multiplyScalar(side * v.size * 0.7);
    return v.spot.bowl.clone().lerp(v.spot.handle, 0.35).add(n).setY(v.ground.y);
  }

  let last = 0;
  function update(time) {
    const dt = Math.min(0.1, (time - last) / 1000);
    last = time;
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life -= dt * 1.2;
      e.s.position.addScaledVector(e.v, dt);
      e.s.material.opacity = Math.max(0, e.life);
      if (e.life <= 0) { group.remove(e.s); e.s.material.dispose(); embers.splice(i, 1); }
    }
    if (!visit) return;
    const v = visit;
    const age = (performance.now() - v.t0) / 1000;
    const s = v.s;
    const H = v.size;
    const W = (H * atlas.cell[0]) / atlas.cell[1];
    s.scale.set(W, H, 1);
    const place = (p, lift = 0) => s.position.copy(p).add(new THREE.Vector3(0, H / 2 + lift, 0));
    const frames = (names, fps) => names[Math.floor(age * fps) % names.length];

    if (v.phase === 'glow') { // a fire-like glow building in the corner
      const k = Math.min(1, age / 2.6);
      v.halo.scale.setScalar(H * (0.6 + k * 1.6) * (0.85 + Math.random() * 0.3));
      v.halo.material.opacity = 0.35 + k * 0.6;
      if (Math.random() < dt * 14) ember(v.ground, H, 1);
      if (age > 2.6) { strike(v.ground.clone().add(new THREE.Vector3(0, H * 0.2, 0))); v.phase = 'here'; v.t0 = performance.now(); s.visible = true; }
      return;
    }
    // the glow fades round him once he's here
    v.halo.material.opacity = Math.max(0, v.halo.material.opacity - dt * 0.4);
    v.halo.scale.setScalar(H * 2.2 * (0.9 + Math.random() * 0.2));

    if (v.phase === 'here') {
      const done = run(v, age, dt, place, frames);
      if (done) { v.phase = 'leave'; v.t0 = performance.now(); }
      return;
    }
    if (v.phase === 'leave') { // faster and faster, then a spinning top, then embers
      if (age < 1.4) {
        place(v.pos);
        show(s, frames(['spin0', 'spin1', 'spin2'], 6 + age * 14));
      } else {
        if (!v.top) { v.top = spinningTop(H); group.add(v.top); s.visible = false; }
        const k = Math.min(1, (age - 1.4) / 1.6);
        v.top.position.copy(v.pos).add(new THREE.Vector3(0, H * 0.25 + k * H * 0.4, 0));
        v.top.rotation.y += dt * (14 + k * 30);
        v.top.rotation.z = Math.sin(age * 9) * 0.12 * (1 - k);
        const shrink = 1 - k * k;
        v.top.scale.set(H * 0.55 * shrink, H * 0.25 * shrink, H * 0.55 * shrink);
        if (Math.random() < dt * 30) ember(v.top.position, H, 0.6);
        if (k >= 1) { for (let i = 0; i < 18; i++) ember(v.top.position, H * 1.2, 1); finish(); }
      }
    }
  }

  // One behaviour; true when it's over.
  function run(v, age, dt, place, frames) {
    const s = v.s;
    const H = v.size;
    switch (v.kind) {
      case 'watch': { // stands, looks about, blinks now and then
        place(v.pos);
        show(s, age % 3.5 > 3.15 ? 'idle4' : frames(['idle0', 'idle1', 'idle2', 'idle3'], 3));
        return age > 9;
      }
      case 'hop': { // back and forth over the spoon
        const hop = Math.floor(age / 1.1);
        const k = (age % 1.1) / 1.1;
        const a = across(v, hop % 2 ? 1 : -1);
        const b = across(v, hop % 2 ? -1 : 1);
        if (age < 0.9) { place(v.ground.clone().lerp(a, age / 0.9)); show(s, frames(['idle0', 'idle1'], 6)); v.pos.copy(a); return false; }
        v.pos.copy(a).lerp(b, k);
        place(v.pos, Math.sin(k * Math.PI) * H * 0.55);
        show(s, k > 0.15 && k < 0.85 ? 'spin1' : 'idle0', hop % 2 === 1);
        return age > 0.9 + 1.1 * 6;
      }
      case 'spoon': { // up onto the spoon's back, and dances there
        const top = spoonMid(v).clone().setY(Math.max(v.spot.bowl.y, v.spot.handle.y) + H * 0.04);
        if (age < 0.8) { const k = age / 0.8; v.pos.copy(v.ground).lerp(top, k); place(v.pos, Math.sin(k * Math.PI) * H * 0.5); show(s, 'spin1'); return false; }
        const sway = Math.sin(age * 3) * H * 0.18;
        const along = new THREE.Vector3().subVectors(v.spot.handle, v.spot.bowl).normalize();
        v.pos.copy(top).addScaledVector(along, sway);
        place(v.pos, Math.abs(Math.sin(age * 6)) * H * 0.08);
        show(s, frames(['spin0', 'spin1', 'spin2', 'spin1'], 6));
        return age > 9;
      }
      case 'dance': { // dances, the spin gets faster, a spinning top for a while, and back
        place(v.pos, Math.abs(Math.sin(age * 5)) * H * 0.06);
        const fast = age > 3.5 && age < 6.5;
        if (fast) {
          if (!v.top) { v.top = spinningTop(H); group.add(v.top); }
          s.visible = false;
          v.top.visible = true;
          v.top.position.copy(v.pos).add(new THREE.Vector3(0, H * 0.25, 0));
          v.top.rotation.y += dt * 26;
          v.top.rotation.z = Math.sin(age * 7) * 0.1;
          if (Math.random() < dt * 8) ember(v.top.position, H, 0.4);
        } else {
          if (v.top) v.top.visible = false;
          s.visible = true;
          show(s, frames(['spin0', 'spin1', 'spin2', 'spin1'], age < 3.5 ? 5 + age * 2 : 7));
        }
        return age > 9;
      }
      case 'play': { // circles round Salvia
        const her = salvia.where;
        const centre = her ? new THREE.Vector3(...her) : v.ground;
        const r = H * 1.3;
        const a = age * 1.6;
        v.pos.set(centre.x + Math.cos(a) * r, centre.y, centre.z + Math.sin(a) * r);
        place(v.pos, Math.abs(Math.sin(age * 6)) * H * 0.1);
        show(s, frames(['spin0', 'spin1', 'spin2', 'spin1'], 7));
        return age > 9;
      }
      case 'sleep': { // lies down beside her and sleeps until she stirs
        const her = salvia.where;
        if (age < 0.1 && her) v.pos.set(her[0] + H * 0.9, v.ground.y, her[2] + H * 0.3);
        place(v.pos);
        if (age < 0.6) show(s, 'sleep0');
        else if (age < 1.2) show(s, 'sleep1');
        else show(s, frames(['sleep2', 'sleep3', 'sleep4', 'sleep5'], 1.2));
        if (age > 1.2 && Math.floor(age) % 4 === 0) zzz(v);
        return age > 22 || (age > 3 && salvia.state !== 'sleep');
      }
      default: return true;
    }
  }

  // "z z" over him while he sleeps
  let lastZ = 0;
  function zzz(v) {
    const now = performance.now();
    if (now - lastZ < 3500) return;
    lastZ = now;
    const p = v.pos.clone().add(new THREE.Vector3(0, v.size * 0.7, 0)).project(camera);
    const rect = canvas.getBoundingClientRect();
    const z = Object.assign(document.createElement('span'), { className: 'theyyam-z', textContent: 'z z z' });
    z.style.left = `${rect.left + ((p.x + 1) / 2) * rect.width}px`;
    z.style.top = `${rect.top + ((1 - p.y) / 2) * rect.height}px`;
    z.addEventListener('animationend', () => z.remove());
    document.body.append(z);
  }

  return {
    // spot: { at: [x, y, z] where he arrives, bowl: Vector3, handle: Vector3 }
    visit: (spot, kind) => start(spot, kind),
    update,
    get busy() { return !!visit; },
    get kind() { return visit?.kind ?? null; },
    get phase() { return visit?.phase ?? null; },
    stop() { if (visit) finish(); },
  };
}
