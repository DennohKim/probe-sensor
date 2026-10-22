import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ISO_CSS } from "../vendor/anatomy/kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BOOK_CSS = readFileSync(join(HERE, "book.css"), "utf8");
const STEPPER = readFileSync(join(HERE, "stepper.js"), "utf8");

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=JetBrains+Mono:wght@500;700&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">';

const CURSOR =
  '<svg class="bk-cursor" viewBox="0 0 26 26" aria-hidden="true"><path d="M4 3 L4 21 L9 16.5 L12.5 24 L15.6 22.6 L12.2 15.2 L19 15.2 Z" fill="#fbf7ee" stroke="#1f2a44" stroke-width="1.6" stroke-linejoin="round"/></svg>';

export const stripExports = (source) => source.replace(/^export /gm, "");

// Every figure page has the same frame: steps on the left, hint, figure, chips, extras, big idea, sources.
export function bookPage({ fig, title, question, svg, extras = "", idea, sources = [], css = "", script, nav = "", label }) {
  const sourceList = sources.map((s) => `<li>${s}</li>`).join("");
  const body = `
<main class="bk-page">
${nav}
<header class="bk-head"><h1>${question}</h1><span class="bk-fig">${fig} · ${title}</span></header>
<div class="bk-grid">
  <aside class="bk-side" aria-label="Steps">
    <div class="bk-mode" role="group" aria-label="Mode"><button type="button" data-mode="manual">Manual</button><button type="button" data-mode="auto">Auto</button></div>
    <ol class="bk-steps"></ol>
    <button class="bk-reset" type="button">Start over</button>
  </aside>
  <section class="bk-main">
    <div class="bk-hintbar"><p class="bk-hint" aria-hidden="true"></p><span class="bk-badge" title="Speed compared with real time"></span></div>
    <div class="bk-card" role="group" aria-label="${label}">${svg}<span class="bk-sr" role="status" aria-live="polite" data-status></span></div>
    <div class="bk-chips" aria-live="off"></div>
    ${extras}
    <p class="bk-idea">${idea}</p>
    <details class="bk-sources"><summary>Where the numbers come from</summary><ul>${sourceList}</ul></details>
  </section>
</div>
</main>${CURSOR}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${FONTS}<style>${ISO_CSS}${BOOK_CSS}${css}</style></head><body class="iso book" data-theme="light">${body}<script type="module">${(STEPPER + "\n" + script).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
}
