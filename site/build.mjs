// Puts every figure on one small site: a front page with a card per figure, each figure on its own page with a
// thumbnail menu on top (← → switch figures, Space/Enter runs the next step), and a 1200×630 preview card per page.
// Set SITE_URL (e.g. https://probe.example.com) so preview images get the absolute URLs X needs.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(HERE, "dist");
const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const SKIP_SHOTS = process.argv.includes("--no-shots");
const DRIVE = join(ROOT, "vendor/anatomy/scripts/drive.mjs");
const CAPTURE = join(ROOT, "vendor/anatomy/scripts/capture.mjs");

const FIGURES = [
  { slug: "reading-the-meter", dir: "01-reading-the-meter", name: "Reading the meter", line: "A probe, a magnet and a blinking light: how a phone reads a water meter without a wire ever touching the meter.", still: 7.215 },
  { slug: "build-your-own", dir: "02-build-your-own", name: "Build your own probe", line: "Two parts make the probe. Build it on the bench, then try to break it.", still: 20 },
  { slug: "inside-the-meter", dir: "03-inside-the-meter", name: "Inside the meter", line: "A ping going with the water wins by 215 billionths of a second, and that tiny lead tells the meter how much water went by.", still: 6.5 },
  { slug: "ft232", dir: "04-ft232", name: "The chip in the plug", line: "The phone's letters arrive 26,000 times faster than the light can blink them. Meet the chip with the bucket.", still: 14 },
  { slug: "conversation", dir: "05-conversation", name: "The conversation", line: "Every letter is ten flashes. Count them at the wrong speed and the meter speaks nonsense.", still: 5 },
].filter((f) => existsSync(join(ROOT, "figures", f.dir, "index.html")));

const abs = (path) => (SITE_URL ? `${SITE_URL}/${path}` : `/${path}`);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const run = (args) => {
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.status !== 0) console.error(r.stdout, r.stderr);
};

if (!SKIP_SHOTS) rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "img"), { recursive: true });

// Stills: one mid-step moment per figure, as a menu thumbnail and as the art of the preview card.
for (const fig of FIGURES) {
  if (SKIP_SHOTS) continue;
  const page = pathToFileURL(join(ROOT, "figures", fig.dir, "index.html")).href + "?render";
  const actions = JSON.stringify([["wait", 1200], ["eval", `seek(${fig.still})`], ["wait", 250], ["shot", join(OUT, "img", `${fig.slug}.png`), ".bk-card", 2]]);
  run([DRIVE, page, actions, "--width", "1500", "--height", "1320"]);
  run([DRIVE, page, JSON.stringify([["wait", 1200], ["eval", `seek(${fig.still})`], ["wait", 250], ["shot", join(OUT, "img", `${fig.slug}-thumb.png`), ".bk-card", 0.5]]), "--width", "1500", "--height", "1320"]);
}

const BOOK_CSS = readFileSync(join(ROOT, "shared/book.css"), "utf8");
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=JetBrains+Mono:wght@500;700&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">';

// The 1200×630 preview card for each page, drawn as HTML and captured.
for (const fig of FIGURES) {
  if (SKIP_SHOTS) continue;
  const card = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BOOK_CSS}
body{margin:0;width:1200px;height:630px;overflow:hidden}
.og{position:relative;width:1200px;height:630px;display:grid;grid-template-columns:430px 1fr;align-items:center;gap:20px;padding:44px 40px 44px 56px;box-sizing:border-box;background:var(--paper)}
.og h1{margin:0 0 18px;font:800 46px/1.08 var(--font-ui);color:var(--ink);letter-spacing:-.01em}
.og p{margin:0;font:700 22px/1.35 var(--font-ui);color:var(--ink-2)}
.og .tag{display:inline-block;margin-bottom:22px;font:700 15px/1 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
.og img{width:100%;height:auto;border-radius:22px;box-shadow:inset 0 0 0 1.5px var(--ink)}
</style></head><body class="book"><div class="og"><div><span class="tag">How a meter probe works</span><h1>${esc(fig.name)}</h1><p>${esc(fig.line)}</p></div><img src="${pathToFileURL(join(OUT, "img", `${fig.slug}.png`)).href}"></div></body></html>`;
  const file = join(OUT, "img", `${fig.slug}-og.html`);
  writeFileSync(file, card);
  const shot = join(OUT, "img", `${fig.slug}-og-raw.png`);
  run([CAPTURE, file, "--out", shot, "--width", "1200", "--height", "630", "--scale", "1", "--select", ".og", "--wait", "1200"]);
  spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-i", shot, "-vf", "crop=1200:630:(iw-1200)/2:(ih-630)/2", join(OUT, "img", `${fig.slug}-og.png`)]);
  rmSync(file);
  rmSync(shot);
}

const menu = (current) =>
  `<nav class="st-nav" aria-label="Figures"><a class="st-home" href="/">All machines</a><ol class="st-menu">${FIGURES.map((f, i) => `<li><a href="/${f.slug}/"${f.slug === current ? ' aria-current="page"' : ""}><img src="/img/${f.slug}-thumb.png" alt="" width="120" height="91"><span><b>${i + 1}</b> ${esc(f.name)}</span></a></li>`).join("")}</ol></nav>`;

const NAV_CSS = `
.st-nav{display:flex;align-items:center;gap:14px;margin:0 0 16px;overflow-x:auto;padding:2px 2px 6px}
.st-home{flex:none;font-weight:800;color:var(--ink);text-decoration:none;padding:8px 12px;border-radius:999px;box-shadow:inset 0 0 0 1.5px var(--ink)}
.st-menu{display:flex;gap:10px;list-style:none;margin:0;padding:0}
.st-menu a{display:grid;gap:4px;width:132px;padding:6px;border-radius:14px;color:var(--ink);text-decoration:none;font-size:12.5px;font-weight:800;line-height:1.2;opacity:.7}
.st-menu a:hover,.st-menu a[aria-current]{opacity:1;background:var(--paper-2);box-shadow:inset 0 0 0 1.5px var(--ink)}
.st-menu img{width:120px;height:auto;border-radius:9px;display:block}
.st-menu b{font-family:var(--font-mono)}
`;
const NAV_JS = (prev, next) => `
document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, textarea, select")) return;
  if (event.key === "ArrowLeft" && ${JSON.stringify(prev)}) location.href = ${JSON.stringify(prev)};
  if (event.key === "ArrowRight" && ${JSON.stringify(next)}) location.href = ${JSON.stringify(next)};
});`;

const metaTags = ({ title, description, path, image }) =>
  [
    `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:image" content="${abs(image)}">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    SITE_URL ? `<meta property="og:url" content="${abs(path)}">` : "",
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${abs(image)}">`,
  ].join("");

const external = (html) => html.replace(/<a href="(https?:\/\/[^"]+)"(?![^>]*target=)/g, '<a href="$1" target="_blank" rel="noopener"');

FIGURES.forEach((fig, i) => {
  let html = readFileSync(join(ROOT, "figures", fig.dir, "index.html"), "utf8");
  const prev = i > 0 ? `/${FIGURES[i - 1].slug}/` : "";
  const next = i < FIGURES.length - 1 ? `/${FIGURES[i + 1].slug}/` : "";
  html = html.replace("</title>", `</title>${metaTags({ title: fig.name, description: fig.line, path: `${fig.slug}/`, image: `img/${fig.slug}-og.png` })}<style>${NAV_CSS}</style>`);
  html = html.replace('<main class="bk-page">', `<main class="bk-page">${menu(fig.slug)}`);
  const end = html.lastIndexOf("</body>");
  html = html.slice(0, end) + `<script>${NAV_JS(prev, next)}</script>` + html.slice(end);
  html = external(html);
  mkdirSync(join(OUT, fig.slug), { recursive: true });
  writeFileSync(join(OUT, fig.slug, "index.html"), html);
});

const cards = FIGURES.map((f, i) => `<a class="st-card" href="/${f.slug}/"><img src="/img/${f.slug}.png" alt="${esc(f.name)}, mid-step"><span class="st-num">Fig ${i + 1}</span><h2>${esc(f.name)}</h2><p>${esc(f.line)}</p></a>`).join("");
const front = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>How a meter probe works</title>${metaTags({ title: "How a meter probe works", description: "Five machines you can run: how an optical probe reads a smart water meter, and how to build your own.", path: "", image: FIGURES.length ? `img/${FIGURES[0].slug}-og.png` : "" })}${FONTS}<style>${BOOK_CSS}
.st-front{width:min(1180px,100% - 32px);margin:40px auto 80px}
.st-front h1{margin:0 0 6px;font-size:clamp(28px,4.4vw,48px);line-height:1.08;font-weight:800;letter-spacing:-.015em}
.st-front .st-lede{margin:0 0 28px;font-size:clamp(16px,2vw,20px);font-weight:700;color:var(--ink-2);max-width:720px}
.st-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:22px}
.st-card{display:grid;gap:6px;padding:12px 12px 18px;border-radius:22px;background:var(--paper-2);box-shadow:inset 0 0 0 1.5px var(--ink);color:var(--ink);text-decoration:none;transition:transform .15s}
.st-card:hover{transform:translateY(-3px)}
.st-card img{width:100%;height:auto;border-radius:14px;display:block}
.st-card h2{margin:4px 6px 0;font-size:22px;line-height:1.2;font-weight:800}
.st-card p{margin:0 6px;font-weight:700;color:var(--ink-2);line-height:1.4}
.st-num{margin:6px 6px 0;font:700 12px/1 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
</style></head><body class="book"><main class="st-front"><h1>How a meter probe works</h1><p class="st-lede">Five machines you can run. Press the buttons and watch a phone read a water meter with nothing but flashes of light, then build the probe yourself.</p><div class="st-grid">${cards}</div></main></body></html>`;
writeFileSync(join(OUT, "index.html"), front);
console.log(`site: ${FIGURES.length} figures → ${OUT}${SITE_URL ? "" : " (set SITE_URL for absolute preview-image URLs)"}`);
