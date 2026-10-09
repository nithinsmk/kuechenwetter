// The little scanned things above the gallery link: strips of 12 turns each
// (sprites/NAME.webp, made with tools/sprites.html). They hover over the button. On a
// computer they chase the mouse in a chain and leave fading copies behind, like the
// pointer trails of old Windows, then drift home once the mouse rests.

const SIZE = 60; // css px, matches .floater in radio.css
const SPOTS = [[14, -2], [36, 14], [58, -4], [80, 12], [102, -2]]; // % across the link, px above it
const REST_AFTER = 2500; // ms without moving before they go home

export async function floatTheGallery(link, layer) {
  const items = await fetch('scans/characters/characters.json', { cache: 'no-store' }).then((r) => r.json());
  const things = items.slice(0, SPOTS.length).map((item, i) => {
    const el = document.createElement('i');
    el.className = 'floater';
    el.style.cssText = `--sheet: url("sprites/${item.name}.webp"); --spin: ${2.4 + i * 0.5}s;`
      + `--bob: ${2.8 + (i % 3) * 0.8}s; --delay: -${i * 0.9}s;`;
    layer.append(el);
    return { el, spot: SPOTS[i], x: null, y: null, speed: 0 };
  });

  const chase = matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mouse = null;
  let movedAt = 0;
  if (chase) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse = [e.clientX, e.clientY];
      movedAt = performance.now();
    });
    document.documentElement.addEventListener('mouseleave', () => { movedAt = 0; });
  }

  // A fading copy left behind, facing front.
  function ghost(t) {
    const copy = document.createElement('i');
    copy.className = 'floater ghost';
    copy.style.cssText = `${t.el.style.cssText} left: ${t.x}px; top: ${t.y}px;`;
    copy.addEventListener('animationend', () => copy.remove());
    layer.append(copy);
  }

  let lastGhost = 0;
  function frame(now) {
    const box = link.getBoundingClientRect();
    const shown = box.width > 0;
    const following = mouse && now - movedAt < REST_AFTER;
    things.forEach((t, i) => {
      t.el.hidden = !shown;
      const home = [box.left + (box.width * t.spot[0]) / 100 - SIZE / 2, box.top - t.spot[1] - SIZE];
      if (t.x === null) [t.x, t.y] = home;
      // The first one keeps just below and right of the pointer; each next one follows the one before.
      const [tx, ty] = !following ? home : i === 0 ? [mouse[0] + 12, mouse[1] + 12] : [things[i - 1].x, things[i - 1].y];
      const pull = following ? (i === 0 ? 0.3 : 0.2) : 0.06;
      const dx = (tx - t.x) * pull;
      const dy = (ty - t.y) * pull;
      t.x += dx;
      t.y += dy;
      t.speed = Math.hypot(dx, dy);
      t.el.style.left = `${t.x}px`;
      t.el.style.top = `${t.y}px`;
    });
    if (following && now - lastGhost > 50) {
      lastGhost = now;
      for (const t of things) if (t.speed > 1.5) ghost(t);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
