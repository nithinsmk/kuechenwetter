// The listening log (supabase/04-listen-log.sql), read on the keeper desk. Each browser
// gets a random device id it keeps; this radio adds a 'visit' when it opens, the seconds of
// music it played each minute ('listen'), and what was tapped ('tap'). Nothing personal.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const ENDPOINT = `${SUPABASE_URL}/rest/v1/listen_log`;

function deviceId() {
  try {
    let id = localStorage.getItem('kw-device');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('kw-device', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

export function startLog({ audio }) {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const device = deviceId();
  let listened = 0;
  const taps = new Map();

  const send = (rows) => {
    if (!rows.length || local) return; // testing here doesn't count
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true, // so the last rows still go when the page closes
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    }).catch(() => {});
  };
  const flush = () => {
    const rows = [];
    // a row every minute while the radio is open, even silent, so the desk can count who's online
    rows.push({ device, kind: 'listen', what: null, amount: Math.round(listened) });
    for (const [what, n] of taps) rows.push({ device, kind: 'tap', what, amount: n });
    listened = 0;
    taps.clear();
    send(rows);
  };

  send([{ device, kind: 'visit', what: matchMedia('(pointer: coarse)').matches ? 'phone' : 'computer' }]);

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    if (!audio.paused && !audio.muted) listened += Math.min(30, (now - last) / 1000);
    last = now;
  }, 5000);
  setInterval(flush, 60 * 1000);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  const tap = (what) => { if (what) taps.set(what.slice(0, 60), (taps.get(what) ?? 0) + 1); };
  // Buttons and links name themselves: data-log, then id, then their label.
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('button, a, summary, [data-log]');
    if (!el) return;
    const name = el.dataset.log || (el.dataset.weather && `weather: ${el.dataset.weather}`) || el.id
      || el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
    tap(name);
  }, { capture: true });

  return { tap };
}
