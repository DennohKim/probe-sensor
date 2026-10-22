// Records a figure's tour frame by frame: opens it with ?render, calls window.seek(t) for every frame,
// pipes screenshots into ffmpeg, and writes the events the score needs (step clicks, sound words, light ticks).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromePort } from "../vendor/anatomy/scripts/chrome-port.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const page = resolve(args[0] ?? "");
const out = resolve(flag("--out", "tour.mp4"));
const fps = Number(flag("--fps", 60));
const width = Number(flag("--width", 1500));
const height = Number(flag("--height", 1320));
const seconds = flag("--seconds", "");
if (!existsSync(page)) {
  console.error("usage: node tools/record.mjs <figure/index.html> --out video.mp4 [--fps 60] [--width 1500] [--height 1320] [--seconds 36]");
  process.exit(1);
}

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = mkdtempSync(join(tmpdir(), "probe-record-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--allow-file-access-from-files", "--force-device-scale-factor=1", "about:blank"]);
const port = await chromePort(chrome, profile);
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done) => socket.addEventListener("open", done, { once: true }));
let id = 0;
const waiting = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    const { done, fail } = waiting.get(message.id);
    waiting.delete(message.id);
    message.error ? fail(new Error(message.error.message)) : done(message.result);
  }
});
const send = (method, params = {}) => new Promise((done, fail) => {
  const call = ++id;
  waiting.set(call, { done, fail });
  socket.send(JSON.stringify({ id: call, method, params }));
});
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: pathToFileURL(page).href + "?render" });
for (let i = 0; i < 100 && !(await evaluate("typeof window.seek === 'function' && document.readyState === 'complete'")); i++) await new Promise((r) => setTimeout(r, 100));
await evaluate("document.fonts.ready.then(() => true)");
await new Promise((r) => setTimeout(r, 400));

const total = seconds ? Number(seconds) : await evaluate("window.tourLength");
const card = await evaluate("(() => { const r = document.querySelector('.bk-card').getBoundingClientRect(); return [r.width, r.height, r.left, r.top].map((v) => Math.round(v / 2) * 2); })()");
const frames = Math.round(total * fps);
const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });

// Sound words, step starts and light ticks, read from the page itself so the score lands on the picture.
const probe = `(() => {
  const steps = [...document.querySelectorAll('.bk-step')].map((b) => b.dataset.state);
  const words = [...document.querySelectorAll('.bk-sound')].map((w) => [w.textContent, +w.style.opacity || 0]);
  const tick = typeof window.tickProbe === 'function' ? window.tickProbe() : 0;
  return { steps, words, tick };
})()`;
const events = [];
let before = null;
const started = Date.now();
for (let f = 0; f < frames; f++) {
  const t = f / fps;
  await evaluate(`window.seek(${t}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  const now = await evaluate(probe);
  if (before) {
    now.steps.forEach((state, k) => { if (state === "running" && before.steps[k] !== "running") events.push({ t, kind: "press", step: k }); });
    now.words.forEach(([word, a], k) => { if (a > 0.05 && before.words[k][1] <= 0.05) events.push({ t, kind: "word", word }); });
    if (now.tick > 0.5 && before.tick <= 0.5) events.push({ t, kind: "tick" });
  }
  before = now;
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 92 });
  const buffer = Buffer.from(shot.data, "base64");
  if (!ffmpeg.stdin.write(buffer)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  if (f % (fps * 3) === 0) process.stdout.write(`\r${f}/${frames} frames, ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
ffmpeg.stdin.end();
await new Promise((r) => ffmpeg.on("close", r));
writeFileSync(out.replace(/\.mp4$/, ".events.json"), JSON.stringify({ seconds: total, fps, card, events }, null, 1));
socket.close();
const exited = new Promise((r) => chrome.once("exit", r));
chrome.kill("SIGKILL");
await exited;
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
} catch (error) {
  console.warn(`\ncould not remove the temporary Chrome profile ${profile}: ${error.code}`);
}
console.log(`\nwrote ${out} (${frames} frames, ${total.toFixed(2)} s) and ${events.length} events`);
