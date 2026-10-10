// The radio toy: a little pixel boombox with an old car radio for a face (after a 1970s
// Philips: black panel, chrome trim, a cream tuning scale with a red needle, push buttons).
// Four buttons, one per station: K (KMX169, the kitchen), 1 and 2 (NTS), A (AlHara). Each
// tap turns the dial one click; the needle slides over and that button stays pressed. While
// it plays, the speakers pump and the whole box bounces.

const PX = 2;
const W = 46;
const H = 24;
const KEYS = [14, 18, 22, 26]; // left edge of each button, in grid cells
const GLYPHS = {
  K: ['X.X', 'XX.', 'X.X'],
  1: ['XX.', '.X.', 'XXX'],
  2: ['XX.', '.X.', '.XX'],
  A: ['.X.', 'XXX', 'X.X'],
};

const rect = (x, y, w, h, fill) => `<rect x="${x * PX}" y="${y * PX}" width="${w * PX}" height="${h * PX}" fill="${fill}"/>`;

function speaker(cx, cy) {
  let out = '';
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    const r = Math.hypot(x + 0.5, y + 0.5);
    if (r > 5.6) continue;
    const fill = r > 4.6 ? '#b8bcc2' : r < 1.6 ? '#8a8a92' : (x + y) % 2 === 0 ? '#3a3a40' : '#18181b';
    out += rect(cx + x, cy + y, 1, 1, fill);
  }
  return `<g class="cone" style="transform-origin:${(cx + 0.5) * PX}px ${(cy + 0.5) * PX}px">${out}</g>`;
}

export function mountBoombox(button, keys) {
  let body = '';
  // the handle
  body += rect(13, 0, 20, 1, '#c9ccd1') + rect(13, 1, 1, 2, '#c9ccd1') + rect(32, 1, 1, 2, '#c9ccd1');
  // the case: dark, outlined, a lighter strip along the top
  body += rect(0, 3, W, H - 3, '#111') + rect(1, 4, W - 2, H - 5, '#2e2e33') + rect(1, 4, W - 2, 1, '#5a5a62');
  // the car radio's face: chrome edge, black panel, the cream scale with its ticks
  body += rect(13, 5, 20, 18, '#c9ccd1') + rect(14, 6, 18, 16, '#0b0b0d');
  body += rect(15, 7, 16, 4, '#e8dfc2');
  for (let x = 15; x <= 30; x += 2) body += rect(x, 7, 1, 1, '#6b6457');
  body += rect(15, 10, 16, 1, '#d4c9a8');
  // two little knobs under the buttons
  body += rect(15, 19, 3, 2, '#b8bcc2') + rect(16, 19, 1, 2, '#0b0b0d') + rect(28, 19, 3, 2, '#b8bcc2') + rect(29, 19, 1, 2, '#0b0b0d');
  // the buttons, each its own group so the pressed one can sink
  const buttons = keys.map((key, k) => {
    let g = rect(KEYS[k], 13, 4, 5, '#000') + rect(KEYS[k] + 1, 13, 3, 5, '#1c1c1e') + rect(KEYS[k] + 1, 13, 3, 1, '#45454b');
    GLYPHS[key].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') g += rect(KEYS[k] + 1 + x, 14 + y, 1, 1, '#f2f2f2'); }));
    return `<g class="key" data-index="${k}">${rect(KEYS[k], 12, 4, 7, 'transparent')}${g}</g>`;
  }).join('');
  const needle = `<g class="needle">${rect(0, 7, 1, 4, '#e0302a')}</g>`;
  const host = button.querySelector('.boom-art') ?? button;
  host.innerHTML = `<svg class="boom" viewBox="0 0 ${W * PX} ${H * PX}" width="${W * PX}" height="${H * PX}" shape-rendering="crispEdges" aria-hidden="true">`
    + `${body}${speaker(6, 14)}${speaker(39, 14)}${buttons}${needle}</svg>`;
  const needleEl = button.querySelector('.needle');
  const keyEls = [...button.querySelectorAll('.key')];
  return {
    keys: keyEls, // so a big one's buttons can be pressed
    // which station the dial is on, and whether sound is coming out
    set(index, playing) {
      needleEl.style.transform = `translateX(${(KEYS[index] + 2) * PX}px)`;
      keyEls.forEach((el, k) => el.classList.toggle('down', k === index));
      button.classList.toggle('playing', playing);
    },
  };
}
