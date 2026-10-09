import * as THREE from 'three';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, AUDIO_URL } from './config.js';
import { SCAN_DIR, createStage, progressText } from './scan.js';
import { makeBroadcast } from './broadcast.js';
import { mountWheel } from './wheel.js';
import { floatTheGallery } from './floaters.js';
import { makeSalvia } from './salvia.js';

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
const salvia = makeSalvia({ scene: stage.scene, camera, canvas: stage.renderer.domElement });

stage.onFrame = (time) => {
  swayFrame(time);
  salvia.update(time);
};

controls.addEventListener('start', () => { sway = null; clearTimeout(resumeSway); });
controls.addEventListener('end', () => { resumeSway = setTimeout(startSway, 8000); });

let series = [];
const dateLabel = (date) => date.slice(8, 10) + '.' + date.slice(5, 7);

async function showScan(date) {
  const item = series.find((s) => s.date === date);
  if (!item) return;
  for (const b of $('dates').children) b.setAttribute('aria-current', String(b.dataset.date === date));
  show($('work'), item.title || '');
  show($('status'), 'loading the kitchen');
  try {
    const shown = await stage.show({ url: SCAN_DIR + item.file, name: item.file, focus: item.focus },
      (loaded, total) => show($('status'), `loading the kitchen · ${progressText(loaded, total)}`));
    if (shown) {
      show($('status'), '');
      startSway();
      salvia.enter(shown, shown.userData.focus ?? new THREE.Sphere(new THREE.Vector3(...item.focus.center), item.focus.radius), item.plant);
    }
  } catch (error) {
    console.error(error);
    show($('status'), "couldn't load the kitchen");
  }
}

async function loadSeries() {
  series = await fetch('scans/series.json', { cache: 'no-store' }).then((r) => r.json());
  series.sort((a, b) => a.date.localeCompare(b.date));
  for (const item of series) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.date = item.date;
    button.textContent = dateLabel(item.date);
    if (item.title) button.title = item.title;
    button.addEventListener('click', () => showScan(item.date));
    $('dates').appendChild(button);
  }
  // ?scan=2026-09-25 opens a particular date; otherwise the latest state of the drainer.
  const wanted = new URLSearchParams(location.search).get('scan');
  showScan(series.some((s) => s.date === wanted) ? wanted : series.at(-1)?.date);
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
  myWeather = null;
  audio.pause();
  channel.untrack();
  $('threshold').hidden = false;
  $('request').hidden = true;
  $('leave').hidden = true;
}

$('leave').addEventListener('click', () => { stopListening(); renderWeathers(); });
window.addEventListener('pagehide', () => channel.untrack());

// The duty wheel listens on the same channel, so it joins before we subscribe.
const wheel = mountWheel({ supabase, channel, corner: $('wheel-open'), dialog: $('wheel') });

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
  window.kw = { audio, stage, broadcast, onAir: () => onAir(Date.now()), owners, wheel, salvia };
}

renderWeathers();
floatTheGallery($('gallery-link'), $('floaters')).catch(console.error);
loadSeries().catch((error) => { console.error(error); show($('status'), "couldn't load the scans"); });
loadTracks().then(tune).catch((error) => { console.error(error); show($('onair'), `${STATION} is off air`); });
