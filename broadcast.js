// The broadcast, shared by the radio and the keeper desk. Everything here is computed
// from the clock and the song list, so every listener lands on the same song.
//
// The Berlin day belongs to five weathers in turn, each with its own playlist. At every
// change of weather one song by نظيفة (a song with no weather) plays first, like an ident.
// Songs air from the first midnight after they were added.

export const WEATHERS = ['rain_after_midnight', 'fog_before_dawn', 'clearing_by_noon', 'showers_late_afternoon', 'humid_at_dusk'];
export const ARTIST = 'نظيفة';
const HOUR = 3600 * 1000;
const SLOT = (24 * HOUR) / WEATHERS.length;

const berlin = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export function berlinClock(ms) {
  const p = Object.fromEntries(berlin.formatToParts(ms).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, seconds: (+p.hour * 60 + +p.minute) * 60 + +p.second };
}

// The moment (ms) of the latest midnight in Berlin, also on clock-change days.
export function berlinMidnight(now) {
  let start = now - berlinClock(now).seconds * 1000 - (now % 1000);
  const off = berlinClock(start).seconds;
  if (off) start -= (off > 43200 ? off - 86400 : off) * 1000;
  return start;
}

function seededRandom(text) {
  let a = 2166136261;
  for (const ch of text) a = Math.imul(a ^ ch.codePointAt(0), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A show is one artist and title; for a mixtape the title is "Mixtape · Artist – Song",
// and the part before " · " names the show. Parts of a show play together, in order.
const showKey = (t) => `${t.artist}\n${t.title.split(' · ')[0]}`;

function shuffledShows(tracks, seed) {
  const shows = new Map();
  for (const t of tracks) {
    if (!shows.has(showKey(t))) shows.set(showKey(t), []);
    shows.get(showKey(t)).push(t);
  }
  const list = [...shows.values()].map((parts) => parts.sort((a, b) => a.part - b.part));
  list.sort((a, b) => Date.parse(a[0].added_at) - Date.parse(b[0].added_at) || (a[0].id < b[0].id ? -1 : 1));
  const random = seededRandom(seed);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.flat();
}

// Which weather holds the air at `now`: its index, name, start and end (ms).
export function slotAt(now) {
  const midnight = berlinMidnight(now);
  const nextMidnight = berlinMidnight(midnight + 25 * HOUR);
  const index = Math.min(WEATHERS.length - 1, Math.floor((now - midnight) / SLOT));
  return {
    day: berlinClock(now).day,
    index,
    weather: WEATHERS[index],
    start: midnight + index * SLOT,
    end: index === WEATHERS.length - 1 ? nextMidnight : midnight + (index + 1) * SLOT,
  };
}

// The plan for the weather on air at `now`: an ident by نظيفة, then the weather's playlist
// looped. A weather with no songs yet borrows from every song, so the radio never goes quiet.
export function planSlot(tracks, now) {
  const slot = slotAt(now);
  const eligible = tracks.filter((t) => Date.parse(t.added_at) < berlinMidnight(now));
  const untagged = eligible.filter((t) => !t.weather);
  const own = eligible.filter((t) => t.weather === slot.weather);
  const pool = own.length ? own : eligible;

  let ident = null;
  if (untagged.length) {
    const sorted = [...untagged].sort((a, b) => (a.id < b.id ? -1 : 1));
    ident = sorted[Math.floor(seededRandom(`${slot.day}|${slot.weather}|ident`)() * sorted.length)];
  }
  const sequence = shuffledShows(pool, `${slot.day}|${slot.weather}`);
  return { ...slot, ident, sequence, borrowed: !own.length, total: sequence.reduce((s, t) => s + Number(t.seconds), 0) };
}

// What is playing at `now` within a plan: { track, offset, ident, index }.
export function playingIn(plan, now) {
  let t = (now - plan.start) / 1000;
  if (plan.ident) {
    if (t < plan.ident.seconds) return { track: plan.ident, offset: t, ident: true, index: -1 };
    t -= plan.ident.seconds;
  }
  if (!plan.total) return null;
  t %= plan.total;
  for (const [index, track] of plan.sequence.entries()) {
    if (t < track.seconds) return { track, offset: t, ident: false, index };
    t -= track.seconds;
  }
  return { track: plan.sequence[0], offset: 0, ident: false, index: 0 };
}

// A cached plan that renews itself when the weather changes.
export function makeBroadcast() {
  let tracks = [];
  let plan = null;
  return {
    setTracks(list) { tracks = list.map((t) => ({ ...t, seconds: Number(t.seconds) })); plan = null; },
    get tracks() { return tracks; },
    plan(now = Date.now()) {
      if (!plan || now < plan.start || now >= plan.end) plan = planSlot(tracks, now);
      return plan;
    },
    at(now = Date.now()) { return playingIn(this.plan(now), now); },
  };
}
