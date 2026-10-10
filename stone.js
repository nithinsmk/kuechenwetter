// The stone on the way in, in big pixels like an item in a 90s game (Contra and the like):
// seen a little from above so its thick edge shows, a rough chipped rim, hard-edged greys with
// dithered shading lit from the top left, a groove ring with spirals cut into it, two cracks.
// Drawn small on a canvas; the page scales it up unsmoothed.

export function carveStone(canvas, narrow) {
  const W = 120;
  const H = narrow ? 104 : 86;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H * 0.44;
  const rx = W / 2 - 3;
  const ry = H * 0.42 - 2;
  const depth = Math.round(H * 0.1); // the thickness showing below
  const rough = (a) => 1 + 0.035 * Math.sin(a * 7 + 1) + 0.025 * Math.sin(a * 13 + 4) + (Math.sin(a * 37) > 0.93 ? -0.05 : 0);
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const TOP = ['#5d5952', '#77726a', '#918b80', '#aaa395', '#c3bcac'];
  const SIDE = ['#2c2a26', '#3d3a34', '#4f4b44'];
  const inside = (x, y, oy = 0) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy - oy) / ry;
    return Math.hypot(dx, dy) <= rough(Math.atan2(dy, dx));
  };
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const top = inside(x, y);
    const side = !top && [...Array(depth).keys()].some((d) => inside(x, y, d + 1));
    if (!top && !side) continue;
    const dither = BAYER[y % 4][x % 4] / 16 - 0.5;
    if (side) { // the edge: darker, banded, lit a little from the left
      const lit = 0.5 - (x - cx) / rx * 0.45 + dither * 0.6;
      px(x, y, SIDE[Math.max(0, Math.min(2, Math.floor(lit * 3)))]);
      continue;
    }
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const r = Math.hypot(dx, dy);
    // a gentle dome lit from the top left, plus grain
    const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
    const light = 0.62 - dx * 0.28 - dy * 0.32 - r * r * 0.2 + dither * 0.35 + grain * 0.08;
    px(x, y, TOP[Math.max(0, Math.min(4, Math.floor(light * 5)))]);
  }
  // the outline, hard and dark
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const solid = (xx, yy) => inside(xx, yy) || [...Array(depth).keys()].some((d) => inside(xx, yy, d + 1));
    if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) px(x, y, '#14130f');
  }
  // cut lines: dark in the groove, a light lip just under it
  const cutAt = (x, y) => { x = Math.round(x); y = Math.round(y); if (!inside(x, y)) return; px(x, y, '#2a2723'); if (inside(x, y + 1)) px(x, y + 1, '#d2cbb9'); };
  for (const f of [0.93, 0.8]) for (let a = 0; a < Math.PI * 2; a += 0.01) cutAt(cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f);
  const SPIRALS = 18;
  for (let k = 0; k < SPIRALS; k++) { // a ring of little curls between the two grooves
    const a = (k / SPIRALS) * Math.PI * 2;
    const sx = cx + Math.cos(a) * rx * 0.865;
    const sy = cy + Math.sin(a) * ry * 0.865;
    const flip = k % 2 ? 1 : -1;
    for (let t = 0; t < Math.PI * 3.2; t += 0.12) {
      const rr = 0.35 + t * 0.42;
      cutAt(sx + Math.cos(t * flip + a) * rr, sy + Math.sin(t * flip + a) * rr * 0.75);
    }
  }
  // two cracks
  for (const [x0, y0, steps, dir] of [[cx - rx * 0.74, cy - ry * 0.5, 8, 1], [cx + rx * 0.7, cy + ry * 0.42, 7, -1]]) { // near the rim, clear of the words
    let x = x0;
    let y = y0;
    for (let s = 0; s < steps; s++) { cutAt(x, y); x += dir * (0.8 + (s % 3 === 0 ? 0.6 : 0)); y += s % 2 ? 1 : 0.4; }
  }
}
