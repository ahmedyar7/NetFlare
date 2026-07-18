// Synthesized ops-console blips for arc launch / impact.
// No audio assets: everything is generated with the Web Audio API.

let ctx = null;
let master = null;
let enabled = false;

// Burst protection — events can arrive faster than they can be heard.
const MAX_PER_SEC = 6;
let recent = [];

function allowed() {
  const now = performance.now();
  recent = recent.filter((t) => now - t < 1000);
  if (recent.length >= MAX_PER_SEC) return false;
  recent.push(now);
  return true;
}

/**
 * Must be called from a user gesture (click/keypress) — browsers refuse to
 * start an AudioContext otherwise.
 */
export async function enableAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") await ctx.resume();
  enabled = true;
  return true;
}

export function disableAudio() {
  enabled = false;
}

export function isAudioEnabled() {
  return enabled;
}

function noiseBuffer(duration) {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // Decaying white noise.
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  return buf;
}

/** Soft upward blip when an arc is dispatched. */
export function playLaunch() {
  if (!enabled || !ctx || !allowed()) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(660, t + 0.12);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.18);
}

/**
 * Impact when the arc reaches its target. Higher score = lower, harsher hit,
 * mirroring the amber -> red ramp used on the globe.
 */
export function playImpact(score = 75) {
  if (!enabled || !ctx || !allowed()) return;

  const t = ctx.currentTime;
  const severity = Math.min(Math.max((score - 70) / 30, 0), 1); // 0..1

  // Low thump — drops in pitch as severity climbs.
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "triangle";
  const base = 180 - severity * 90;
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.18);
  oscGain.gain.setValueAtTime(0.0001, t);
  oscGain.gain.exponentialRampToValueAtTime(0.18 + severity * 0.12, t + 0.01);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(oscGain).connect(master);
  osc.start(t);
  osc.stop(t + 0.24);

  // Noise crack — only really present on high-severity hits.
  if (severity > 0.2) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const nGain = ctx.createGain();
    src.buffer = noiseBuffer(0.12);
    filter.type = "bandpass";
    filter.frequency.value = 900 + severity * 1800;
    filter.Q.value = 1.2;
    nGain.gain.value = 0.05 + severity * 0.1;
    src.connect(filter).connect(nGain).connect(master);
    src.start(t);
  }
}
