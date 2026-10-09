// Salvia's sounds, made in the browser (Web Audio), not recordings: the crinkle of a
// treat packet, and her purr. The audio starts from a tap, as phones require.

let ctx = null;
let noise = null;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A packet being shaken: dozens of tiny high crackles over a soft rustle.
export function crinkle() {
  const ac = audio();
  const now = ac.currentTime;
  const out = ac.createGain();
  out.gain.value = 0.7;
  out.connect(ac.destination);

  for (let i = 0; i < 46; i++) {
    const t = now + 0.75 * Math.random() ** 1.4;
    const grain = ac.createBufferSource();
    grain.buffer = noise;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200 + Math.random() * 7000;
    band.Q.value = 0.7 + Math.random() * 2.5;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.75, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.012 + Math.random() * 0.05);
    grain.connect(band).connect(env).connect(out);
    grain.start(t, Math.random() * 1.8, 0.08);
  }

  const rustle = ac.createBufferSource();
  rustle.buffer = noise;
  const high = ac.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 3000;
  const bed = ac.createGain();
  bed.gain.setValueAtTime(0.0001, now);
  bed.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
  bed.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  rustle.connect(high).connect(bed).connect(out);
  rustle.start(now, Math.random(), 0.85);
}

// The purr: low rumbling noise pulsing about 25 times a second, swelling as she breathes.
let purring = null;

export function startPurr() {
  if (purring) return;
  const ac = audio();
  const now = ac.currentTime;
  const source = ac.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const low = ac.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 320;
  const rumble = ac.createGain(); // pulsed by the motor
  rumble.gain.value = 0.5;
  const motor = ac.createOscillator();
  motor.type = 'triangle';
  motor.frequency.value = 25;
  const motorDepth = ac.createGain();
  motorDepth.gain.value = 0.5;
  const breathing = ac.createGain(); // swells with each breath
  breathing.gain.value = 0.7;
  const breath = ac.createOscillator();
  breath.frequency.value = 0.45;
  const breathDepth = ac.createGain();
  breathDepth.gain.value = 0.3;
  const volume = ac.createGain(); // fades in and out
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(1, now + 0.5);

  motor.connect(motorDepth).connect(rumble.gain);
  breath.connect(breathDepth).connect(breathing.gain);
  source.connect(low).connect(rumble).connect(breathing).connect(volume).connect(ac.destination);
  for (const node of [source, motor, breath]) node.start(now);
  purring = { volume, nodes: [source, motor, breath] };
}

export function stopPurr() {
  if (!purring) return;
  const { volume, nodes } = purring;
  purring = null;
  const now = ctx.currentTime;
  volume.gain.cancelScheduledValues(now);
  volume.gain.setValueAtTime(volume.gain.value, now);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  for (const node of nodes) node.stop(now + 0.9);
}
