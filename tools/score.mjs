// Scores a recorded tour in code, no samples: a lo-fi bed at 84 BPM (electric piano on Fmaj7 Em7 Dm7 Cmaj7, round bass,
// brushed drums after the first bar, faint vinyl crackle) plus quiet sounds at the exact seconds in <video>.events.json.
// Masters to -14 LUFS with true peak under -1 dBTP (two-pass loudnorm) and muxes it into the video.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const video = resolve(process.argv[2] ?? "");
const out = resolve(process.argv[3] ?? video.replace(/\.mp4$/, "-scored.mp4"));
const { seconds, events } = JSON.parse(readFileSync(video.replace(/\.mp4$/, ".events.json"), "utf8"));

const TARGET = "I=-14:TP=-1.5:LRA=11";
const RATE = 44100;
const N = Math.ceil((seconds + 0.5) * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const add = (i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += v * Math.cos(((pan + 1) * Math.PI) / 4);
  R[i] += v * Math.sin(((pan + 1) * Math.PI) / 4);
};

const BEAT = 60 / 84;
const BAR = BEAT * 4;
const CHORDS = [
  { notes: [57, 60, 64, 65], root: 41 },
  { notes: [55, 59, 62, 64], root: 40 },
  { notes: [53, 57, 60, 62], root: 38 },
  { notes: [52, 55, 59, 60], root: 36 },
];

function piano(t0, midi, gain, length = 2.4) {
  const f = hz(midi);
  const start = Math.round(t0 * RATE);
  const n = Math.round(length * RATE);
  for (let j = 0; j < n; j++) {
    const t = j / RATE;
    const env = Math.min(1, t / 0.006) * Math.exp(-t / 1.1) * (1 - Math.min(1, Math.max(0, (t - length + 0.25) / 0.25)));
    const trem = 1 - 0.14 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4.6 * t));
    const tine = 0.16 * Math.exp(-t / 0.09) * Math.sin(2 * Math.PI * f * 4.02 * t);
    const v = (Math.sin(2 * Math.PI * f * t) + 0.32 * Math.exp(-t / 0.5) * Math.sin(2 * Math.PI * 2 * f * t) + tine) * env * trem * gain;
    add(start + j, v, (midi - 58) / 14);
  }
}
function bass(t0, midi, gain, length = BEAT * 1.6) {
  const f = hz(midi);
  const start = Math.round(t0 * RATE);
  const n = Math.round(length * RATE);
  for (let j = 0; j < n; j++) {
    const t = j / RATE;
    const env = Math.min(1, t / 0.012) * Math.exp(-t / 0.9) * Math.min(1, (length - t) / 0.06);
    add(start + j, (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(2 * Math.PI * 2 * f * t)) * env * gain);
  }
}
function kick(t0, gain) {
  const start = Math.round(t0 * RATE);
  let phase = 0;
  for (let j = 0; j < RATE * 0.32; j++) {
    const t = j / RATE;
    phase += (2 * Math.PI * (48 + 70 * Math.exp(-t / 0.035))) / RATE;
    add(start + j, Math.sin(phase) * Math.exp(-t / 0.13) * gain);
  }
}
function noise(t0, length, gain, { attack = 0.004, decay = 0.08, lo = 0.2, hi = 0.02, pan = 0 } = {}) {
  const start = Math.round(t0 * RATE);
  let lp = 0, hp = 0, prev = 0;
  for (let j = 0; j < length * RATE; j++) {
    const t = j / RATE;
    const x = rand() * 2 - 1;
    lp += lo * (x - lp);
    hp = (1 - hi) * (hp + lp - prev);
    prev = lp;
    add(start + j, hp * Math.min(1, t / attack) * Math.exp(-t / decay) * gain, pan);
  }
}
function tone(t0, f0, f1, length, gain, decay = length / 3, pan = 0) {
  const start = Math.round(t0 * RATE);
  let phase = 0;
  for (let j = 0; j < length * RATE; j++) {
    const t = j / RATE;
    phase += (2 * Math.PI * (f0 + (f1 - f0) * (t / length))) / RATE;
    add(start + j, Math.sin(phase) * Math.min(1, t / 0.003) * Math.exp(-t / decay) * Math.min(1, (length - t) / 0.01) * gain, pan);
  }
}

// The bed.
for (let bar = 0; bar * BAR < seconds + BAR; bar++) {
  const t = bar * BAR;
  const chord = CHORDS[bar % 4];
  chord.notes.forEach((m, k) => piano(t + k * 0.012 + rand() * 0.01, m, 0.05, BAR * 0.95));
  chord.notes.slice(1).forEach((m, k) => piano(t + BEAT * 2.5 + k * 0.01, m, 0.026, BEAT * 1.4));
  bass(t, chord.root, 0.2);
  bass(t + BEAT * 2.5, chord.root + (bar % 2 ? 7 : 0), 0.14, BEAT * 1.3);
  if (bar >= 1) {
    for (let b = 0; b < 4; b++) {
      if (b % 2 === 0) kick(t + b * BEAT, 0.22);
      else noise(t + b * BEAT, 0.3, 0.16, { attack: 0.012, decay: 0.09, lo: 0.5, hi: 0.08, pan: 0.15 });
      noise(t + b * BEAT + BEAT / 2, 0.18, 0.05, { attack: 0.02, decay: 0.06, lo: 0.6, hi: 0.15, pan: -0.25 });
    }
  }
}
for (let j = 0; j < N; j++) {
  if (rand() < 7 / RATE) {
    const amp = 0.02 + rand() * 0.05;
    for (let k = 0; k < 40 && j + k < N; k++) add(j + k, (rand() * 2 - 1) * amp * Math.exp(-k / 6), rand() * 2 - 1);
  }
  add(j, (rand() * 2 - 1) * 0.0025);
}

// Sounds on the picture.
const fx = {
  press: (t) => { noise(t, 0.02, 0.22, { decay: 0.004, lo: 0.9, hi: 0.4 }); tone(t, 2100, 1900, 0.03, 0.05); },
  tick: (t) => tone(t, 3200, 3000, 0.02, 0.03, 0.006, 0.3),
  click: (t) => { noise(t, 0.015, 0.3, { decay: 0.003, lo: 0.9, hi: 0.5 }); noise(t + 0.045, 0.015, 0.22, { decay: 0.003, lo: 0.9, hi: 0.5 }); },
  clack: (t) => { tone(t, 220, 140, 0.09, 0.3, 0.03); noise(t, 0.05, 0.25, { decay: 0.012, lo: 0.6, hi: 0.2 }); },
  beep: (t) => { tone(t, 1760, 1760, 0.11, 0.09, 0.2, 0.2); tone(t + 0.16, 2093, 2093, 0.14, 0.09, 0.2, 0.2); },
  zip: (t) => { for (let k = 0; k < 8; k++) tone(t + k * 0.03, 600 + k * 260, 800 + k * 260, 0.05, 0.035, 0.03); },
  ping: (t) => tone(t, 2600, 2600, 0.45, 0.06, 0.12, -0.2),
  drip: (t) => tone(t, 1300, 420, 0.07, 0.12, 0.03),
  whoosh: (t) => noise(t, 0.45, 0.12, { attack: 0.15, decay: 0.2, lo: 0.3, hi: 0.05 }),
  hiss: (t) => noise(t, 0.5, 0.06, { attack: 0.05, decay: 0.3, lo: 0.8, hi: 0.3 }),
  hum: (t) => { for (let h = 1; h <= 4; h++) tone(t, 120 * h, 120 * h, 0.6, 0.05 / h, 0.5); },
  pop: (t) => tone(t, 900, 700, 0.05, 0.08, 0.02),
};
const kindOf = (word) => {
  const w = word.toLowerCase();
  if (/beep|ding/.test(w)) return "beep";
  if (/clack|clunk|thunk|snap|knock/.test(w)) return "clack";
  if (/click|tok|tak|tick|clik/.test(w)) return "click";
  if (/zip|zoom|vroom/.test(w)) return "zip";
  if (/ping|pong|bip/.test(w)) return "ping";
  if (/drip|plip|plop|glug|blub/.test(w)) return "drip";
  if (/whoosh|swish|shh|fwoo/.test(w)) return "whoosh";
  if (/hiss|pss|sss|fizz/.test(w)) return "hiss";
  if (/hum|buzz|zz|brr|grr|whirr/.test(w)) return "hum";
  if (/blink/.test(w)) return null;
  return "pop";
};
let lastTick = -1;
for (const e of events) {
  if (e.kind === "press") fx.press(e.t);
  else if (e.kind === "tick") { if (e.t - lastTick > 0.06) { fx.tick(e.t); lastTick = e.t; } }
  else if (e.kind === "word") { const kind = kindOf(e.word); if (kind) fx[kind](e.t); }
}

const raw = video.replace(/\.mp4$/, ".score-raw.wav");
const wav = Buffer.alloc(44 + N * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + N * 4, 4); wav.write("WAVE", 8); wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(N * 4, 40);
let peak = 0;
for (let j = 0; j < N; j++) peak = Math.max(peak, Math.abs(L[j]), Math.abs(R[j]));
const g = 0.7 / peak;
for (let j = 0; j < N; j++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[j] * g)) * 32767), 44 + j * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[j] * g)) * 32767), 46 + j * 4);
}
writeFileSync(raw, wav);

const ffmpeg = (args) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" }).stderr;
const loudness = (file) => {
  const text = ffmpeg(["-i", file, "-af", `loudnorm=${TARGET}:print_format=json`, "-f", "null", "-"]);
  return JSON.parse(text.slice(text.lastIndexOf("{"), text.lastIndexOf("}") + 1));
};

const first = loudness(raw);
const mastered = video.replace(/\.mp4$/, ".score.wav");
ffmpeg(["-y", "-i", raw, "-af", `loudnorm=${TARGET}:measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}:measured_thresh=${first.input_thresh}:offset=${first.target_offset}:linear=true,aresample=48000`, "-ar", "48000", mastered]);
const check = loudness(mastered);
ffmpeg(["-y", "-i", video, "-i", mastered, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
rmSync(raw, { force: true });
console.log(`mastered: ${check.input_i} LUFS, true peak ${check.input_tp} dBTP · wrote ${out}`);
