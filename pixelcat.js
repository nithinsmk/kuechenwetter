// Salvia in 8-bit, her default form: a fluffy white Persian with odd eyes (emerald and
// aquamarine), a mostly black tail whose black runs a little onto her back, and her blue
// hamsa collar. Redrawn from Nithin's reference sheet as shapes on a 28 × 24 pixel grid,
// then outlined and shaded, so every pose and angle shares one style: side, front and
// back views, walking on four legs, sitting, sleeping, pouncing, rearing up, the spook,
// and a glass diving helmet for when the kitchen floods.

export const W = 28;
export const H = 24;

const INK = {
  k: '#1c1c22', w: '#fbfbf7', f: '#ffffff', s: '#d9d6d0', S: '#bdb9b2', p: '#f2a6b4', n: '#e48a9a',
  a: '#5fe0d0', e: '#1f8a4c', d: '#0e0e10', K: '#1a1a1d', x: '#5a5a62',
  c: '#3a6ae0', C: '#1d3a9a', h: '#c9d1dc', o: '#2f6fe8',
  g: 'rgba(200,240,252,0.9)', H: '#ffffff', G: '#8a96a6',
};

// --- drawing on the grid ---

const grid = (h = H) => Array.from({ length: h }, () => Array(W).fill('.'));
function put(g, x, y, ch) {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < g.length && x >= 0 && x < W) g[y][x] = ch;
}
// An ellipse of fur: lower part in shade, a few bright tufts on top.
function blob(g, cx, cy, rx, ry, ch = 'w', shade = true) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      if (u * u + v * v > 1) continue;
      let c = ch;
      if (ch === 'w' && shade) {
        if (v > 0.5) c = 's';
        else if (v < -0.4 && (x * 7 + y * 3) % 5 === 0) c = 'f';
      }
      put(g, x, y, c);
    }
  }
}
// A thick stroke along points (legs, tail).
function stroke(g, points, r, ch) {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let k = 0; k <= n; k++) blob(g, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, r, ch, false);
  }
}
// A dark outline round everything, the way pixel art does it.
function outline(g) {
  const copy = g.map((row) => [...row]);
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < W; x++) {
      if (copy[y][x] !== '.') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => copy[y + dy]?.[x + dx] && copy[y + dy][x + dx] !== '.');
      if (near) g[y][x] = 'k';
    }
  }
}

// --- her parts ---

// A leg from the hip to the ground; the foot swung forward (+) or back (−), or lifted.
function leg(g, x, top, swing, ink, lift = 0) {
  stroke(g, [[x, top], [x + swing * 0.5, top + 2.4 - lift * 0.5], [x + swing, 21.6 - lift]], 1.05, ink);
  put(g, x + swing - 0.6, 22 - lift, ink === 'w' ? 'f' : ink);
  put(g, x + swing + 0.6, 22 - lift, ink === 'w' ? 'f' : ink);
}
function earsSide(g, x, y) {
  stroke(g, [[x, y + 2], [x + 0.6, y]], 1, 'w');
  stroke(g, [[x + 4, y + 2], [x + 4.4, y]], 1, 'w');
  put(g, x + 0.5, y + 1, 'p');
  put(g, x + 4.3, y + 1, 'p');
}
// The collar, as a curve through the given points, darker underneath, the hamsa hanging
// from its lowest point.
function collar(g, points, charm) {
  for (const [x, y] of points) { put(g, x, y, 'c'); put(g, x, y + 1, 'C'); }
  if (charm) {
    const [x, y] = charm;
    put(g, x, y, 'h');
    put(g, x - 1, y + 1, 'o'); put(g, x, y + 1, 'f'); put(g, x + 1, y + 1, 'o');
    put(g, x, y + 2, 'o');
  }
}

// --- the views ---

// Side, facing right. legs: [near back, far back, near front, far front] swings.
function side({ legs = [0, 0, 0, 0], lift = [0, 0, 0, 0], body = 0, head = 0, tail = 0, charm = 0, arch = 0, puff = 0, low = false } = {}) {
  const g = grid();
  const by = 15 + body;
  const hy = 9 + head + (low ? 3 : 0);
  // far legs first, in shade
  leg(g, 9, by + 2, legs[1], 'S', lift[1]);
  leg(g, 18.5, by + 1, legs[3], 'S', lift[3]);
  // the tail: a thick plume, mostly black
  stroke(g, [[6.5, by - 1.5], [4, by - 3.5 - puff], [2.8 + tail, by - 6.5 - puff * 2], [3.6 + tail * 1.5, by - 9.5 - puff * 2]], 1.35 + puff * 0.7, 'K');
  // the body, arched for the spook
  blob(g, 13.5, by - arch, 8.6 + puff * 0.6, 4.7 + puff * 0.6);
  if (arch) blob(g, 12.5, by - arch * 1.8, 5.5, 3.2);
  blob(g, 7.4, by - 3.4 - arch * 1.2, 1.9, 1.2, 'K', false); // the black running onto her back
  blob(g, 19.6, by - 1.6, 3.6, 3.7); // the ruff
  // near legs
  leg(g, 7.5, by + 2, legs[0], 'w', lift[0]);
  leg(g, 16.5, by + 1.5, legs[2], 'w', lift[2]);
  // the head: round, flat-faced, with cheek fluff
  blob(g, 21.4, hy, 5.2, 4.7);
  blob(g, 23.6, hy + 2, 3.1, 2.3);
  earsSide(g, 18, hy - 6.3);
  put(g, 23.5, hy - 0.5, 'e'); put(g, 24.5, hy - 0.5, 'e'); put(g, 24.5, hy - 1.5, 'e'); put(g, 23.5, hy - 1.5, 'e');
  put(g, 24, hy - 1, 'd'); put(g, 24.3, hy - 1.6, 'f');
  put(g, 26.3, hy + 0.6, 'n');
  put(g, 25.8, hy + 1.6, 'x');
  if (puff) { for (let k = 0; k < 7; k++) put(g, 7 + k * 2, by - 5.4 - arch * 1.8 - (k % 2), 'w'); } // fur on end
  collar(g, [[17.6, hy + 1.5], [18.2, hy + 3], [19.3, hy + 4], [20.6, hy + 4.5], [22, hy + 4.3]], [20.5 + charm, hy + 5.6]);
  outline(g);
  return { rows: g, head: [21.4, hy, 6.4] };
}

// Front, facing you. step: −1, 0, 1 for which front paw is lifted.
function front({ step = 0, sit = false, charm = 0, body = 0 } = {}) {
  const g = grid();
  const hy = 8.4 + (sit ? 1 : 0) + body;
  // the tail curling out to the side, black
  stroke(g, [[19.5, 19], [22.4, 18.2], [23.8, 15.8], [23.3, 13.4]], 1.35, 'K');
  if (sit) {
    blob(g, 14, 17 + body, 7, 5.6); // sitting: a round pear
    blob(g, 9.5, 20.5, 2.6, 1.6, 's', false); blob(g, 18.5, 20.5, 2.6, 1.6, 's', false); // haunches
    leg(g, 11.5, 17, 0, 'w'); leg(g, 16.5, 17, 0, 'w');
  } else {
    leg(g, 9.5, 18, 0, 'S'); leg(g, 18.5, 18, 0, 'S'); // back legs, behind
    blob(g, 14, 16.5 + body, 6.8, 4.8);
    leg(g, 11.5, 17.5, 0, 'w', step < 0 ? 1.4 : 0);
    leg(g, 16.5, 17.5, 0, 'w', step > 0 ? 1.4 : 0);
  }
  blob(g, 14, 14 + body, 5, 3.2); // the ruff
  blob(g, 14, hy, 7.2, 6);
  blob(g, 9.6, hy + 2.6, 2.8, 2.2); blob(g, 18.4, hy + 2.6, 2.8, 2.2); // cheeks
  stroke(g, [[8.4, hy - 3.5], [8.6, hy - 6.6]], 1.1, 'w'); stroke(g, [[19.6, hy - 3.5], [19.4, hy - 6.6]], 1.1, 'w');
  put(g, 8.6, hy - 5, 'p'); put(g, 19.4, hy - 5, 'p'); put(g, 9.4, hy - 4.6, 'p'); put(g, 18.6, hy - 4.6, 'p');
  // odd eyes: emerald on your left, aquamarine on your right; slit pupils and a shine
  for (const [x, ink] of [[10.4, 'e'], [16.6, 'a']]) {
    put(g, x, hy, ink); put(g, x + 1, hy, ink); put(g, x, hy + 1, ink); put(g, x + 1, hy + 1, ink);
    put(g, x + 0.6, hy, 'd'); put(g, x + 0.6, hy + 1, 'd'); put(g, x + 1, hy - 0.2, 'f');
  }
  put(g, 14, hy + 2.4, 'n'); put(g, 13.4, hy + 3.4, 'x'); put(g, 14.6, hy + 3.4, 'x');
  collar(g, [[9.2, hy + 4.6], [10.5, hy + 5.6], [12, hy + 6.2], [14, hy + 6.4], [16, hy + 6.2], [17.5, hy + 5.6], [18.8, hy + 4.6]], [14 + charm, hy + 7.6]);
  outline(g);
  return { rows: g, head: [14, hy, 7.6] };
}

// Back, walking away from you: the black tail up over her back.
function back({ step = 0, charm = 0 } = {}) {
  const g = grid();
  leg(g, 10.5, 17.5, 0, 'w', step < 0 ? 1.3 : 0);
  leg(g, 17.5, 17.5, 0, 'w', step > 0 ? 1.3 : 0);
  blob(g, 14, 15.5, 7, 5.2);
  blob(g, 14, 8.5, 6.8, 5.8);
  stroke(g, [[8.4, 4.8], [8.6, 1.8]], 1.1, 'w'); stroke(g, [[19.6, 4.8], [19.4, 1.8]], 1.1, 'w');
  collar(g, [[8, 12.6], [10, 13.4], [12, 13.8], [14, 14], [16, 13.8], [18, 13.4], [20, 12.6]], null);
  blob(g, 14, 18.8, 2.2, 1.3, 'K', false); // the black on her back, at the base of the tail
  stroke(g, [[14, 19.5], [16 + step * 0.5, 17.5], [18.6 + step * 0.6, 15.5], [20.6 + step * 0.6, 14.6]], 1.35, 'K'); // tail out to the side
  outline(g);
  return { rows: g, head: [14, 8.5, 7.4] };
}

function sleep() {
  const g = grid();
  stroke(g, [[5, 21.2], [10, 22.2], [15, 22.2], [18, 21.4]], 1.3, 'K'); // the tail wrapped round the front
  blob(g, 13, 18.4, 10, 4.6);
  blob(g, 5.6, 16.6, 1.9, 1.2, 'K', false);
  blob(g, 20.5, 16.6, 5, 4.2);
  earsSide(g, 18.2, 10.6);
  put(g, 19.4, 16.6, 'x'); put(g, 20.4, 17, 'x'); put(g, 22.4, 17, 'x'); put(g, 23.4, 16.6, 'x'); // closed eyes
  put(g, 24.4, 18.2, 'n');
  collar(g, [[16.6, 15.6], [16.3, 17.2], [16.6, 18.8]], null);
  outline(g);
  return { rows: g, head: [20.5, 16.6, 5.4] };
}

function pounce(lift = 0) {
  const g = grid();
  const y = -lift;
  stroke(g, [[6, 13 + y], [3.4, 11.4 + y], [1.8, 9.6 + y]], 1.3, 'K'); // tail streaming behind
  stroke(g, [[8, 15 + y], [5, 19 + y], [3.5, 21 + y]], 1.05, 'S'); // back legs pushing off
  stroke(g, [[9, 15 + y], [6.5, 19.5 + y], [5, 21.6 + y]], 1.05, 'w');
  blob(g, 12.5, 12.5 + y, 7.8, 4);
  blob(g, 7, 10.8 + y, 1.8, 1.1, 'K', false);
  stroke(g, [[17, 14 + y], [21, 16 + y], [24.5, 15.5 + y]], 1.05, 'S'); // front legs reaching
  stroke(g, [[17.5, 13.5 + y], [22, 14.5 + y], [25.5, 13 + y]], 1.05, 'w');
  blob(g, 19, 11 + y, 3.4, 3.3);
  blob(g, 21.2, 7 + y, 5, 4.4);
  earsSide(g, 17.8, 0.8 + y);
  put(g, 23.4, 6.4 + y, 'e'); put(g, 24.4, 6.4 + y, 'e'); put(g, 24, 6.4 + y, 'd'); put(g, 25.8, 8 + y, 'n');
  collar(g, [[17.4, 9 + y], [18.4, 10.6 + y], [20, 11.4 + y], [21.6, 11 + y]], [20, 12.6 + y]);
  outline(g);
  return { rows: g, head: [21.2, 7 + y, 6.2] };
}

function rear() {
  const g = grid();
  stroke(g, [[11, 20.4], [7, 21.2], [4.6, 19.2], [4.6, 16.4]], 1.3, 'K');
  leg(g, 11.5, 18, 0.5, 'S'); leg(g, 13.5, 18, 1, 'w');
  blob(g, 13.5, 14, 4.8, 6.4); // upright
  blob(g, 11.2, 18.6, 1.8, 1.2, 'K', false);
  stroke(g, [[16, 11], [18.5, 8], [19.8, 5.8]], 1.05, 'S'); // paws up
  stroke(g, [[16.5, 12], [20, 9.4], [21.6, 7.4]], 1.05, 'w');
  blob(g, 15.5, 4.8, 4.8, 4.2);
  earsSide(g, 12.6, -0.4);
  put(g, 17.6, 4.2, 'e'); put(g, 18.6, 4.2, 'e'); put(g, 18.2, 4.2, 'd'); put(g, 20, 5.8, 'n');
  collar(g, [[12.2, 7.8], [13.4, 9], [15, 9.6], [16.8, 9.2]], [15, 10.8]);
  outline(g);
  return { rows: g, head: [15.5, 4.8, 6] };
}

// --- the diving helmet: a glass dome over her head, three rows of room above ---

function diver({ rows, head: [cx, cy, r] }) {
  const g = [...Array.from({ length: 3 }, () => Array(W).fill('.')), ...rows.map((row) => [...row])];
  const y0 = cy + 3;
  const rr = r + 0.6;
  const rim = Math.min(g.length - 1, Math.round(y0 + rr * 0.62));
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - y0);
      const a = Math.atan2(y + 0.5 - y0, x + 0.5 - cx);
      if (y < rim && Math.abs(d - rr) < 0.55) g[y][x] = 'g';
      else if (y < rim && d < rr - 1 && d > rr - 2.6 && a > -2.6 && a < -1.9) g[y][x] = 'H';
    }
  }
  for (let x = Math.ceil(cx - rr * 0.8); x <= Math.floor(cx + rr * 0.8); x++) g[rim][x] = 'G';
  const top = Math.round(y0 - rr) - 1;
  if (top >= 0) { put(g, cx - 1, top, 'h'); put(g, cx, top, 'o'); put(g, cx + 1, top, 'h'); }
  return { rows: g, head: [cx, y0, r] };
}

// --- all her frames ---

export function catFrames() {
  const frames = {
    // side walk: diagonal pairs, four frames to a stride
    side0: side({ legs: [-1.4, 1.4, 1.4, -1.4], charm: 1 }),
    side1: side({ lift: [1.6, 0, 0, 1.6], body: -0.4, charm: 0 }),
    side2: side({ legs: [1.4, -1.4, -1.4, 1.4], charm: -1 }),
    side3: side({ lift: [0, 1.6, 1.6, 0], body: -0.4, charm: 0 }),
    sideStand: side({ tail: 0.5 }),
    sideLow: side({ low: true }), // nose down: sniffing, eating
    front0: front({ step: -1, charm: 1 }),
    front1: front({ step: 1, charm: -1 }),
    frontStand: front({}),
    sit: front({ sit: true }),
    back0: back({ step: -1 }),
    back1: back({ step: 1 }),
    backStand: back({}),
    sleep: sleep(),
    pounce: pounce(2.5),
    crouch: pounce(0),
    rear: rear(),
    spook: side({ arch: 2.4, puff: 1, tail: 0.3, legs: [-0.6, 0.6, 0.6, -0.6] }),
  };
  const diving = Object.fromEntries(Object.entries(frames).map(([k, f]) => [k, diver(f)]));
  return { frames, diving };
}

// One frame onto a canvas, one canvas pixel per grid pixel.
export function frameCanvas(rows) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => row.forEach((ch, x) => {
    if (!INK[ch]) return;
    ctx.fillStyle = INK[ch];
    ctx.fillRect(x, y, 1, 1);
  }));
  return canvas;
}
