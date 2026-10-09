// The aquarium: tap the little fish bowl and soft water rises a quarter of the screen each
// time; at the fourth tap the kitchen is under water, pixel koi swim in from the sides and
// Salvia puts on her glass diving helmet. Once full it only drains by itself, after 169
// seconds (more taps just slosh the bowl). Every radio that's open floods together (a broadcast on
// the station's channel); anyone opening the radio later finds it dry.

const DRAIN_AFTER = 169 * 1000;
const KOI_ON_SCREEN = 13;

// --- the bowl button: pixel glass with its own water, 14 × 12 ---
const BOWL = [
  '..gggggggggg..', '.g..........g.', 'g............g', 'g............g', 'g............g', 'g............g',
  'g............g', 'g............g', '.g..........g.', '..g........g..', '...gggggggg...', '....GGGGGG....',
];
function drawBowl(button, level) {
  const px = 3;
  const rows = BOWL.length;
  let out = '';
  BOWL.forEach((row, y) => [...row].forEach((ch, x) => {
    // the water inside, filling from the bottom (rows 2–9)
    const inside = ch === '.' && x > 0 && x < row.length - 1 && y >= 2 && y <= 9 && row.slice(0, x).includes('g') && row.slice(x).includes('g');
    const waterTop = 10 - level * 2;
    if (inside && y >= waterTop) out += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${y === waterTop ? '#9fe3f5' : '#4fb3dc'}"/>`;
    if (ch === 'g') out += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="#d9f1f8"/>`;
    if (ch === 'G') out += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="#8a96a6"/>`;
  }));
  // a highlight on the glass, and a tiny koi once it's full
  out += `<rect x="${3 * px}" y="${3 * px}" width="${px}" height="${2 * px}" fill="#ffffff" opacity="0.9"/>`;
  if (level === 4) out += `<rect x="${6 * px}" y="${6 * px}" width="${3 * px}" height="${px}" fill="#f07a3a"/><rect x="${9 * px}" y="${6 * px}" width="${px}" height="${px}" fill="#f4f1ea"/>`;
  button.innerHTML = `<svg viewBox="0 0 ${14 * px} ${rows * px}" width="${14 * px}" height="${rows * px}" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
}

// --- koi: pixel sprites, 18 × 7, facing right, two tail frames ---
const KOI_A = [
  '.........kkk......', '.k....kkkBBBkkk...', 'kTk.kkBBBBBBBBBkk.', 'kTTkBBBBBBBBBBBeBk',
  'kTk.kkBBBBBBBBBkk.', '.k....kkkBBBkkk...', '.......kk..kk.....'];
const KOI_B = [
  '.........kkk......', '......kkkBBBkkk...', '.k..kkBBBBBBBBBkk.', 'kTTkBBBBBBBBBBBeBk',
  'kTk.kkBBBBBBBBBkk.', 'kTk...kkkBBBkkk...', '.k.....kk..kk.....'];
const VARIETIES = {
  kohaku: { base: '#f4f1ea', patches: ['#e0432b'] },
  sanke: { base: '#f4f1ea', patches: ['#e0432b', '#e0432b', '#1e1a1a'] },
  showa: { base: '#1e1a1a', patches: ['#e0432b', '#f4f1ea'] },
  ogon: { base: '#e8b33a', patches: ['#f6d77a'] },
  asagi: { base: '#6f8fb0', patches: ['#9fb6cc'], belly: '#d65a3a' },
  tancho: { base: '#f4f1ea', patches: [], spot: '#e0432b' },
  chagoi: { base: '#b8743a', patches: ['#cf8d4f'] },
};

function koiCanvas(rows, variety, patches) {
  const canvas = document.createElement('canvas');
  canvas.width = 18;
  canvas.height = 7;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    let colour = null;
    if (ch === 'k') colour = '#3a2a22';
    if (ch === 'e') colour = '#0d0d0d';
    if (ch === 'T') colour = variety.base;
    if (ch === 'B') {
      colour = variety.base;
      for (const p of patches) if (Math.hypot(x - p.x, (y - p.y) * 1.4) < p.r) colour = p.colour;
      if (variety.belly && y >= 4) colour = variety.belly;
      if (variety.spot && Math.hypot(x - 14, y - 1.8) < 1.6) colour = variety.spot;
    }
    if (!colour) return;
    ctx.fillStyle = colour;
    ctx.globalAlpha = ch === 'T' ? 0.75 : 1; // the tail fin a little see-through
    ctx.fillRect(x, y, 1, 1);
  }));
  return canvas;
}

function makeKoi(pond) {
  const names = Object.keys(VARIETIES);
  const variety = VARIETIES[names[Math.floor(Math.random() * names.length)]];
  const patches = variety.patches.map((colour) => ({ colour, x: 5 + Math.random() * 10, y: 1 + Math.random() * 4, r: 1.6 + Math.random() * 1.6 }));
  const el = document.createElement('div');
  el.className = 'koi';
  const a = koiCanvas(KOI_A, variety, patches);
  const b = koiCanvas(KOI_B, variety, patches);
  b.className = 'tail-b';
  el.append(a, b);
  pond.append(el);
  return el;
}

// --- the whole thing ---

export function mountAquarium({ button, channel, salvia }) {
  const water = document.createElement('div');
  water.id = 'water';
  water.innerHTML = '<div class="body"><div class="surface"></div><div class="pond"></div></div>';
  document.getElementById('stage').after(water);
  const pond = water.querySelector('.pond');
  const body = water.querySelector('.body');
  let level = 0;
  let drainTimer = null;
  let diveTimer = null;

  function setLevel(n, fromOthers = false) {
    level = n;
    water.style.setProperty('--level', String(n));
    water.classList.toggle('wet', n > 0);
    drawBowl(button, n);
    button.setAttribute('aria-label', n === 4 ? 'the fish bowl (full; it drains by itself)' : `the fish bowl (water ${n} of 4)`);
    clearTimeout(drainTimer);
    clearTimeout(diveTimer);
    if (n === 4) {
      drainTimer = setTimeout(() => setLevel(0), DRAIN_AFTER);
      diveTimer = setTimeout(() => { if (level === 4) { salvia.dive(true); fillPond(); } }, 1700); // once the water's up
    } else {
      salvia.dive(false);
      emptyPond();
    }
    if (!fromOthers) channel.send({ type: 'broadcast', event: 'flood', payload: { level: n } });
  }
  button.addEventListener('click', () => {
    if (level >= 4) { // full: only time drains it
      button.classList.remove('slosh'); void button.offsetWidth; button.classList.add('slosh');
      return;
    }
    setLevel(level + 1);
  });
  channel.on('broadcast', { event: 'flood' }, ({ payload }) => setLevel(Number(payload?.level) || 0, true));
  drawBowl(button, 0);

  // Koi: a couple of schools and some loners, coming back round when they leave.
  let fish = [];
  function swimmer(school) {
    const size = school ? school.size * (0.85 + Math.random() * 0.3) : 3 + Math.random() * 4.5; // css px per pixel
    const el = makeKoi(pond);
    el.style.width = `${18 * size}px`;
    return { el, size, school, dx: 0, dy: 0, phase: Math.random() * 6.3, x: 0, y: 0, dir: 1, speed: 0 };
  }
  function launch(f, w, h, first) {
    f.dir = f.school ? f.school.dir : (Math.random() < 0.5 ? 1 : -1);
    f.speed = f.school ? f.school.speed : (70 - f.size * 6) * (0.7 + Math.random() * 0.6);
    const startX = f.dir > 0 ? -18 * f.size - Math.random() * (first ? w : 200) : w + Math.random() * (first ? w : 200);
    f.x = startX + (f.school ? -f.dir * f.dx : 0);
    f.y = (f.school ? f.school.y + f.dy : 0.08 * h + Math.random() * 0.8 * h);
  }
  function fillPond() {
    emptyPond();
    const w = body.clientWidth;
    const h = body.clientHeight;
    const schools = [
      { dir: Math.random() < 0.5 ? 1 : -1, speed: 45, size: 3, y: 0.25 * h, count: 4 },
      { dir: Math.random() < 0.5 ? 1 : -1, speed: 32, size: 4.5, y: 0.65 * h, count: 3 },
    ];
    for (const s of schools) {
      for (let k = 0; k < s.count; k++) {
        const f = swimmer(s);
        f.dx = k * 18 * s.size * 0.9 + Math.random() * 20;
        f.dy = (Math.random() - 0.5) * 60;
        fish.push(f);
      }
    }
    while (fish.length < KOI_ON_SCREEN) fish.push(swimmer(null));
    for (const f of fish) launch(f, w, h, true);
  }
  function emptyPond() { for (const f of fish) f.el.remove(); fish = []; }

  // Bubbles: from her helmet the whole time she's down there, and now and then from the floor.
  function bubble(x, y, big = false) {
    const b = document.createElement('span');
    b.className = 'bubble';
    const r = big ? 6 + Math.random() * 6 : 3 + Math.random() * 4;
    const top = body.getBoundingClientRect().top; // inside the water, so they pop at its surface
    b.style.cssText = `left:${x}px;top:${y - top}px;width:${r}px;height:${r}px;--rise:${y - top + 20}px;--drift:${(Math.random() - 0.5) * 30}px;animation-duration:${3 + Math.random() * 3}s`;
    b.addEventListener('animationend', () => b.remove());
    body.append(b);
  }

  let last = 0;
  let lastBubble = 0;
  function frame(time) {
    const dt = Math.min(0.1, (time - last) / 1000);
    last = time;
    if (fish.length) {
      const w = body.clientWidth;
      const h = body.clientHeight;
      for (const f of fish) {
        f.x += f.dir * f.speed * dt;
        const bob = Math.sin(time / 1000 * 0.9 + f.phase) * (6 + f.size * 2);
        f.el.style.transform = `translate(${f.x}px, ${f.y + bob}px) scaleX(${f.dir})`;
        const gone = f.dir > 0 ? f.x > w + 40 : f.x < -18 * f.size - 40;
        if (gone && (!f.school || f === fish.find((g) => g.school === f.school))) {
          if (f.school) { f.school.y = 0.08 * h + Math.random() * 0.8 * h; for (const g of fish.filter((g) => g.school === f.school)) launch(g, w, h, false); }
          else launch(f, w, h, false);
        }
      }
    }
    if (level > 0 && time - lastBubble > 420) {
      lastBubble = time;
      const helmet = salvia.helmetPoint();
      if (helmet) bubble(helmet.x, helmet.y);
      if (Math.random() < 0.35) bubble(Math.random() * innerWidth, innerHeight - 4, true);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { get level() { return level; }, setLevel };
}
