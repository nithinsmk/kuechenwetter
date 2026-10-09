import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { WEATHERS, ARTIST, makeBroadcast, slotAt, berlinMidnight } from '../broadcast.js';

const $ = (id) => document.getElementById(id);
const broadcast = makeBroadcast();
const NAZIFEH = 'nazifeh'; // the playlist key for songs with no weather

// --- small helpers ---

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children.flat()) if (child != null) node.append(child);
  return node;
}

const colour = (weather) => `var(--${weather || NAZIFEH})`;
const chip = (weather) => el('span', { className: 'chip', textContent: weather || ARTIST, style: `--chip:${colour(weather)}` });
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hhmm = (ms) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(ms);
const credit = (t) => `${t.artist} – ${t.title}`;

function ago(iso) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

let toastTimer;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}

async function call(method, path, body, query = {}) {
  const url = `/api/${path}?${new URLSearchParams(query)}`;
  const response = await fetch(url, {
    method,
    body: body instanceof Blob ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

// --- state ---

let requests = [];
let storage = null;
const present = new Set();

async function loadTracks() {
  broadcast.setTracks(await call('GET', 'tracks'));
  renderLibrary();
  renderDay();
}
async function loadRequests() {
  requests = await call('GET', 'requests');
  renderRequests();
}
async function loadStorage() {
  storage = await call('GET', 'storage');
  renderStorage();
}
const reloadAll = () => Promise.all([loadTracks(), loadRequests(), loadStorage()]).catch((e) => toast(e.message));

// --- on air, next, the clock ---

function renderNow() {
  const now = Date.now();
  $('clock').textContent = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  const plan = broadcast.plan(now);
  const at = broadcast.at(now);

  $('now-weather').replaceWith(Object.assign(chip(at?.ident ? null : plan.weather), { id: 'now-weather' }));
  $('now-until').textContent = at?.ident ? 'between weathers' : `until ${hhmm(plan.end)}${plan.borrowed ? ' · no songs of its own yet, borrowing' : ''}`;
  $('now-playing').textContent = at ? credit(at.track) : 'nothing on air yet';
  $('now-progress').style.width = at ? `${(at.offset / at.track.seconds) * 100}%` : '0';
  $('now-elapsed').textContent = at ? mmss(at.offset) : '0:00';
  $('now-length').textContent = at ? mmss(at.track.seconds) : '0:00';

  // the next songs, from the playing one onward
  const next = [];
  if (at && plan.sequence.length) {
    let i = at.ident ? 0 : at.index + 1;
    for (let k = 0; k < 6; k++, i++) next.push(plan.sequence[i % plan.sequence.length]);
  }
  $('next').replaceChildren(...next.map((t) => el('li', { textContent: credit(t) })));
  if (!next.length) $('next').append(el('li', { className: 'quiet', textContent: 'nothing queued' }));

  // the playhead on the day strip
  const midnight = berlinMidnight(now);
  const head = document.querySelector('.playhead');
  if (head) head.style.left = `${((now - midnight) / (24 * 3600 * 1000)) * 100}%`;
}

// --- the day: five weathers in turn ---

function renderDay() {
  const now = Date.now();
  const midnight = berlinMidnight(now);
  const current = slotAt(now).index;
  const counts = Object.fromEntries(WEATHERS.map((w) => [w, broadcast.tracks.filter((t) => t.weather === w).length]));
  const slots = WEATHERS.map((w, i) => el('div', { className: `slot${i === current ? ' current' : ''}`, style: `--c:${colour(w)}` },
    w, el('span', { className: 'n', textContent: `${counts[w]} song${counts[w] === 1 ? '' : 's'}` })));
  const ticks = WEATHERS.map((_, i) => el('span', { className: 'ident-tick', style: `left:${(i / WEATHERS.length) * 100}%`, title: `${ARTIST} plays here` }));
  $('strip').replaceChildren(...slots, ...ticks.slice(1), el('span', { className: 'playhead', style: `left:${((now - midnight) / 864e5) * 100}%` }));
}

// --- listeners ---

function renderChannels() {
  $('channels').replaceChildren(...WEATHERS.map((w) => el('div', { className: `channel${present.has(w) ? ' on' : ''}`, style: `--c:${colour(w)}` },
    el('span', { className: 'led' }), w)));
  const lamp = $('onair-lamp');
  lamp.classList.toggle('live', present.size > 0);
  $('onair-text').textContent = present.size ? `on air · ${present.size} listening` : 'on air · nobody listening';
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const channel = supabase.channel('kuechenwetter', { config: { presence: { key: `desk-${crypto.randomUUID()}` } } });
channel
  .on('presence', { event: 'sync' }, () => {
    present.clear();
    for (const metas of Object.values(channel.presenceState())) for (const m of metas) if (WEATHERS.includes(m.weather)) present.add(m.weather);
    renderChannels();
  })
  .on('broadcast', { event: 'tracks' }, () => loadTracks().catch(console.error))
  .subscribe();

// --- storage ---

function renderStorage() {
  if (!storage) return;
  const share = storage.bytes / storage.limitBytes;
  $('storage-fill').style.width = `${Math.min(100, share * 100)}%`;
  $('storage-text').textContent = `${(storage.bytes / 1e6).toFixed(0)} MB of 1 GB · ${storage.files} files`;
  // Every song streams at 128 kbps, so the allowance is best read as hours of listening (all listeners together).
  const hourBytes = (128000 / 8) * 3600;
  $('egress-text').textContent = `streaming allowance: about ${Math.floor(storage.egressLimitBytes / hourBytes)} hours of listening a month`;
}

// --- requests ---

function requestRow(r) {
  const item = el('li', { className: 'request' },
    el('span', { className: 'song', textContent: r.song }),
    r.done_at
      ? el('button', { className: 'small', textContent: 'reopen', onclick: () => setDone(r, false) })
      : el('button', { className: 'small', textContent: 'done', onclick: () => setDone(r, true) }),
    el('span', { className: 'meta' }, r.weather ? chip(r.weather) : el('span', { textContent: 'any weather' }), ago(r.created_at)));
  if (!r.done_at) {
    item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('over'); });
    item.addEventListener('dragleave', () => item.classList.remove('over'));
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('over');
      const file = [...e.dataTransfer.files][0];
      if (!file) return;
      await loadFiles([file], { weather: r.weather || $('load-weather').value || null, fulfils: r });
    });
  }
  return item;
}

function renderRequests() {
  const open = requests.filter((r) => !r.done_at);
  $('rq-count').textContent = open.length ? `· ${open.length} open` : '';
  $('requests').replaceChildren(...open.map(requestRow));
  if (!open.length) $('requests').append(el('li', { className: 'empty', textContent: 'no open requests' }));
  $('requests-done').replaceChildren(...requests.filter((r) => r.done_at).map(requestRow));
}

async function setDone(r, done) {
  try {
    await call('PATCH', `requests/${r.id}`, { done });
    await loadRequests();
  } catch (e) { toast(e.message); }
}

// --- loading songs ---

// "01 Artist - Song.mp3" -> { artist, song }
function parseName(name) {
  const stem = name.replace(/\.[^.]+$/, '').replace(/^\s*\d+[\s._-]*/, '');
  const [artist, ...rest] = stem.split(' - ');
  return rest.length ? { artist: artist.trim(), song: rest.join(' - ').trim() } : { artist: '', song: stem.trim() };
}

async function loadFiles(files, { weather = $('load-weather').value || null, fulfils = null } = {}) {
  const today = $('load-when').value === 'today';
  const mix = $('load-mix').value.trim();
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  let added = 0;

  for (const [i, file] of sorted.entries()) {
    const { artist, song } = parseName(file.name);
    const asMix = mix && !fulfils;
    const query = {
      filename: file.name,
      artist: asMix ? ARTIST : artist || 'unknown',
      title: asMix ? `${mix} · ${artist ? `${artist} – ` : ''}${song}` : song,
      part: asMix ? i + 1 : 1,
      weather: asMix ? '' : weather || '',
      today: today ? '1' : '',
    };
    const line = el('li', { textContent: `${file.name} · uploading…` });
    $('queue').prepend(line);
    try {
      await call('POST', 'upload', file, query);
      line.textContent = `${query.artist} – ${query.title} · ${today ? 'on air now' : 'on air from midnight'}`;
      line.className = 'ok';
      added++;
    } catch (e) {
      line.textContent = `${file.name} · ${e.message}`;
      line.className = 'err';
    }
  }

  if (added && today) await call('POST', 'notify').catch(() => {});
  if (added && fulfils) await call('PATCH', `requests/${fulfils.id}`, { done: true }).catch(() => {});
  if (added) toast(`${added} song${added === 1 ? '' : 's'} added`);
  await reloadAll();
}

const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); loadFiles(e.dataTransfer.files); });
$('files').addEventListener('change', (e) => { loadFiles(e.target.files); e.target.value = ''; });
// a drop anywhere else shouldn't open the file in the browser
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

for (const w of WEATHERS) $('load-weather').append(el('option', { value: w, textContent: w }));

// --- playlists ---

function trackCard(t) {
  const midnight = berlinMidnight(Date.now());
  const waiting = Date.parse(t.added_at) >= midnight;
  const select = el('select', { 'aria-label': `playlist for ${t.title}` },
    el('option', { value: '', textContent: ARTIST }),
    ...WEATHERS.map((w) => el('option', { value: w, textContent: w })));
  select.value = t.weather || '';
  select.addEventListener('change', async () => {
    try { await call('PATCH', `tracks/${t.id}`, { weather: select.value || null }); await loadTracks(); toast('moved'); }
    catch (e) { toast(e.message); }
  });

  const remove = el('button', { className: 'small danger', textContent: 'remove' });
  remove.addEventListener('click', async () => {
    if (remove.dataset.armed !== '1') { remove.dataset.armed = '1'; remove.textContent = 'sure?'; return; }
    try { await call('DELETE', `tracks/${t.id}`); await reloadAll(); toast('removed'); }
    catch (e) { toast(e.message); }
  });

  const tools = el('div', { className: 'tools' }, select, remove);
  if (waiting) {
    tools.prepend(el('span', { className: 'badge', textContent: 'airs from midnight' }));
    tools.append(el('button', { className: 'small', textContent: 'on air now', onclick: async () => {
      try { await call('PATCH', `tracks/${t.id}`, { today: true }); await loadTracks(); toast('on air now'); }
      catch (e) { toast(e.message); }
    } }));
  }
  return el('div', { className: 'track' }, el('span', { className: 'title', textContent: `${credit(t)} · ${mmss(t.seconds)}` }), tools);
}

function renderLibrary() {
  const groups = [...WEATHERS, null];
  $('library').replaceChildren(...groups.map((w) => {
    const list = broadcast.tracks.filter((t) => (t.weather || null) === w);
    const minutes = Math.round(list.reduce((s, t) => s + t.seconds, 0) / 60);
    return el('div', { className: 'column', style: `--c:${colour(w)}` },
      el('h3', { textContent: w || `${ARTIST} · between weathers` }),
      el('span', { className: 'total', textContent: `${list.length} songs · ${minutes} min` }),
      ...(list.length ? list.map(trackCard) : [el('p', { className: 'empty', textContent: 'empty: borrows from all songs' })]));
  }));
}

// --- start ---

renderChannels();
await reloadAll();
renderNow();
setInterval(renderNow, 1000);
setInterval(() => loadRequests().catch(console.error), 30 * 1000);
setInterval(() => { loadTracks().catch(console.error); loadStorage().catch(console.error); }, 2 * 60 * 1000);
