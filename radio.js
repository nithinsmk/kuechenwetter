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
import { mountBoombox } from './boombox.js';
import { carveStone } from './stone.js';
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

// A slow sway across the photographed side, always round the cutlery holder. A full turn
// would show the back of the drainer, which the phone never saw and which is mostly fog. In
// a scan the height rises and dips too, and over the first few minutes it comes closer,
// then breathes in and out a little.
const SWAY_ANGLE = THREE.MathUtils.degToRad(28);
const SWAY_PERIOD = 40; // seconds per full sway
const RISE = THREE.MathUtils.degToRad(11); // how far the height swings, as an angle
const RISE_PERIOD = 30;
let sway = null; // { theta, phi, radius, t0, roam } while swaying
let resumeSway;

function startSway() {
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  sway = { theta: spherical.theta, phi: spherical.phi, radius: spherical.radius, t0: performance.now(), roam: showing !== 'hill' };
}

function swayFrame(time) {
  if (!sway) return;
  const t = (time - sway.t0) / 1000;
  const spherical = new THREE.Spherical(sway.radius, sway.phi, sway.theta + SWAY_ANGLE * Math.sin(t * (2 * Math.PI / SWAY_PERIOD)));
  if (sway.roam) {
    // phi is measured from straight above, so up and down is a swing either way of where it began
    spherical.phi = THREE.MathUtils.clamp(sway.phi + RISE * Math.sin(t * (2 * Math.PI / RISE_PERIOD)), 0.35, 1.45);
    const closer = 0.62 + 0.38 * Math.exp(-t / 40); // in to about 60% of the start, mostly within a couple of minutes
    spherical.radius = sway.radius * closer * (1 + 0.05 * Math.sin(t * (2 * Math.PI / 71)));
  }
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  camera.lookAt(controls.target);
}

// Where the camera rests: a little above and in front of the cutlery holder (the scan's
// focus), and the high view it first comes down from.
function homeView(height = 'close') {
  const target = controls.target0.clone();
  const reach = controls.position0.distanceTo(target);
  const dir = height === 'high' ? new THREE.Vector3(0.3, 1.6, 0.55) : new THREE.Vector3(0.55, 0.9, 1);
  // close: the holder about a seventh of the screen's height (where the roam starts, then it
  // drifts in); high: well above that, where the first visit comes down from
  return { from: target.clone().add(dir.normalize().multiplyScalar(reach * (height === 'high' ? 2.3 : 1.27))).toArray(), to: target.toArray() };
}

// Salvia, the house cat, lives in whichever scan is showing (see salvia.js).
const salvia = makeSalvia({
  scene: stage.scene, camera, canvas: stage.renderer.domElement,
  // Pet her ten times in a row and the kitchen gives way to the hill for a few minutes.
  onTenPets: () => { hillUntil = Date.now() + 4 * 60 * 1000; showHill(); },
  onPurring: (on) => (on ? startPurr() : stopPurr()),
  // When she naps in the spoon corner, he sometimes comes and lies down beside her.
  onTap: (what) => {
    log.tap(what);
    if (what?.startsWith('plant:')) startFollow('behind'); // she runs to eat it: the camera goes with her
  },
  onGhostNap: () => { if (Math.random() < 0.5) callTheyyam('sleep'); },
  onHiss: hiss,
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopPurr(); });

// The hamsa: each tap swivels round to the figure's side of the counter and plays
// the next of its scenes (for trying them out).
const FIGURE_VIEW = { from: [-0.6, 0.36, 0.4], to: [-1.03, 0.07, -0.12] }; // the spoon corner by the dish rack
let zoomedIn = null; // set while the talisman has the camera up close
function zoomOut() {
  clearTimeout(zoomedIn);
  zoomedIn = null;
  flyTo(homeView(), startSway); // back to the holder
}
let flight = null;
function flyTo(view, after = () => { resumeSway = setTimeout(startSway, 12000); }, ms = 1800) {
  sway = null;
  clearTimeout(resumeSway);
  flight = { from: camera.position.clone(), to: new THREE.Vector3(...view.from), fromT: controls.target.clone(), toT: new THREE.Vector3(...view.to), t0: performance.now(), after, ms };
}
const flyFrame = (time) => {
  if (!flight) return;
  const k = Math.min(1, (time - flight.t0) / flight.ms);
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
  flyTo(homeView(), startSway);
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
$('view-reset').addEventListener('click', () => (follow ? endFollow() : flyTo(homeView(), startSway)));
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

let arrived = false; // has the opening descent happened yet
let parked = false; // a scan is in, with the camera waiting high above it
function descend() {
  if (arrived || !parked) return;
  arrived = true;
  flyTo(homeView(), startSway, 5200);
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
    // The first time it waits high above, and comes down to the holder once you're in (or
    // now, if you already are); another date goes straight to it. Then the slow roam round it.
    if (!arrived) {
      const high = homeView('high');
      camera.position.set(...high.from);
      controls.target.set(...high.to);
      sway = null;
      parked = true;
      if (listening) descend();
    } else flyTo(homeView(), startSway);
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
  if (outside()) return labelStation(); // a live station: nothing to schedule, seek or correct
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
  if (outside()) return stalled(); // a live stream shouldn't end
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

// --- the dial: KMX169 (the kitchen's own schedule, everyone in sync) or an outside live
// station, playing right here. Tap the boombox to turn it one click. ---
const STATIONS = [
  { id: 'kmx169', name: 'KMX169', key: 'K' },
  { id: 'alhara', name: 'Radio AlHara', key: 'A', url: 'https://stream.radioalhara.net/ra', site: 'https://www.radioalhara.net/', siteName: 'radioalhara.net' },
  { id: 'nts1', name: 'NTS 1', key: '1', nts: '1', url: 'https://stream-relay-geo.ntslive.net/stream?client=direct', site: 'https://www.nts.live/', siteName: 'nts.live' },
  { id: 'nts2', name: 'NTS 2', key: '2', nts: '2', url: 'https://stream-relay-geo.ntslive.net/stream2?client=direct', site: 'https://www.nts.live/', siteName: 'nts.live' },
];
let dial = 0;
const outside = () => (dial > 0 ? STATIONS[dial] : null);
const boombox = mountBoombox($('radio'), STATIONS.map((s) => s.key));
let ntsShows = {}; // NTS channel -> the show on now, from their live API
let retried = false;

function drawDial() {
  boombox.set(dial, listening && !audio.paused);
  const next = STATIONS[(dial + 1) % STATIONS.length];
  $('radio').dataset.log = `station: ${next.id}`; // the listening log counts which station a tap turns to
  $('radio').setAttribute('aria-label', `the radio: on ${STATIONS[dial].name}; tap for ${next.name}`);
}
for (const event of ['playing', 'pause']) audio.addEventListener(event, drawDial);

// Under now playing: which station, with a link to an outside one's own site.
function creditLine() {
  const s = outside();
  const credit = $('credit');
  if (s) { credit.href = s.site; credit.textContent = `${s.name}, live from ${s.siteName}`; }
  else { credit.removeAttribute('href'); credit.textContent = "on KMX169, the kitchen's own station"; }
  credit.hidden = !listening;
}

function labelStation() {
  const s = outside();
  const showName = s.nts ? ntsShows[s.nts] : null;
  show($('onair'), `now playing: ${s.name}${showName ? ` – ${showName}` : ''}`);
  creditLine();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: showName || s.name, artist: s.name, album: STATION });
  }
}

async function readNts() {
  try {
    const data = await fetch('https://www.nts.live/api/v2/live', { cache: 'no-store' }).then((r) => r.json());
    ntsShows = Object.fromEntries(data.results.map((r) => [r.channel_name, r.now?.broadcast_title]));
  } catch { ntsShows = {}; } // no show names then, just the channel
  if (outside()?.nts) labelStation();
}
setInterval(() => { if (listening && outside()?.nts) readNts(); }, 60 * 1000);

function playStation() {
  const s = outside();
  audio.dataset.file = ''; // so the kitchen reloads its song at the shared spot when we come back
  audio.src = s.url;
  audio.play().catch(() => show($('notice'), `tap the radio again to start ${s.name}`));
}

// A station that fails or stalls: wait a moment, try once more, then say so.
let stallTimer = null;
function stalled() {
  const s = outside();
  if (!s || !listening || stallTimer) return;
  const from = audio.currentTime;
  stallTimer = setTimeout(() => {
    stallTimer = null;
    if (outside() !== s || (!audio.paused && audio.currentTime > from + 1)) return; // it's moving: fine
    if (!retried) { retried = true; playStation(); return; }
    show($('notice'), `${s.name} isn't coming through right now. Turn the dial for another.`);
  }, 4000);
}
audio.addEventListener('error', stalled);
audio.addEventListener('stalled', stalled);
audio.addEventListener('waiting', stalled);
audio.addEventListener('playing', () => { retried = false; clearTimeout(stallTimer); stallTimer = null; show($('notice'), ''); });

$('radio').addEventListener('click', () => {
  if (!listening) return;
  dial = (dial + 1) % STATIONS.length;
  retried = false;
  clearTimeout(stallTimer);
  stallTimer = null;
  show($('notice'), '');
  if (outside()) {
    playStation(); // inside the tap, or phones won't start it
    labelStation();
    if (outside().nts) readNts();
  } else {
    creditLine();
    audio.dataset.file = '';
    tune(); // back to the kitchen, in step with everyone
  }
  drawDial();
});
drawDial();
setInterval(() => loadTracks().catch(console.error), 10 * 60 * 1000); // pick up tomorrow's songs

// --- the five weathers: who's in the kitchen right now ---

const me = sessionStorage.getItem('kw-id') || crypto.randomUUID();
sessionStorage.setItem('kw-id', me);
let myWeather = null;
// ?quiet on this Mac: enter without showing up in the live kitchen (for testing)
const QUIET = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('quiet');
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
  button.addEventListener('click', () => pickWeather(weather));
  $('weathers').appendChild(button);
}

// Step two: which station, on the big radio. KMX169 is the kitchen's own; the others are
// live from elsewhere.
const bigRadio = mountBoombox($('stations').querySelector('.big-radio'), STATIONS.map((s) => s.key));
bigRadio.set(0, false);
bigRadio.keys.forEach((key, index) => {
  key.addEventListener('click', () => enter(chosenWeather, index));
  key.addEventListener('pointerenter', () => bigRadio.set(index, false));
});
STATIONS.forEach((station, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.station = station.id;
  button.dataset.log = `station: ${station.id}`;
  for (const event of ['pointerenter', 'focus']) button.addEventListener(event, () => bigRadio.set(index, false)); // the needle goes to it
  button.textContent = station.name;
  button.addEventListener('click', () => enter(chosenWeather, index));
  $('stations').appendChild(button);
});
let chosenWeather = null;
function step(two) {
  for (const id of ['choose', 'weathers', 'scroll']) $(id).hidden = two;
  $('weathers').parentElement.hidden = two;
  $('station-step').hidden = !two;
  // pixel Salvia moves over to whichever list is showing
  (two ? $('stations') : $('weathers')).parentElement.prepend($('guide'));
}
function pickWeather(weather) {
  if (takenByOthers(weather)) return;
  chosenWeather = weather;
  show($('notice'), '');
  step(true);
}
$('back-weathers').addEventListener('click', () => step(false));

// The big radio flies up to its place by now playing.
function flyRadio() {
  const big = $('stations').querySelector('.big-radio svg');
  const from = big.getBoundingClientRect();
  if (!from.width) return;
  const target = phone.matches ? $('radio').querySelector('.emoji') : $('radio').querySelector('.boom-art svg');
  const clone = big.cloneNode(true);
  clone.classList.add('flying-radio');
  Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(clone);
  $('dial').style.visibility = 'hidden';
  setTimeout(() => { // once the page has laid out the radio's new place
    const to = target.getBoundingClientRect();
    const k = to.width / from.width;
    const flight = clone.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${k})`, opacity: phone.matches ? 0 : 1 }],
      { duration: 900, easing: 'cubic-bezier(.5,0,.2,1)' });
    const land = () => { clone.remove(); $('dial').style.visibility = ''; };
    flight.finished.then(land, land);
    setTimeout(land, 1500); // whatever happens, it lands
  });
}

function enter(weather, station = 0) {
  const fromStep = !$('station-step').hidden;
  if (!weather || takenByOthers(weather)) {
    step(false);
    if (weather) show($('notice'), `${weather} was taken a moment before you. choose another weather.`);
    return;
  }
  dial = station;
  document.body.classList.remove('outside');
  myWeather = weather;
  mySince = Date.now();
  listening = true;
  // start the sound inside the tap, or phones won't allow it
  if (outside()) { playStation(); labelStation(); if (outside().nts) readNts(); } else { audio.dataset.file = ''; tune(); }
  if (!QUIET) channel.track({ weather, since: mySince });
  $('dial').hidden = false;
  if (fromStep) flyRadio();
  descend(); // the camera comes down from above, the first time
  $('threshold').hidden = true;
  step(false);
  $('request').hidden = false;
  $('leave').hidden = false;
  show($('notice'), '');
  renderWeathers();
  creditLine();
  drawDial();
}

function stopListening() {
  listening = false;
  document.body.classList.add('outside');
  myWeather = null;
  audio.pause();
  dial = 0;
  $('credit').hidden = true;
  drawDial();
  channel.untrack();
  $('threshold').hidden = false;
  $('dial').hidden = true;
  step(false);
  $('request').hidden = true;
  $('leave').hidden = true;
}

$('leave').addEventListener('click', () => { stopListening(); renderWeathers(); });

// --- weather first: until one is chosen the kitchen waits under a veil, and pixel Salvia
// roams round the weather buttons: walks along the top and the bottom, sits beside one,
// paws at it now and then ---
document.body.classList.add('outside');
// …and nothing but the weather and station steps answers a tap until you're in, even if the
// styles that fade the rest haven't loaded
for (const event of ['click', 'pointerdown', 'pointerup']) {
  addEventListener(event, (e) => {
    if (document.body.classList.contains('outside') && !e.target.closest?.('#threshold')) { e.preventDefault(); e.stopPropagation(); }
  }, { capture: true });
}
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
  const current = () => ($('station-step').hidden ? $('weathers') : $('stations'));
  function spots() {
    const list = current();
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
    const list = current();
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
        if (action.kind === 'paw' && Math.random() < 0.6) { says.textContent = speak($('station-step').hidden ? 'choose your weather' : 'choose your station'); says.classList.add('on'); }
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

// --- the stone on the way in: what this is, in English, Arabic, Malayalam, Spanish and
// Urdu in turn, a new one every 7 seconds; a tap on the stone turns to the next straight
// away, and the names underneath go to that one ---
const SCROLL = [
  ['en', 'ltr', [
    "Our flat's radio: tune in when you like, while you work or clean, and send songs I add each day.",
    'Radio AlHara (Bethlehem) and NTS 1 and 2 are on the dial too. Best on a computer.',
    'The wheel keeps our cleaning rota: when your task is done, move your clip. It turns every two weeks and shows the time left.']],
  ['ar', 'rtl', [
    'راديو شقّتنا: استمع متى شئت، وأنت تعمل أو تنظّف، وأرسل أغاني أضيفها كل يوم.',
    'راديو الحارة (بيت لحم) و NTS 1 و 2 على المؤشّر أيضًا. أجمل على الكمبيوتر.',
    'العجلة تحفظ جدول التنظيف: حين تنهي مهمّتك، حرّك مشبكك. تدور كل أسبوعين وتُظهر الوقت المتبقّي.']],
  ['ml', 'ltr', [
    'നമ്മുടെ ഫ്ലാറ്റിന്റെ റേഡിയോ: ജോലി ചെയ്യുമ്പോഴോ വൃത്തിയാക്കുമ്പോഴോ, ഇഷ്ടമുള്ളപ്പോൾ കേൾക്കൂ; പാട്ടുകൾ അയയ്ക്കൂ, ഞാൻ ദിവസവും ചേർക്കും.',
    'റേഡിയോ അൽഹാര (ബെത്‌ലഹേം), NTS 1, 2 എന്നിവയും ഡയലിലുണ്ട്. കമ്പ്യൂട്ടറിലാണ് കൂടുതൽ നല്ലത്.',
    'ചക്രം നമ്മുടെ വൃത്തിയാക്കൽ മുറ ഓർത്തുവയ്ക്കുന്നു: നിങ്ങളുടെ ജോലി കഴിഞ്ഞാൽ ക്ലിപ്പ് നീക്കൂ. രണ്ടാഴ്ച കൂടുമ്പോൾ അത് തിരിയും, ബാക്കിയുള്ള സമയം കാണിക്കും.']],
  ['es', 'ltr', [
    'La radio de nuestro piso: escúchala cuando quieras, mientras trabajas o limpias, y mándame canciones que añado cada día.',
    'Radio AlHara (Belén) y NTS 1 y 2 también están en el dial. Mejor en un ordenador.',
    'La rueda lleva nuestro turno de limpieza: cuando termines tu tarea, mueve tu pinza. Gira cada dos semanas y muestra el tiempo que queda.']],
  ['ur', 'rtl', [
    'ہمارے فلیٹ کا ریڈیو: جب چاہیں سنیں، کام کرتے یا صفائی کرتے ہوئے، اور گانے بھیجیں جو میں ہر روز شامل کرتی ہوں۔',
    'ریڈیو الحارہ (بیت لحم) اور NTS 1 اور 2 بھی ڈائل پر ہیں۔ کمپیوٹر پر زیادہ اچھا لگتا ہے۔',
    'پہیہ ہماری صفائی کی باری کا حساب رکھتا ہے: جب آپ کا کام ہو جائے، اپنی کلپ سرکائیں۔ یہ ہر دو ہفتے بعد گھومتا ہے اور باقی وقت دکھاتا ہے۔']],
];
const LANG_NAMES = { en: 'English', ar: 'العربية', ml: 'മലയാളം', es: 'Español', ur: 'اردو' };
(function theStone() {
  const stone = $('scroll').querySelector('.stone');
  const paper = stone.querySelector('.paper');
  const names = $('scroll').querySelector('.langs');
  // the letters as big as will fit inside the carved oval, for whichever language is on; on
  // a phone they never go below a readable size, and the words scroll through the face instead
  const narrow = matchMedia('(max-width: 600px)');
  function fit() {
    const least = narrow.matches ? 11.5 : 8;
    let size = 15;
    paper.style.fontSize = `${size}px`;
    while (paper.scrollHeight > paper.clientHeight + 1 && size > least) {
      size -= 0.5;
      paper.style.fontSize = `${size}px`;
    }
    paper.scrollTop = 0;
    paper.classList.toggle('scrolls', paper.scrollHeight > paper.clientHeight + 1);
    stone.classList.toggle('scrolls', paper.classList.contains('scrolls'));
    shownAt = performance.now();
  }
  // the slow drift upward, like credits; a finger on it takes over for a while
  let shownAt = performance.now();
  let handsOn = 0;
  let endAt = 0;
  for (const event of ['touchstart', 'wheel', 'pointerdown']) paper.addEventListener(event, () => { handsOn = performance.now(); }, { passive: true });
  setInterval(() => {
    if (!paper.classList.contains('scrolls') || $('scroll').hidden) return;
    const now = performance.now();
    if (now - shownAt < 1500 || now - handsOn < 4000) return;
    const before = paper.scrollTop;
    paper.scrollTop += 0.7;
    if (paper.scrollTop === before && !endAt) endAt = now; // reached the end
  }, 50);
  for (const [cls, way] of [['up', -1], ['down', 1]]) {
    stone.querySelector(`.nudge.${cls}`).addEventListener('click', (e) => {
      e.stopPropagation(); // not a tap on the stone (that changes the language)
      handsOn = performance.now();
      paper.scrollTop += way * paper.clientHeight * 0.6;
    });
  }
  // read through yet? (a stone that scrolls turns once it's been to the end and rested)
  const readThrough = () => !paper.classList.contains('scrolls') || (endAt && performance.now() - endAt > 2000);
  addEventListener('resize', fit);
  const canvas = stone.querySelector('.carving');
  const carve = () => carveStone(canvas, matchMedia('(max-width: 600px)').matches);
  carve();
  matchMedia('(max-width: 600px)').addEventListener('change', carve);
  requestAnimationFrame(fit);
  document.fonts?.ready.then(fit);
  let n = 0;
  function turnTo(next) {
    n = (next + SCROLL.length) % SCROLL.length;
    const [lang, dir, lines] = SCROLL[n];
    paper.classList.add('turning');
    setTimeout(() => {
      paper.lang = lang;
      paper.dir = dir;
      paper.querySelectorAll('p').forEach((p, k) => { p.textContent = lines[k]; });
      fit();
      paper.classList.remove('turning');
    }, 300);
    for (const b of names.children) b.setAttribute('aria-current', String(b.dataset.lang === lang));
    endAt = 0;
  }
  // every 7 seconds (or, if it scrolls, once it's been read through) the next language
  setInterval(() => {
    if ($('scroll').hidden || !document.body.classList.contains('outside')) return;
    if (performance.now() - shownAt >= 7000 && readThrough()) turnTo(n + 1);
  }, 500);
  SCROLL.forEach(([lang], k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.lang = lang;
    b.lang = lang;
    b.textContent = LANG_NAMES[lang];
    b.addEventListener('click', () => turnTo(k));
    names.append(b);
  });
  stone.addEventListener('click', () => turnTo(n + 1));
  stone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turnTo(n + 1); } });
  for (const b of names.children) b.setAttribute('aria-current', String(b.dataset.lang === 'en'));
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
