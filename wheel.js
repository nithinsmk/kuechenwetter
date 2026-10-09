// The duty wheel: a replica of the cardboard wheel on the fridge. Five duties and a free
// period for six people; every two weeks each clip moves one section clockwise.
//
// Who has which duty is worked out from the calendar, so the wheel turns by itself at
// Berlin midnight. Only clips moved to "Done" (and back) are stored, in wheel_moves,
// which is also the log under the big wheel. Within its two weeks a clip creeps across
// its section, so the wheel's slow turn shows how much time is left.
import { berlinClock, berlinMidnight } from './broadcast.js';

const START = '2026-10-03'; // the first day of the first two weeks (Berlin)
const DAYS = 14;
// Clockwise from the top, as drawn on the fridge. "Done" sits between Free and Kitchen.
const SECTIONS = ['Kitchen', 'Bathroom shower', 'Hallway', 'Small toilet', 'Miscellaneous', 'Free'];
const FREE = 5;
const DONE = 6;
// The clips, in the order they sat on the sections in the first two weeks.
const CLIPS = ['F', 'N', 'P', 'A', 'E', 'S'];
const DAY = 86400000;

// --- the calendar ---

const dayNumber = (day) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY);
const midnightOf = (n) => berlinMidnight(n * DAY + 12 * 3600 * 1000);

export function periodAt(now) {
  const first = dayNumber(START);
  const index = Math.floor((dayNumber(berlinClock(now).day) - first) / DAYS);
  const start = midnightOf(first + index * DAYS);
  const end = midnightOf(first + (index + 1) * DAYS);
  return { index, start, end, progress: Math.min(1, Math.max(0, (now - start) / (end - start))) };
}

export const sectionOf = (clip, index) => (((CLIPS.indexOf(clip) + index) % 6) + 6) % 6;

// --- drawing ---

const W = 410, H = 340, CX = 205, CY = 170;
const BOARD = { rx: 156, ry: 120 }; // the cardboard's cut edge, where the clips hold on
const OUTER = { rx: 147, ry: 112 }; // the marker line around the sections
const INNER = { rx: 88, ry: 58 }; // the middle field
const STEP = 360 / 7;
const sectionStart = (i) => (i - 0.5) * STEP; // Kitchen is centred at the top
const SVG = 'http://www.w3.org/2000/svg';
const f = (n) => Math.round(n * 10) / 10;

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of [].concat(children)) node.append(c);
  return node;
}

// A point on an ellipse at an angle measured clockwise from the top.
function point(e, deg) {
  const a = (deg * Math.PI) / 180;
  return [CX + e.rx * Math.sin(a), CY - e.ry * Math.cos(a)];
}

// Clockwise from the top, as an angle on the board (accounts for its oval shape).
function angleAt(x, y) {
  const deg = (Math.atan2((x - CX) / OUTER.rx, -(y - CY) / OUTER.ry) * 180) / Math.PI;
  return (deg + 360) % 360;
}
const sectionAt = (deg) => Math.floor(((deg + STEP / 2) % 360) / STEP);
const reach = (x, y) => Math.hypot((x - CX) / OUTER.rx, (y - CY) / OUTER.ry);

function sectorPath(i) {
  const a0 = sectionStart(i), a1 = a0 + STEP;
  const [x0, y0] = point(OUTER, a0), [x1, y1] = point(OUTER, a1);
  const [x2, y2] = point(INNER, a1), [x3, y3] = point(INNER, a0);
  return `M${f(x0)} ${f(y0)} A${OUTER.rx} ${OUTER.ry} 0 0 1 ${f(x1)} ${f(y1)} `
    + `L${f(x2)} ${f(y2)} A${INNER.rx} ${INNER.ry} 0 0 0 ${f(x3)} ${f(y3)} Z`;
}

// Written along the band, never upside down, like the marker on the fridge.
function label(i, text) {
  const mid = sectionStart(i) + STEP / 2;
  const [x, y] = point({ rx: (OUTER.rx + INNER.rx) / 2, ry: (OUTER.ry + INNER.ry) / 2 }, mid);
  const a = (mid * Math.PI) / 180;
  let turn = (Math.atan2(OUTER.ry * Math.sin(a), OUTER.rx * Math.cos(a)) * 180) / Math.PI;
  if (turn > 90) turn -= 180;
  if (turn < -90) turn += 180;
  const lines = text.split(' ');
  const node = el('text', { class: 'w-label', transform: `translate(${f(x)} ${f(y)}) rotate(${f(turn)})` });
  lines.forEach((line, n) => node.append(el('tspan', { x: 0, y: f((n - (lines.length - 1) / 2) * 17 + 6) }, line)));
  return node;
}

// The clockwise arrows drawn in the middle of the board.
function arrows(x, y, id) {
  const g = el('g', { class: 'w-arrows' });
  const r = 11;
  const colours = ['#b4405b', '#4a9a92', '#b4405b', '#7fa7a3'];
  for (let k = 0; k < 4; k++) {
    const at = (deg) => [x + r * Math.sin((deg * Math.PI) / 180), y - r * Math.cos((deg * Math.PI) / 180)];
    const [dx, dy] = at(k * 90);
    g.append(el('circle', { cx: f(dx), cy: f(dy), r: 2.6, fill: colours[k] }));
    const [sx, sy] = at(k * 90 + 22), [ex, ey] = at(k * 90 + 68);
    g.append(el('path', { d: `M${f(sx)} ${f(sy)} A${r} ${r} 0 0 1 ${f(ex)} ${f(ey)}`, 'marker-end': `url(#${id}-tip)` }));
  }
  return g;
}

// A wooden clothes clip with an initial on it. Drawn pointing up; the group is turned so
// it sticks out from the board's edge.
function clip(initial) {
  return el('g', { class: 'w-clip', 'data-clip': initial, tabindex: '-1' }, [
    el('rect', { class: 'w-wood', x: -7, y: -46, width: 14, height: 68, rx: 2.5 }),
    el('line', { class: 'w-split', x1: 0, y1: -45, x2: 0, y2: 21 }),
    el('rect', { class: 'w-spring', x: -8.5, y: -6, width: 17, height: 7, rx: 1.5 }),
    el('text', { class: 'w-initial', x: 0, y: -21 }, initial),
  ]);
}

let drawn = 0;

function board(svg) {
  const id = `w${++drawn}`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.append(el('defs', {}, [
    el('pattern', { id: `${id}-card`, width: 9, height: 10, patternUnits: 'userSpaceOnUse' }, [
      el('rect', { width: 9, height: 10, fill: '#cfb38b' }),
      el('rect', { width: 3, height: 10, fill: '#c6a97f' }),
    ]),
    ...[['red', '#c4475c'], ['teal', '#3f8f88'], ['pink', '#cc5d78']].map(([name, colour]) =>
      el('pattern', { id: `${id}-${name}`, width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-32)' }, [
        el('line', { x1: 0, y1: 0, x2: 0, y2: 4, stroke: colour, 'stroke-width': 1.1, opacity: 0.6 }),
      ])),
    el('filter', { id: `${id}-hand`, x: '-5%', y: '-5%', width: '110%', height: '110%' }, [
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.04, numOctaves: 2, seed: 7, result: 'noise' }),
      el('feDisplacementMap', { in: 'SourceGraphic', in2: 'noise', scale: 3.5, xChannelSelector: 'R', yChannelSelector: 'G' }),
    ]),
    el('marker', { id: `${id}-tip`, viewBox: '0 0 6 6', refX: 3, refY: 3, markerWidth: 4, markerHeight: 4, orient: 'auto' }, [
      el('path', { d: 'M0 0 L6 3 L0 6', fill: 'none', stroke: '#1d1a17', 'stroke-width': 1.4 }),
    ]),
  ]));

  const shading = { 2: 'teal', 4: 'pink', [DONE]: 'red' };
  const sectors = el('g', { filter: `url(#${id}-hand)` });
  sectors.append(el('ellipse', { class: 'w-board', cx: CX, cy: CY, rx: BOARD.rx, ry: BOARD.ry, fill: `url(#${id}-card)` }));
  for (let i = 0; i <= DONE; i++) {
    const fill = shading[i] ? `url(#${id}-${shading[i]})` : 'none';
    sectors.append(el('path', { class: 'w-section', 'data-section': i, d: sectorPath(i), fill }));
  }
  sectors.append(el('ellipse', { class: 'w-line', cx: CX, cy: CY, rx: INNER.rx, ry: INNER.ry, fill: 'none' }));
  SECTIONS.forEach((name, i) => sectors.append(label(i, name)));
  sectors.append(label(DONE, '★Done★'));
  sectors.append(el('text', { class: 'w-title', x: CX, y: CY - 6 }, 'Household Cleaning'));
  sectors.append(el('text', { class: 'w-title', x: CX + 6, y: CY + 18 }, 'Rotation'));
  sectors.append(arrows(CX + 52, CY + 30, id));
  svg.append(sectors);
  // The two fridge magnets holding the board up: one on the middle's edge, one under the title.
  svg.append(el('circle', { class: 'w-magnet', cx: CX - 90, cy: CY - 24, r: 10 }));
  svg.append(el('circle', { class: 'w-magnet', cx: CX - 8, cy: CY + 40, r: 10 }));

  const clips = el('g', { class: 'w-clips' });
  for (const initial of CLIPS) clips.append(clip(initial));
  svg.append(clips);
  return svg;
}

// --- the wheel on the page ---

export function mountWheel({ supabase, channel, corner, dialog }) {
  const small = board(corner.querySelector('svg'));
  const big = board(dialog.querySelector('svg'));
  const $ = (name) => dialog.querySelector(`[data-wheel="${name}"]`);
  let period = periodAt(Date.now());
  let moves = []; // { period, clip, done, created_at }, oldest first

  const isDone = (initial, index = period.index) => {
    const last = moves.filter((m) => m.period === index && m.clip === initial).at(-1);
    return !!last?.done;
  };

  // Where each clip sits: creeping across its own section, or resting in Done.
  function placeClips(svg) {
    const inDone = CLIPS.filter((c) => isDone(c));
    for (const node of svg.querySelectorAll('.w-clip')) {
      const initial = node.dataset.clip;
      const section = sectionOf(initial, period.index);
      const deg = inDone.includes(initial)
        ? sectionStart(DONE) + (STEP * (inDone.indexOf(initial) + 1)) / (inDone.length + 1)
        : sectionStart(section) + STEP * (0.18 + 0.64 * period.progress);
      const [x, y] = point(BOARD, deg);
      node.style.transform = `translate(${f(x)}px, ${f(y)}px) rotate(${f(deg)}deg)`;
      node.querySelector('.w-initial').style.transform = `rotate(${f(-deg)}deg)`;
      node.classList.toggle('free', section === FREE);
      node.setAttribute('aria-label', section === FREE
        ? `${initial}: free these two weeks`
        : `${initial}: ${SECTIONS[section]}${isDone(initial) ? ', done' : ''}`);
    }
    const summary = SECTIONS.map((name, i) => `${name}: ${CLIPS.find((c) => sectionOf(c, period.index) === i)}`);
    svg.setAttribute('aria-label', `The duty wheel. ${summary.join('. ')}. Done: ${inDone.join(', ') || 'nobody yet'}.`);
  }

  function timeLeft(short) {
    const ms = Math.max(0, period.end - Date.now());
    const days = Math.floor(ms / DAY), hours = Math.floor((ms % DAY) / 3600000);
    if (short) return days >= 1 ? `turns in ${days} day${days === 1 ? '' : 's'}` : `turns in ${hours} h`;
    const when = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' })
      .format(period.end);
    return `the wheel turns in ${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}: midnight into ${when}.`;
  }

  const stamp = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' });

  function renderLog() {
    const list = $('log');
    list.replaceChildren();
    for (const m of moves.filter((m) => m.period === period.index).reverse()) {
      const where = m.done ? 'Done' : SECTIONS[sectionOf(m.clip, m.period)];
      list.append(Object.assign(document.createElement('li'), {
        textContent: `${m.clip} → ${where} · ${stamp.format(new Date(m.created_at))}`,
      }));
    }
    if (period.index > 0) {
      const last = period.index - 1;
      const missed = CLIPS.filter((c) => sectionOf(c, last) !== FREE && !isDone(c, last))
        .map((c) => SECTIONS[sectionOf(c, last)]);
      list.append(Object.assign(document.createElement('li'), {
        className: 'w-last',
        textContent: missed.length
          ? `the last two weeks: ${missed.join(', ')} ${missed.length === 1 ? "wasn't" : "weren't"} marked done.`
          : 'the last two weeks: every duty was marked done.',
      }));
    }
    if (!list.children.length) {
      list.append(Object.assign(document.createElement('li'), { textContent: 'nothing in the log yet.' }));
    }
  }

  function render() {
    placeClips(small);
    placeClips(big);
    corner.querySelector('[data-wheel="time"]').textContent = timeLeft(true);
    $('time').textContent = timeLeft(false);
    renderLog();
  }

  async function load() {
    const { data, error } = await supabase.from('wheel_moves')
      .select('period, clip, done, created_at').gte('period', period.index - 1).order('created_at');
    if (error) return console.warn('wheel:', error.message);
    moves = data;
    render();
  }

  async function move(initial, done) {
    if (isDone(initial) === done) return render();
    const row = { period: period.index, clip: initial, done, created_at: new Date().toISOString() };
    moves.push(row);
    render();
    const { error } = await supabase.from('wheel_moves').insert({ period: row.period, clip: initial, done });
    if (error) {
      console.warn('wheel:', error.message);
      moves.splice(moves.indexOf(row), 1);
      render();
      return note("that didn't stick. try again?");
    }
    note(done ? `${initial} is done. thank you.` : `${initial} is back on ${SECTIONS[sectionOf(initial, period.index)]}.`);
    channel.send({ type: 'broadcast', event: 'wheel', payload: {} });
  }

  let noteTimer;
  function note(text) {
    $('note').textContent = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { $('note').textContent = ''; }, 6000);
  }

  // --- dragging a clip on the big wheel ---

  const toBoard = (event) => new DOMPoint(event.clientX, event.clientY).matrixTransform(big.getScreenCTM().inverse());
  let drag = null;

  for (const node of big.querySelectorAll('.w-clip')) {
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.addEventListener('pointerdown', (event) => {
      if (node.classList.contains('free')) return note(`${node.dataset.clip} is free these two weeks. nothing to tick off.`);
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      drag = { node, initial: node.dataset.clip, moved: false };
      node.classList.add('dragging');
    });
    node.addEventListener('pointermove', (event) => {
      if (drag?.node !== node) return;
      const p = toBoard(event);
      const deg = angleAt(p.x, p.y);
      drag.moved = true;
      drag.over = reach(p.x, p.y) < 1.5 ? sectionAt(deg) : null;
      node.style.transform = `translate(${f(p.x)}px, ${f(p.y)}px) rotate(${f(deg)}deg)`;
      node.querySelector('.w-initial').style.transform = `rotate(${f(-deg)}deg)`;
      for (const s of big.querySelectorAll('.w-section')) s.classList.toggle('over', +s.dataset.section === drag.over);
    });
    const drop = () => {
      if (drag?.node !== node) return;
      const { initial, over, moved } = drag;
      drag = null;
      node.classList.remove('dragging');
      for (const s of big.querySelectorAll('.w-section')) s.classList.remove('over');
      if (!moved || over === null || over === undefined) return render();
      move(initial, over === DONE);
    };
    node.addEventListener('pointerup', drop);
    node.addEventListener('pointercancel', drop);
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (node.classList.contains('free')) return note(`${node.dataset.clip} is free these two weeks. nothing to tick off.`);
      move(node.dataset.clip, !isDone(node.dataset.clip));
    });
  }

  corner.addEventListener('click', () => { render(); dialog.showModal(); });

  // The log stays folded away until someone asks for it.
  $('log-toggle').addEventListener('click', () => {
    const open = $('log').hidden;
    $('log').hidden = !open;
    $('log-toggle').setAttribute('aria-expanded', String(open));
  });

  // Someone moved a clip somewhere else: everyone sees it at once.
  channel.on('broadcast', { event: 'wheel' }, () => load());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => {
    const now = periodAt(Date.now());
    const turned = now.index !== period.index;
    period = now;
    if (turned) load(); else render();
  }, 60 * 1000);

  render();
  load();
  return { periodAt, sectionOf, moves: () => moves, period: () => period };
}
