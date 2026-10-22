// The critic's jump check on a recorded tour: counts how many pixels change between frames inside the figure card
// (sampled every 0.1 s, as in prompt 4) and flags any frame that changes 3x more than its neighbours.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const video = resolve(process.argv[2] ?? "");
const eventsFile = video.replace(/\.mp4$/, ".events.json");
const card = existsSync(eventsFile) ? JSON.parse(readFileSync(eventsFile, "utf8")).card : null;
const crop = process.argv[3] ?? (card ? card.join(":") : "968:714:402:176");
const W = 320;
const [cw, ch] = crop.split(":").map(Number);
const H = Math.round((W * ch) / cw);
const raw = spawnSync("ffmpeg", ["-loglevel", "error", "-i", video, "-vf", `fps=10,crop=${crop},scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 }).stdout;
const size = W * H;
const frames = raw.length / size;
const changed = [0];
for (let f = 1; f < frames; f++) {
  let n = 0;
  for (let i = 0; i < size; i++) if (Math.abs(raw[f * size + i] - raw[(f - 1) * size + i]) > 12) n++;
  changed.push(n);
}
const flagged = [];
for (let f = 2; f < frames - 2; f++) {
  const around = [changed[f - 2], changed[f - 1], changed[f + 1], changed[f + 2]];
  const mean = around.reduce((a, b) => a + b, 0) / 4;
  if (changed[f] > 3 * Math.max(mean, 40) && changed[f] > size * 0.01) flagged.push({ t: (f / 10).toFixed(1), changed: changed[f], neighbours: Math.round(mean) });
}
console.log(`${frames} frames at 0.1 s, ${W}x${H} card samples; median change ${[...changed].sort((a, b) => a - b)[Math.floor(frames / 2)]} px`);
console.log(flagged.length ? flagged.map((x) => `jump at ${x.t} s: ${x.changed} px vs ~${x.neighbours}`).join("\n") : "no jumps");
