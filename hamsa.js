// The evil-eye hamsa, in pixels (16 × 20): silver edging, deep and light blue, the eye
// in the palm, blue beads hanging from the fingers. Drawn as the button above the treats
// (radio.js) and as the pendant on Salvia's collar (salvia.js).
export const HAMSA = [
  '....ssssssss....', '..ssbbbbbbbbss..', '.sbbbbbbbbbbbbs.', '.sbblwwwwwwlbbs.',
  'sbbwwwiiiiwwwbbs', 'sbbwwikkkkiwwbbs', 'sbbwwwiiiiwwwbbs', '.sbblwwwwwwlbbs.',
  'ssbbbbbbbbbbbbss', 'sbssbbsbbsbbssbs', 'slsslbslbslbssls', '.s.sbbsbbsbbs.s.',
  '...sblsblsbls...', '...sbbsbbsbbs...', '...ssssssssss...', '....s..s..s.....',
  '...ooo....ooo...', '...ooo....ooo...', '......ooo.......', '......ooo.......',
];
export const HAMSA_INK = { s: '#c9d1dc', b: '#1d3fa8', l: '#4f7fe0', w: '#f4f6fa', i: '#2f6fe0', k: '#0b1640', o: '#2f6fe8' };

// A canvas of it, one canvas pixel per hamsa pixel (scale it up with nearest filtering).
export function hamsaCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 20;
  const ctx = canvas.getContext('2d');
  HAMSA.forEach((row, y) => [...row].forEach((ch, x) => {
    if (HAMSA_INK[ch]) { ctx.fillStyle = HAMSA_INK[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
  return canvas;
}
