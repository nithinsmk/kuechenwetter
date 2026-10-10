import * as THREE from 'three';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, AUDIO_URL } from './config.js';
import { SCAN_DIR, createStage, progressText } from './scan.js';
import { makeBroadcast, berlinClock, seededRandom } from './broadcast.js';
import { mountWheel } from './wheel.js';
import { floatTheGallery } from './floaters.js';
import { makeSalvia } from './salvia.js';
import { buildHill } from './hill.js';
import { HAMSA, HAMSA_INK } from './hamsa.js';
import { mountAquarium } from './aquarium.js';
import { startLog } from './listenlog.js';
import { catFrames, frameCanvas } from './pixelcat.js';
import { speak } from './catspeak.js';
import { makeTheyyam } from './theyyam.js';
import { crinkle, startPurr, stopPurr, hiss } from './sounds.js';

const WEATHERS = ['fog_before_dawn', 'clearing_by_noon', 'showers_late_afternoon', 'humid_at_dusk', 'rain_after_midnight'];
const STATION = 'Küchenwetter';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

function show(el, text) {
  if (text !== undefined) el.textContent = text;
  el.hidden = !el.textContent;
}

// --- the scans, turning behind the broadcast ---

const stage = createStage($('stage'), { fit: 'fill' });
const { controls, camera } = stage;

// A slow sway across the photographed side. A full turn would show the back of the
// drainer, which the phone never saw and which is mostly fog.
const SWAY_ANGLE = THREE.MathUtils.degToRad(28);
const SWAY_PERIOD = 40; // seconds per full sway
let sway = null; // { theta, t0 } while swaying
let resumeSway;

function startSway() {
  const offset = camera.position.clone().sub(controls.target);
  sway = { theta: new THREE.Spherical().setFromVector3(offset).theta, t0: performance.now() };
}

function swayFrame(time) {
  if (!sway) return;
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta = sway.theta + SWAY_ANGLE * Math.sin(((time - sway.t0) / 1000) * (2 * Math.PI / SWAY_PERIOD));
  camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
}

// Salvia, the house cat, lives in whichever scan is showing (see salvia.js).
const salvia = makeSalvia({
  scene: stage.scene, camera, canvas: stage.renderer.domElement,
  // Pet her ten times in a row and the kitchen gives way to the hill for a few minutes.
  onTenPets: () => { hillUntil = Date.now() + 4 * 60 * 1000; showHill(); },
  onPurring: (on) => (on ? startPurr() : stopPurr()),
  // When she naps in the spoon corner, he sometimes comes and lies down beside her.
  onTap: (what) => log.tap(what),
  onGhostNap: () => { if (Math.random() < 0.5) callTheyyam('sleep'); },
  onHiss: hiss,
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPurr(); });

// The hamsa: each tap swivels round to the figure's side of the counter and plays
// the next of its scenes (for trying them out).
const FIGURE_VIEW = { from: [-0.6, 0.36, 0.4], to: [-1.03, 0.07, -0.12] }; // the spoon corner by the dish rack
const SPOON_WIDE = { from: [-0.08, 0.71, 1.02], to: [-1.03, 0.07, -0.12] }; // further back, the spoon corner still in the middle
let zoomedIn = null; // set while the talisman has the camera up close
function zoomOut() {
  clearTimeout(zoomedIn);
  zoomedIn = null;
  flyTo(SPOON_WIDE, startSway);
}
let flight = null;
function flyTo(view, after = () => { resumeSway = setTimeout(startSway, 12000); }) {
  sway = null;
  clearTimeout(resumeSway);
  flight = { from: camera.position.clone(), to: new THREE.Vector3(...view.from), fromT: controls.target.clone(), toT: new THREE.Vector3(...view.to), t0: performance.now(), after };
}
const flyFrame = (time) => {
  if (!flight) return;
  const k = Math.min(1, (time - flight.t0) / 1800);
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  camera.position.lerpVectors(flight.from, flight.to, e);
  controls.target.lerpVectors(flight.fromT, flight.toT, e);
  if (k === 1) { const { after } = flight; flight = null; after?.(); }
};
(function drawHamsa() {
  const px = 3;
  const rect = (x, y, c) => `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${c}"/>`;
  let body = '';
  let eye = '';
  HAMSA.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!HAMSA_INK[ch]) return;
    const r = rect(x, y, HAMSA_INK[ch]);
    if (y >= 3 && y <= 7 && 'wik'.includes(ch)) eye += r; else body += r;
  }));
  $('talisman').innerHTML = `<span class="turn"><svg viewBox="0 0 ${16 * px} ${20 * px}" width="${16 * px}" height="${20 * px}" shape-rendering="crispEdges" aria-hidden="true">${body}<g class="eye">${eye}</g></svg></span>`;
}());
$('talisman').addEventListener('click', () => {
  endFollow();
  const t = $('talisman');
  t.classList.remove('now'); void t.offsetWidth; t.classList.add('now');
  if (showing === 'hill' || !theyyamSpot()) return;
  // Salvia goes to the spoon corner; half the time the Theyyam comes out.
  flyTo(FIGURE_VIEW);
  salvia.investigate();
  // Back out to the wide view once he's gone (or after a while, if he doesn't come).
  clearTimeout(zoomedIn);
  if (Math.random() < 0.5) {
    zoomedIn = setTimeout(() => { if (!theyyam.busy) zoomOut(); }, 6000);
    setTimeout(() => callTheyyam(), 2500);
  } else zoomedIn = setTimeout(zoomOut, 9000);
});

// --- the Theyyam (theyyam.js): visits the spoon corner, privately, on this screen ---
let currentItem = null;
function theyyamSpot() {
  const sp = currentItem?.spoon;
  return sp && showing !== 'hill' ? { at: sp.at, bowl: new THREE.Vector3(...sp.bowl), handle: new THREE.Vector3(...sp.handle) } : null;
}
function callTheyyam(kind) {
  const spot = theyyamSpot();
  if (spot && !theyyam.busy) theyyam.visit(spot, kind);
}
// Very occasionally he comes by on his own.
setInterval(() => { if (!document.hidden && Math.random() < 0.05) callTheyyam(); }, 60 * 1000);

// The treat packet: shake it (crinkle, crinkle) and Salvia comes running.
$('treats').addEventListener('click', () => {
  crinkle();
  const packet = $('treats');
  packet.classList.remove('shake');
  void packet.offsetWidth; // restart the shake
  packet.classList.add('shake');
  for (let i = 0; i < 3; i++) {
    const word = Object.assign(document.createElement('span'), {
      className: 'crinkle-word',
      textContent: ['krsh', 'crnkl', 'tssk', 'krinkl', 'rrsh', 'chk chk'][Math.floor(Math.random() * 6)],
    });
    word.style.setProperty('--dx', `${-40 + Math.random() * 60}px`);
    word.style.setProperty('--turn', `${-20 + Math.random() * 40}deg`);
    word.style.animationDelay = `${i * 0.12}s`;
    word.addEventListener('animationend', () => word.remove());
    packet.append(word);
  }
  salvia.call();
});

// --- following Salvia: from behind her, or through her eyes; back to normal after 15 s ---
let follow = null; // { mode, until }
const FOLLOW_FOR = 15000;
const camAt = new THREE.Vector3();
const lookAt = new THREE.Vector3();
function endFollow() {
  if (!follow) return;
  follow = null;
  salvia.seen = true;
  controls.enabled = true;
  for (const b of document.querySelectorAll('[data-follow]')) { b.setAttribute('aria-pressed', 'false'); b.textContent = b.dataset.label; }
  flyTo({ from: controls.position0.toArray(), to: controls.target0.toArray() }, startSway);
}
function startFollow(mode) {
  if (!salvia.size) return;
  if (!salvia.where) salvia.summon(); // she's away: bring her in
  sway = null;
  clearTimeout(resumeSway);
  flight = null;
  controls.enabled = false;
  follow = { mode, until: performance.now() + FOLLOW_FOR };
  for (const b of document.querySelectorAll('[data-follow]')) { b.setAttribute('aria-pressed', String(b.dataset.follow === mode)); b.textContent = b.dataset.label; }
}
for (const b of document.querySelectorAll('[data-follow]')) {
  b.dataset.label = b.textContent;
  b.addEventListener('click', () => (follow?.mode === b.dataset.follow ? endFollow() : startFollow(b.dataset.follow)));
}
$('view-reset').addEventListener('click', () => (follow ? endFollow() : flyTo({ from: controls.position0.toArray(), to: controls.target0.toArray() }, startSway)));
let lastFrame = 0;
function followFrame(time) {
  const dt = Math.min(0.1, (time - lastFrame) / 1000);
  lastFrame = time;
  if (!follow) return;
  const left = follow.until - performance.now();
  const button = document.querySelector(`[data-follow="${follow.mode}"]`);
  if (left <= 0) return endFollow();
  button.textContent = `${button.dataset.label} · ${Math.ceil(left / 1000)}`;
  const p = salvia.where;
  if (!p) return; // not in yet
  const size = salvia.size;
  const h = salvia.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const eyes = follow.mode === 'eyes';
  salvia.seen = !eyes;
  if (eyes) { // just in front of her face, looking where she looks, a touch down
    camAt.set(p[0] + fx * size * 0.45, p[1] + size * 0.8, p[2] + fz * size * 0.45);
    lookAt.set(p[0] + fx * size * 4, p[1] + size * 0.35, p[2] + fz * size * 4);
  } else { // a little behind and above, looking at her
    camAt.set(p[0] - fx * size * 3.2, p[1] + size * 1.6, p[2] - fz * size * 3.2);
    lookAt.set(p[0] + fx * size * 0.6, p[1] + size * 0.5, p[2] + fz * size * 0.6);
  }
  const k = Math.min(1, dt * (eyes ? 9 : 4));
  camera.position.lerp(camAt, k);
  controls.target.lerp(lookAt, k);
  camera.lookAt(controls.target);
}

const theyyam = makeTheyyam({ scene: stage.scene, camera, canvas: stage.renderer.domElement, salvia, onLeave: () => { if (zoomedIn) zoomOut(); } });

stage.onFrame = (time) => {
  theyyam.update(time);
  swayFrame(time);
  flyFrame(time);
  followFrame(time);
  salvia.update(time);
};

controls.addEventListener('start', () => { sway = null; clearTimeout(resumeSway); });
controls.addEventListener('end', () => { resumeSway = setTimeout(startSway, 8000); });

let series = [];
const dateLabel = (date) => date.slice(8, 10) + '.' + date.slice(5, 7);

// The 8-bit green hill (hill.js), our own blocky landscape after that desktop hill.
// It replaces the drainer for one hour a day (the same hour for everyone, a different
// one each day), and when someone pets Salvia ten times in a row. It's drawn at a low
// resolution, so it comes out pixelated, and Salvia roams it too.
const hillHour = (day) => 8 + Math.floor(seededRandom(`${day}|hill`)() * 15); // starts between 08 and 22
function inHillHour(now = Date.now()) {
  const { day, seconds } = berlinClock(now);
  return Math.floor(seconds / 3600) === hillHour(day);
}
let showing = null; // a date, or 'hill'
let chosen = false; // someone picked a date by hand
let hillUntil = 0; // the easter egg's hill lasts a few minutes

// Back from the hill: full resolution, no painted sky.
function crisp() {
  stage.scene.background = null;
  stage.renderer.domElement.classList.remove('pixelated');
  stage.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  stage.renderer.setSize(stage.renderer.domElement.clientWidth, stage.renderer.domElement.clientHeight, false);
}

async function display(item, label) {
  endFollow();
  show($('status'), `loading ${label}`);
  try {
    const shown = await stage.show({ url: SCAN_DIR + item.file, name: item.file, focus: item.focus },
      (loaded, total) => show($('status'), `loading ${label} · ${progressText(loaded, total)}`));
    if (!shown) return;
    show($('status'), '');
    crisp();
    salvia.enter(shown, shown.userData.focus ?? new THREE.Sphere(new THREE.Vector3(...item.focus.center), item.focus.radius), item.plant, item.ghost);
    startSway();
  } catch (error) {
    console.error(error);
    show($('status'), `couldn't load ${label}`);
  }
}

async function showScan(date, byHand = false) {
  const item = series.find((s) => s.date === date);
  if (!item) return;
  if (byHand) { chosen = true; hillUntil = 0; }
  showing = date;
  currentItem = item;
  clearTimeout(zoomedIn); zoomedIn = null; theyyam.stop();
  for (const b of $('dates').children) b.setAttribute('aria-current', String(b.dataset.date === date));
  show($('work'), item.title || '');
  await display(item, 'the kitchen');
}

function showHill() {
  if (showing === 'hill') return;
  endFollow();
  showing = 'hill';
  for (const b of $('dates').children) b.setAttribute('aria-current', 'false');
  show($('work'), '');
  const hill = buildHill();
  stage.place(hill.group);
  stage.scene.background = hill.sky;
  // Draw about 220 pixels tall and let the browser scale them up, unsmoothed.
  const canvas = stage.renderer.domElement;
  canvas.classList.add('pixelated');
  stage.renderer.setPixelRatio(Math.min(1, 220 / Math.max(1, canvas.clientHeight)));
  stage.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.position.set(...hill.view.from);
  controls.target.set(...hill.view.to);
  controls.update();
  controls.saveState();
  salvia.walkOn(hill.ground);
  startSway();
}

// Every half minute: is it the hill's hour (or still the easter egg's few minutes)?
setInterval(() => {
  const hill = Date.now() < hillUntil || (!chosen && inHillHour());
  if (hill && showing !== 'hill') showHill();
  if (!hill && showing === 'hill') showScan(series.at(-1)?.date);
}, 30 * 1000);

async function loadSeries() {
  series = await fetch('scans/series.json', { cache: 'no-store' }).then((r) => r.json());
  series.sort((a, b) => a.date.localeCompare(b.date));
  for (const item of series) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.date = item.date;
    button.textContent = dateLabel(item.date);
    if (item.title) button.title = item.title;
    button.addEventListener('click', () => showScan(item.date, true));
    $('dates').appendChild(button);
  }
  // ?scan=2026-09-25 opens a particular date; otherwise the latest state of the drainer.
  // ?hill shows the hill (also for documentation).
  const params = new URLSearchParams(location.search);
  const wanted = params.get('scan');
  if (series.some((s) => s.date === wanted)) return showScan(wanted, true);
  if (params.has('hill') || inHillHour()) return showHill();
  showScan(series.at(-1)?.date);
}

// --- the broadcast: five weathers in turn, the same for everyone (see broadcast.js) ---

const broadcast = makeBroadcast();
const onAir = (now) => broadcast.at(now);

async function loadTracks() {
  const { data, error } = await supabase.from('tracks').select('id, artist, title, part, file, seconds, added_at, weather');
  if (error) throw error;
  broadcast.setTracks(data);
}

// --- the player ---

const audio = new Audio();
const log = startLog({ audio });
audio.preload = 'auto';
let listening = false;

function label(at) {
  const track = at?.track;
  show($('onair'), track ? `now playing: ${track.artist} – ${track.title}` : `${STATION} is quiet today`);
  const plan = broadcast.plan();
  show($('weather'), at?.ident ? `between weathers: ${track.artist}` : `the weather now: ${plan.weather}`);
  if (track && 'mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: STATION });
  }
}

function tune() {
  const at = onAir(Date.now());
  label(at);
  if (!listening) return;
  if (!at) return audio.pause();

  if (audio.dataset.file !== at.track.file) {
    audio.dataset.file = at.track.file;
    audio.src = `${AUDIO_URL}${encodeURIComponent(at.track.file)}#t=${at.offset.toFixed(2)}`;
  } else if (!audio.paused && audio.readyState >= 3 && at.offset < at.track.seconds - 2
             && Math.abs(audio.currentTime - at.offset) > 1.5) {
    audio.currentTime = at.offset; // drifted away from everyone else
  }
  if (audio.paused) {
    audio.play().catch((error) => {
      console.warn(error);
      show($('notice'), 'tap a weather again to start the sound');
    });
  }
}

// Tell the phone (lock screen, headphone buttons) whether we're playing.
for (const [event, state] of [['playing', 'playing'], ['pause', 'paused']]) {
  audio.addEventListener(event, () => { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state; });
}

audio.addEventListener('ended', () => {
  // If our copy of the song ended a moment early, wait for the broadcast to catch up.
  const at = onAir(Date.now());
  if (at && at.track.file === audio.dataset.file && at.offset > at.track.seconds - 2) {
    setTimeout(tune, (at.track.seconds - at.offset) * 1000 + 60);
  } else {
    audio.currentTime = 0;
    tune();
  }
});

setInterval(tune, 4000);
setInterval(() => loadTracks().catch(console.error), 10 * 60 * 1000); // pick up tomorrow's songs

// --- the five weathers: who's in the kitchen right now ---

const me = sessionStorage.getItem('kw-id') || crypto.randomUUID();
sessionStorage.setItem('kw-id', me);
let myWeather = null;
let mySince = 0;

const channel = supabase.channel('kuechenwetter', { config: { presence: { key: me } } });

// weather -> whoever claimed it first
function owners() {
  const result = new Map();
  for (const [key, metas] of Object.entries(channel.presenceState())) {
    for (const { weather, since } of metas) {
      if (!WEATHERS.includes(weather)) continue;
      const held = result.get(weather);
      if (!held || since < held.since || (since === held.since && key < held.key)) result.set(weather, { key, since });
    }
  }
  return result;
}

const takenByOthers = (weather, map = owners()) => map.has(weather) && map.get(weather).key !== me;

function renderWeathers() {
  const map = owners();

  if (myWeather && takenByOthers(myWeather, map)) {
    const lost = myWeather;
    stopListening();
    show($('notice'), `${lost} was taken a moment before you. choose another weather.`);
  }

  const here = WEATHERS.filter((w) => map.has(w));
  show($('listeners'), here.length
    ? `${here.length} listening: ${here.map((w) => (w === myWeather ? `${w} (you)` : w)).join(', ')}`
    : 'nobody is listening');

  // Update the buttons in place, so a tap that lands mid-update isn't lost.
  for (const button of $('weathers').children) {
    const taken = takenByOthers(button.dataset.weather, map);
    button.disabled = taken;
    button.querySelector('small').textContent = taken ? 'in the kitchen' : '';
  }
  $('outside').hidden = !!myWeather || WEATHERS.some((w) => !takenByOthers(w, map));
}

for (const weather of WEATHERS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.weather = weather;
  button.append(Object.assign(document.createElement('span'), { textContent: weather }), document.createElement('small'));
  button.addEventListener('click', () => enter(weather));
  $('weathers').appendChild(button);
}

function enter(weather) {
  if (takenByOthers(weather)) return;
  document.body.classList.remove('outside');
  myWeather = weather;
  mySince = Date.now();
  listening = true;
  tune(); // start the sound inside the tap, or phones won't allow it
  channel.track({ weather, since: mySince });
  $('threshold').hidden = true;
  $('request').hidden = false;
  $('leave').hidden = false;
  show($('notice'), '');
  renderWeathers();
}

function stopListening() {
  listening = false;
  document.body.classList.add('outside');
  myWeather = null;
  audio.pause();
  channel.untrack();
  $('threshold').hidden = false;
  $('request').hidden = true;
  $('leave').hidden = true;
}

$('leave').addEventListener('click', () => { stopListening(); renderWeathers(); });

// --- weather first: until one is chosen the kitchen waits under a veil, and pixel Salvia
// roams round the weather buttons: walks along the top and the bottom, sits beside one,
// paws at it now and then ---
document.body.classList.add('outside');
(function guide() {
  const { frames } = catFrames();
  const el = $('guide');
  const canvas = el.querySelector('canvas');
  const says = el.querySelector('.says');
  const art = Object.fromEntries(['side0', 'side1', 'side2', 'side3', 'sit', 'crouch', 'pounce', 'front0', 'front1', 'back0', 'back1']
    .map((name) => [name, frameCanvas(frames[name].rows)]));
  let shown = '';
  const draw = (name, flip) => {
    if (shown !== name) {
      const a = art[name];
      canvas.width = a.width;
      canvas.height = a.height;
      canvas.getContext('2d').drawImage(a, 0, 0);
      shown = name;
    }
    canvas.style.transform = flip ? 'scaleX(-1)' : ''; // her frames face right
  };
  draw('sit');
  // the places she can be, in the picker's own pixels (the cat's top left corner)
  function spots() {
    const list = $('weathers');
    const W = list.offsetWidth;
    const H = list.offsetHeight;
    const cw = canvas.offsetWidth || 56;
    const ch = canvas.offsetHeight || 48;
    const out = [];
    for (let k = 0; k < 4; k++) out.push({ x: Math.random() * (W - cw), y: -ch + 6, face: Math.random() < 0.5 ? 1 : -1 }); // on top
    out.push({ x: Math.random() * (W - cw), y: H - 2, face: Math.random() < 0.5 ? 1 : -1 }); // underneath
    const room = list.getBoundingClientRect();
    for (const b of list.children) { // beside a button, if there's room on that side of the screen
      const y = b.offsetTop + b.offsetHeight - ch;
      if (room.left > cw + 10) out.push({ x: -cw - 4, y, face: 1, paw: true });
      if (innerWidth - room.right > cw + 10) out.push({ x: W + 4, y, face: -1, paw: true });
    }
    return out;
  }
  // a walk round the outside of the buttons, never over them: via a corner (or two) if the
  // straight line would cross the list
  function route(from, to) {
    const list = $('weathers');
    const W = list.offsetWidth;
    const H = list.offsetHeight;
    const cw = canvas.offsetWidth || 56;
    const ch = canvas.offsetHeight || 48;
    const over = (a, b) => {
      for (let k = 1; k < 20; k++) {
        const x = a.x + ((b.x - a.x) * k) / 20;
        const y = a.y + ((b.y - a.y) * k) / 20;
        if (x > -cw + 8 && x < W - 8 && y > -ch + 12 && y < H - 8) return true;
      }
      return false;
    };
    if (!over(from, to)) return [to];
    const corners = [{ x: -cw - 4, y: -ch + 6 }, { x: W + 4, y: -ch + 6 }, { x: -cw - 4, y: H - 2 }, { x: W + 4, y: H - 2 }];
    for (const c of corners) if (!over(from, c) && !over(c, to)) return [c, to];
    for (const c of corners) for (const e of corners) if (!over(from, c) && !over(c, e) && !over(e, to)) return [c, e, to];
    return [to];
  }
  let at = { x: 10, y: -42 };
  let goal = null;
  let path = [];
  let restUntil = performance.now() + 1500;
  let action = null;
  let walked = 0;
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    if (!document.body.classList.contains('outside')) return;
    if (!goal && !path.length && now > restUntil) {
      const choices = spots();
      path = route(at, choices[Math.floor(Math.random() * choices.length)]);
    }
    if (!goal && path.length) goal = path.shift();
    if (goal) {
      const dx = goal.x - at.x;
      const dy = goal.y - at.y;
      const dist = Math.hypot(dx, dy);
      const step = 80 * dt; // px a second
      if (dist <= step && path.length) { // a corner on the way: keep walking
        at = { x: goal.x, y: goal.y };
        goal = null;
      } else if (dist <= step) {
        at = { x: goal.x, y: goal.y };
        // arrived: a sit, or (beside a button) a crouch and a paw at it
        action = goal.paw || Math.random() < 0.25 ? { kind: 'paw', from: now, face: goal.face } : { kind: 'sit', from: now, face: goal.face };
        restUntil = now + (action.kind === 'paw' ? 1600 : 1800 + Math.random() * 2500);
        if (action.kind === 'paw' && Math.random() < 0.6) { says.textContent = speak('choose your weather'); says.classList.add('on'); }
        goal = null;
      } else {
        at.x += (dx / dist) * step;
        at.y += (dy / dist) * step;
        walked += step;
        const n = Math.floor(walked / 7) % 4;
        if (Math.abs(dx) >= Math.abs(dy)) draw(`side${n}`, dx < 0);
        else draw(dy > 0 ? `front${n % 2}` : `back${n % 2}`);
        says.classList.remove('on');
      }
    } else if (action) {
      const t = now - action.from;
      if (action.kind === 'paw') draw(t < 400 ? 'crouch' : t < 1000 ? 'pounce' : 'sit', action.face < 0);
      else draw('sit');
      if (t > 2400) says.classList.remove('on');
    }
    el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
  }, 50);
}());

// --- on a phone: now playing, the wheel and the toys stay; the rest goes in the menu ---
const phone = matchMedia('(max-width: 600px)');
const homes = ['weather', 'listeners', 'request', 'links', 'work', 'dates', 'viewbar'].map((id) => {
  const el = id === 'links' ? document.querySelector('footer .links') : $(id);
  return { el, parent: el.parentElement, next: el.nextElementSibling };
});
function arrange() {
  const body = $('menu').querySelector('.menu-body');
  if (phone.matches) for (const { el } of homes) body.append(el);
  else for (const { el, parent, next } of homes) parent.insertBefore(el, next && next.parentElement === parent ? next : null);
  $('menu-open').hidden = !phone.matches;
  if (!phone.matches && $('menu').open) $('menu').close();
}
arrange();
phone.addEventListener('change', arrange);
$('menu-open').addEventListener('click', () => $('menu').showModal());
// going somewhere from the menu closes it (sending a request doesn't, so you see it went)
$('menu').addEventListener('click', (e) => {
  if (e.target === $('menu') || e.target.closest('a, #dates button, #viewbar button, #about-open, #leave')) $('menu').close();
});
window.addEventListener('pagehide', () => channel.untrack());

// The duty wheel listens on the same channel, so it joins before we subscribe.
const wheel = mountWheel({ supabase, channel, corner: $('wheel-open'), dialog: $('wheel') });
// The aquarium (aquarium.js) floods every open radio together, on the same channel.
const aquarium = mountAquarium({ button: $('bowl'), channel, salvia });

channel
  .on('presence', { event: 'sync' }, renderWeathers)
  // The keeper changed the song list: everyone reloads at once and stays in sync.
  .on('broadcast', { event: 'tracks' }, () => loadTracks().then(tune).catch(console.error))
  .subscribe((status) => {
    // After a dropped connection (a locked phone), claim the weather again.
    // A fresh timestamp means anyone who took it in the meantime keeps it.
    if (status === 'SUBSCRIBED' && myWeather) {
      mySince = Date.now();
      channel.track({ weather: myWeather, since: mySince });
    }
  });

// --- the request box ---

$('request').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('song');
  const song = input.value.trim();
  if (!song) return;
  const button = event.target.querySelector('button');
  button.disabled = true;
  const weather = $('request-weather').value || null;
  const { error } = await supabase.from('requests').insert({ song, weather });
  button.disabled = false;
  if (error) {
    console.error(error);
    show($('sent'), "that didn't go through. try again?");
    return;
  }
  input.value = '';
  show($('sent'), 'sent. if it airs, it airs tomorrow.');
  setTimeout(() => show($('sent'), ''), 6000);
});

// --- about ---

$('about-open').addEventListener('click', () => $('about').showModal());

// --- start ---

// ?clean hides the interface, for photographing the scans.
if (new URLSearchParams(location.search).has('clean')) document.body.classList.add('clean');

if (new URLSearchParams(location.search).has('debug')) {
  window.kw = { audio, stage, broadcast, onAir: () => onAir(Date.now()), owners, wheel, salvia, showHill, hillHour, inHillHour, aquarium, theyyam, callTheyyam };
}

renderWeathers();
floatTheGallery($('gallery-link'), $('floaters')).catch(console.error);
loadSeries().catch((error) => { console.error(error); show($('status'), "couldn't load the scans"); });
loadTracks().then(tune).catch((error) => { console.error(error); show($('onair'), `${STATION} is off air`); });

// --- the gallery opens over the radio, so the music keeps playing ---
// It's gallery.html in a frame; its "back to the radio" closes the frame again. While
// it's open the radio stops drawing its own scene (the sound goes on).
function openGallery() {
  if ($('gallery-frame')) return;
  const frame = Object.assign(document.createElement('iframe'), { id: 'gallery-frame', src: 'gallery.html?over', title: 'gallery of 3D scans' });
  document.body.append(frame);
  frame.addEventListener('load', () => frame.classList.add('open'));
  stage.paused = true;
}
function closeGallery() {
  const frame = $('gallery-frame');
  if (!frame) return;
  stage.paused = false;
  frame.classList.remove('open');
  frame.addEventListener('transitionend', () => frame.remove(), { once: true });
  setTimeout(() => frame.remove(), 700);
  $('gallery-link').focus();
}
$('gallery-link').addEventListener('click', (event) => { event.preventDefault(); openGallery(); });
addEventListener('message', (event) => { if (event.origin === location.origin && event.data === 'close-gallery') closeGallery(); });
addEventListener('keydown', (event) => { if (event.key === 'Escape') closeGallery(); });
