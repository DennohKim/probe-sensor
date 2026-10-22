import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../vendor/anatomy/kit/iso-kit.mjs";
import * as G from "../../vendor/anatomy/kit/lathe.mjs";
import { kitScript } from "../../vendor/anatomy/scripts/inline-kit.mjs";
import { bookPage, stripExports } from "../../shared/page.mjs";
import * as F1 from "../01-reading-the-meter/model.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const source = (file) => stripExports(readFileSync(join(HERE, file), "utf8").replace(/^import .*$/gm, ""));
const MODEL_SRC = source("../01-reading-the-meter/model.mjs") + "\n" + source("model.mjs");

// World in millimetres: x along the tapes, y toward the front, z up. The bench top is z = 0.
const PLATE = { x: -268, y: -104, w: 536, d: 212, r: 10 };
const PLATE_H = 9;
const FOOT_H = 6;
const DECK_H = 56;
const PHONE = { x: -256, y: -82, w: 102, d: 158, r: 8 };
const METER = { x: 154, y: -82, w: 102, d: 158, r: 8 };
const BED = { x: -154, y: -56, w: 308, d: 112, r: 1.5 };
const BED_H = 30;
const TAPE_Z = BED_H + 0.3;
const LANE = { rx: -26, tx: 26 };
const TAPE = { half: 15, pitch: 6, track: 3.8, feed: 10.6, hole: 2.1, feedHole: 0.95, print: -3.6, font: 11.4, small: 6.8 };
const LEAD = 40;
// The sensor heads hang 18 to 25 mm above the tape: from there they and their arm only hide bed, never tape.
const HEAD = { r: 4.6, z0: 48, z1: 55.3 };
const POST = { x: -34, y: -72, r: 3, top: 57.3 };
const ARM = { r: 2, z: 57.3 };
const LEVER = { y0: 22, travel: 30, phoneX: -167, meterX: 167 };
const WATCH = { x: -84, y: 80, r: 19, h: 6, dial: 4 };
const SCREEN = { x: -249, y: -74, w: 74, d: 64, r: 5 };
const LCD = { x: 182, y: -68, w: 60, d: 26, r: 3 };

const AZIMUTH = 66;
const ELEVATION = 34;
const WIDTH = 640;
const PAD = 14;
const HEADROOM = 26;
const FIT = [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(PHONE, 0, 72), ...k.boxCorners(METER, 0, 72)];
const probe = k.fitProjection(FIT, WIDTH, 4000, { pad: PAD, azimuth: AZIMUTH, elevation: ELEVATION });
const HEIGHT = Math.ceil((() => {
  const ys = FIT.map((p) => k.iso(p, probe)[1]);
  return Math.max(...ys) - Math.min(...ys) + PAD * 2 + HEADROOM;
})());
const P = k.fitProjection(FIT, WIDTH, HEIGHT, { pad: PAD, headroom: HEADROOM, azimuth: AZIMUTH, elevation: ELEVATION });

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const C = (name, svg) => `<g class="c-${name}">${svg}</g>`;
const f = (n) => +n.toFixed(2);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const top = (x, y, z) => k.topMatrix([x, y], z, P, "x");
const front = (x, y, z) => k.sideMatrix([x, y], z, P, "left");
const side = (x, y, z) => k.sideMatrix([x, y], z, P, "right");
const disc = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`;
const rect = (x0, y0, x1, y1) => `M${f(x0)} ${f(y0)}H${f(x1)}V${f(y1)}H${f(x0)}Z`;
const LABEL = { "\r": "CR", "\n": "LF", "\x02": "STX", "\x03": "ETX", "\x06": "ACK" };

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) out.push(C("wood", S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, P, 28), { tone: "hi" })));
  out.push(C("wood", S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "hi" })));
  const grain = [-70, -24, 24, 70].map((y) => k.lineOnTop([PLATE.x + 6, y], [PLATE.x + PLATE.w - 6, y], 0, P)).join("");
  out.push(L(grain, { tone: "faint", free: true }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.6, tone: "mid" }));
  return out.join("");
}

function screws(plan, z, inset) {
  const points = k.corners(plan, inset);
  return L(points.map(([x, y]) => k.ring(x, y, 1.8, z, P, 14)).join(""), { tone: "lo" }) + D(points.map(([x, y]) => at([x, y, z])), { size: 0.5, tone: "hi" });
}

function labelPlate(plan, z) {
  const out = [C("cap", S(k.slabOf(plan, z, 0.6, P, 3), { tone: "hi", crease: "none" }))];
  const rows = [plan.w * 0.7, plan.w * 0.5, plan.w * 0.6].map((w, i) => k.lineOnTop([plan.x + 3, plan.y + 4 + i * 3.6], [plan.x + 3 + w, plan.y + 4 + i * 3.6], z + 0.6, P)).join("");
  out.push(L(rows, { tone: "lo", free: true }));
  return out.join("");
}

function lever(name, x) {
  const slot = { x: x - 3, y: LEVER.y0 - 6, w: 6, d: LEVER.travel + 12, r: 3 };
  const out = [`<path class="lv-slot" d="${k.planOutline(slot, DECK_H, P, 4)}"/>`, L(k.planOutline(slot, DECK_H, P, 4), { tone: "hi" })];
  const ticks = [LEVER.y0, LEVER.y0 + LEVER.travel].map((y) => k.lineOnTop([x + (name === "phone" ? -6 : 6), y], [x + (name === "phone" ? -3 : 3), y], DECK_H, P)).join("");
  out.push(L(ticks, { tone: "mid" }));
  const anchor = name === "phone" ? "end" : "start";
  const tx = name === "phone" ? x - 8 : x + 8;
  out.push(`<g transform="${top(tx, LEVER.y0 + 2, DECK_H)}"><text class="lv-label" font-size="5.6" text-anchor="${anchor}">300</text></g>`);
  out.push(`<g transform="${top(tx, LEVER.y0 + LEVER.travel + 2, DECK_H)}"><text class="lv-label" font-size="5.6" text-anchor="${anchor}">9600</text></g>`);
  const knob = [
    C("chrome", S(k.cylinder(x, LEVER.y0, 2.6, DECK_H, 1.4, P, 20), { tone: "hi" })),
    C("chrome", S(k.cylinder(x, LEVER.y0, 1.3, DECK_H + 1.4, 7, P, 16), { tone: "hi" })),
    C("red", S(G.sphereOf([x, LEVER.y0, DECK_H + 11.6], 3.8, P), { tone: "hi" })),
  ];
  out.push(`<g data-part="lever-${name}">${knob.join("")}</g>`);
  return out.join("");
}

function tapeSlot(laneY) {
  const out = [];
  const u0 = PHONE.y + PHONE.d - (laneY + TAPE.half + 1.5), u1 = PHONE.y + PHONE.d - (laneY - TAPE.half - 1.5);
  const v0 = DECK_H - (TAPE_Z + 2.4), v1 = DECK_H - (TAPE_Z - 0.3);
  out.push(`<g transform="${side(PHONE.x + PHONE.w, PHONE.y + PHONE.d, DECK_H)}"><path class="dk-slot" d="${rect(u0, v0, u1, v1)}"/></g>`);
  return out.join("");
}

function phoneDeck() {
  const z = DECK_H;
  const out = [`<path class="iso-halo" d="${k.haloOf(PHONE, 0, 4, P)}"/>`];
  out.push(C("phone", S(k.slabOf(PHONE, 0, z, P, 8, 1.2), { tone: "hi", inner: L(k.sideSeam(PHONE, 6, P, 8), { tone: "faint" }) })));
  out.push(`<path class="pb-screen" d="${k.planOutline(SCREEN, z, P, 6)}"/>`);
  out.push(L(k.planOutline(SCREEN, z, P, 6), { tone: "hi" }));
  const rows = Array.from({ length: 8 }, (_, i) => `<text class="pb-term" data-row="${i}" x="0" y="${f(i * 7.15)}" font-size="4.15"></text>`).join("");
  out.push(`<g transform="${top(0, 0, z)}"><clipPath id="pb-screen-clip"><path d="${k.pathOf(k.roundedPlan(k.insetPlan(SCREEN, 1.2), 5), true)}"/></clipPath><g clip-path="url(#pb-screen-clip)"><g transform="translate(${SCREEN.x + 3.6} ${SCREEN.y + 8.2})" data-part="screen">${rows}</g></g></g>`);
  out.push(labelPlate({ x: PHONE.x + 10, y: 20, w: 40, d: 15, r: 1.4 }, z));
  out.push(screws(PHONE, z, 5.5));
  out.push(lever("phone", LEVER.phoneX));
  out.push(tapeSlot(LANE.tx) + tapeSlot(LANE.rx));
  out.push(frontPanel());
  return out.join("");
}

// The phone's checker, on its front face: seven XOR wheels with a match lamp, and a parity counter with a flag.
function frontPanel() {
  const parts = [];
  const cell = (u, v, w, h) => `<path class="fp-cell" d="${rect(u, v, u + w, v + h)}"/>`;
  parts.push(`<path class="fp-panel" d="${k.pathOf(k.roundedPlan({ x: 10, y: 8, w: 82, d: 40, r: 3 }, 4), true)}"/>`);
  parts.push(`<path class="fp-window" d="${rect(13, 12, 76, 27)}"/>`);
  for (let b = 0; b < 7; b++) {
    const u = 14.75 + b * 8.75;
    parts.push(`<clipPath id="fp-w${b}"><path d="${rect(u, 13.5, u + 7.75, 25.5)}"/></clipPath>`);
    parts.push(cell(u, 13.5, 7.75, 12));
    parts.push(`<g clip-path="url(#fp-w${b})"><g data-wheel="${6 - b}"><text class="fp-digit" x="${f(u + 3.9)}" y="23.2" font-size="9.4" text-anchor="middle">0</text><text class="fp-digit" x="${f(u + 3.9)}" y="35.2" font-size="9.4" text-anchor="middle">0</text></g></g>`);
  }
  parts.push(`<path class="fp-bezel" d="${disc(84, 19.5, 5)}"/><path class="fp-lamp" data-part="match" d="${disc(84, 19.5, 3.4)}"/>`);
  parts.push(`<path class="fp-window" d="${rect(13, 31.5, 33, 45)}"/>`);
  parts.push(cell(15, 33, 7.8, 10.5) + cell(23.2, 33, 7.8, 10.5));
  parts.push(`<text class="fp-digit" data-part="tally" x="23.1" y="41.4" font-size="8.6" text-anchor="middle" letter-spacing="1.5">00</text>`);
  parts.push(`<path class="fp-window" d="${rect(37, 31.5, 53, 45)}"/><path class="fp-flag" data-part="flag" d="${rect(38.5, 33, 51.5, 43.5)}"/>`);
  parts.push(`<text class="fp-mark" data-part="flag-mark" x="45" y="41.6" font-size="8.6" text-anchor="middle"></text>`);
  parts.push(`<path class="fp-screw" d="${disc(12.6, 10.6, 0.7)}${disc(89.4, 10.6, 0.7)}${disc(12.6, 45.4, 0.7)}${disc(89.4, 45.4, 0.7)}"/>`);
  const vents = [0, 1, 2].map((i) => k.pathOf(k.roundedPlan({ x: 62 + i * 9, y: 33, w: 3, d: 11, r: 1.5 }, 3), true)).join("");
  parts.push(`<path class="fp-vent" d="${vents}"/>`);
  return `<g transform="${front(PHONE.x, PHONE.y + PHONE.d, DECK_H)}" class="fp">${parts.join("")}</g>`;
}

function meterDeck() {
  const z = DECK_H;
  const out = [`<path class="iso-halo" d="${k.haloOf(METER, 0, 4, P)}"/>`];
  out.push(C("meter", S(k.slabOf(METER, 0, z, P, 8, 1.2), { tone: "hi", inner: L(k.sideSeam(METER, 6, P, 8), { tone: "faint" }) })));
  out.push(`<path class="pb-lcd" d="${k.planOutline(LCD, z, P, 4)}"/>`);
  out.push(L(k.planOutline(LCD, z, P, 4), { tone: "hi" }) + L(k.planOutline(k.insetPlan(LCD, 1.6), z, P, 4), { tone: "faint" }));
  out.push(`<g transform="${top(LCD.x + 4.2, LCD.y + 18.6, z)}"><text class="pb-lcd-digits" font-size="9.4">${F1.METER.totalM3.toFixed(3)}</text><text class="pb-lcd-unit" x="46.5" y="-0.3" font-size="4.6">m³</text></g>`);
  out.push(labelPlate({ x: METER.x + 40, y: 18, w: 54, d: 15, r: 1.4 }, z));
  out.push(screws(METER, z, 5.5));
  out.push(lever("meter", LEVER.meterX));
  const grille = Array.from({ length: 6 }, (_, i) => k.pathOf(k.roundedPlan({ x: 44 + i * 8.4, y: 14, w: 3.4, d: 26, r: 1.7 }, 3), true)).join("");
  const port = `<path class="mp-ring" d="${disc(22, 26, 9)}"/><path class="pb-window" d="${disc(22, 26, 5.6)}"/><path class="mp-dot" d="${disc(19.6, 26, 1.1)}${disc(24.4, 26, 1.1)}"/>`;
  out.push(`<g transform="${front(METER.x, METER.y + METER.d, DECK_H)}" class="mp"><path class="mp-vent" d="${grille}"/>${port}</g>`);
  return out.join("");
}

function bed() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BED, 0, 3, P)}"/>`];
  out.push(C("chrome", S(k.slabOf(BED, 0, BED_H, P, 3, 0.8), { tone: "hi", inner: L(k.sideSeam(BED, BED_H - 5, P, 3), { tone: "faint" }) })));
  for (const y of [LANE.rx, LANE.tx]) {
    const channel = [[BED.x, y - TAPE.half - 2.4], [BED.x + BED.w, y - TAPE.half - 2.4], [BED.x + BED.w, y + TAPE.half + 2.4], [BED.x, y + TAPE.half + 2.4]];
    out.push(`<path class="tp-channel" d="${k.onTop(channel, BED_H, P, true)}"/>`);
  }
  const plate = { x: -9, y: BED.y + 3, w: 18, d: BED.d - 6, r: 1 };
  out.push(C("brass", S(k.slabOf(plate, BED_H, 0.25, P, 2), { tone: "hi", crease: "none" })));
  out.push(D([[-5.5, BED.y + 6], [5.5, BED.y + 6], [-5.5, BED.y + BED.d - 6], [5.5, BED.y + BED.d - 6]].map(([x, y]) => at([x, y, BED_H + 0.25])), { size: 0.5, tone: "hi" }));
  out.push(screws({ x: BED.x, y: BED.y, w: BED.w, d: BED.d }, BED_H, 4.5));
  const pins = [];
  for (const x of [-118, -62, 62, 118]) for (const y of [LANE.rx - TAPE.half - 2.6, LANE.tx - TAPE.half - 2.6]) pins.push([x, y]);
  for (const [x, y] of byDepth(pins)) out.push(C("chrome", S(k.cylinder(x, y, 1.9, BED_H, 4.6, P, 16), { tone: "hi" })));
  return out.join("");
}

// A sender's tape: every letter it will send, ten spots each, start bit first. A hole (light through) is 0.
function tape(dir, copy = "") {
  const text = M.TAPE[dir];
  const sign = dir === "tx" ? -1 : 1;
  const u = (k) => sign * (k + 0.5) * TAPE.pitch;
  const n = text.length * 10;
  const [a, b] = [u(-LEAD), u(n + LEAD)].sort((x, y) => x - y);
  const holes = [], feed = [], seps = [], letters = [], marks = [];
  for (let kk = -LEAD; kk < n + LEAD; kk++) feed.push(disc(u(kk), TAPE.feed, TAPE.feedHole));
  [...text].forEach((ch, j) => {
    F1.frameOf(ch.charCodeAt(0)).forEach((bit, pos) => { if (bit === 0) holes.push(disc(u(10 * j + pos), TAPE.track, TAPE.hole)); });
    const edge = sign * 10 * j * TAPE.pitch;
    seps.push(`M${f(edge)} ${-TAPE.half}V-1.4`);
    const mid = sign * (10 * j + 5) * TAPE.pitch;
    const label = LABEL[ch];
    letters.push(`<text x="${f(mid)}" y="${TAPE.print}" font-size="${label ? TAPE.small : TAPE.font}" text-anchor="middle">${(label ?? ch).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
    if (dir === "rx" && j >= F1.IDENT.length) marks.push(`<text class="tp-check" data-check="${j - F1.IDENT.length}" x="${f(mid + (label ? 13 : 11))}" y="${TAPE.print}" font-size="8" style="opacity:0">✓</text>`);
  });
  if (seps.length) seps.push(`M${f(sign * n * TAPE.pitch)} ${-TAPE.half}V-1.4`);
  const wrong = dir === "rx" ? `<g data-part="wrong" style="display:none"><path class="tp-hole" d="${disc(u(10 * M.BREAK_AT + 1 + M.BREAK.bit), TAPE.track, TAPE.hole)}"/><path class="tp-wrong" d="${disc(u(10 * M.BREAK_AT + 1 + M.BREAK.bit), TAPE.track, TAPE.hole + 1.3)}"/></g>` : "";
  const moving = `<g data-part="tape-${dir}"><path class="tp-paper tp-${dir}" d="${rect(a, -TAPE.half, b, TAPE.half)}"/><path class="tp-sep" data-free d="${seps.join("")}"/><path class="tp-hole" d="${holes.join("")}"/><path class="tp-hole" d="${feed.join("")}"/>${wrong}<g class="tp-text">${letters.join("")}</g>${marks.join("")}</g>`;
  const x0 = BED.x, x1 = BED.x + BED.w;
  const filter = `<filter id="tp-blur-${dir}${copy}" data-blur-filter="${dir}" filterUnits="userSpaceOnUse" x="${x0 - 20}" y="${-TAPE.half - 4}" width="${x1 - x0 + 40}" height="${2 * TAPE.half + 8}"><feGaussianBlur data-part="blur-${dir}" stdDeviation="0 0"/></filter>`;
  const clip = `<clipPath id="tp-clip-${dir}${copy}"><path d="${rect(x0, -TAPE.half - 1, x1, TAPE.half + 1)}"/></clipPath>`;
  const edges = `<path class="tp-edge" d="M${x0} ${-TAPE.half}H${x1}M${x0} ${TAPE.half}H${x1}"/>`;
  const spot = `<g data-part="spot-${dir}" style="opacity:0"><circle class="gt-halo" cx="0" cy="${TAPE.track}" r="5.4"/><circle class="gt-spot" cx="0" cy="${TAPE.track}" r="${TAPE.hole}"/></g>`;
  return `<g transform="${top(0, LANE[dir], TAPE_Z)}">${filter}${clip}<g clip-path="url(#tp-clip-${dir}${copy})"><g data-part="blurred-${dir}" data-filter="url(#tp-blur-${dir}${copy})">${moving}</g></g>${edges}${spot}</g>`;
}

function beam(dir) {
  const z0 = TAPE_Z, z1 = HEAD.z0;
  return `<g transform="${front(0, LANE[dir] + TAPE.track + 0.05, 0)}"><g data-part="beam-${dir}" style="opacity:0"><ellipse class="gt-glow" cx="0" cy="${f(-(z0 + z1) / 2)}" rx="4.6" ry="${f((z1 - z0) / 2 + 2.6)}"/><path class="gt-beam" d="${rect(-1.2, -z1, 1.2, -z0)}"/></g></g>`;
}

function postBack() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: POST.x - 10, y: POST.y - 10, w: 20, d: 20, r: 10 }, 0, 3, P)}"/>`];
  out.push(C("chrome", S(k.cylinder(POST.x, POST.y, 10, 0, 3.2, P, 48, 0.6), { tone: "hi", inner: L(k.sideArc(POST.x, POST.y, 10, 1.2, P, 40), { tone: "faint" }) })));
  out.push(L(k.ring(POST.x, POST.y, 6.5, 3.2, P, 36), { tone: "faint" }));
  out.push(C("chrome", S(k.cylinder(POST.x, POST.y, POST.r, 3.2, POST.top - 3.2, P, 24), { tone: "hi", inner: L(k.sideArc(POST.x, POST.y, POST.r, 20, P, 16), { tone: "faint" }) })));
  out.push(C("chrome", S(k.cylinder(POST.x, POST.y, 4.6, 36, 5, P, 28, 0.3), { tone: "hi" })));
  out.push(C("chrome", S(k.slabOf({ x: POST.x - 1.2, y: POST.y - 7.6, w: 2.4, d: 3, r: 0.4 }, 37.3, 2.4, P, 2), { tone: "hi" })));
  out.push(C("black", S(G.disc(7.6, 10.6, 1.6, G.frameAlong([POST.x, POST.y, 38.5], [0, -1, 0]), P), { tone: "hi" })));
  return out.join("");
}

function head(dir) {
  const y = LANE[dir] + TAPE.track;
  const colour = dir === "tx" ? "meter" : "phone";
  const out = [C(colour, S(k.cylinder(0, y, HEAD.r, HEAD.z0, HEAD.z1 - HEAD.z0, P, 32, 0.4), { tone: "hi", inner: L(k.sideArc(0, y, HEAD.r, HEAD.z0 + 2.4, P, 24), { tone: "faint" }) }))];
  out.push(C("chrome", S(k.cylinder(0, y, 3.2, HEAD.z0 - 1.4, 1.4, P, 24), { tone: "hi" })));
  const [cosA, sinA] = k.towardViewer(P);
  const eye = at([HEAD.r * cosA * 0.98, y + HEAD.r * sinA * 0.98, (HEAD.z0 + HEAD.z1) / 2 + 1]);
  out.push(`<ellipse class="gt-eye" data-part="eye-${dir}" cx="${f(eye[0])}" cy="${f(eye[1])}" rx="1.25" ry="1.5"/>`);
  return out.join("");
}

// An L-shaped arm: along the bed from the post, then a short bracket across to each head.
function bracket(dir) {
  const y = LANE[dir] + TAPE.track;
  const out = [C("chrome", S(G.disc(0, -POST.x - HEAD.r * 0.5, ARM.r * 0.9, G.frameAlong([POST.x, y, ARM.z], [1, 0, 0]), P), { tone: "hi" }))];
  out.push(C("chrome", S(G.sphereOf([POST.x, y, ARM.z], 3.2, P), { tone: "hi" })));
  return out.join("");
}
function armBack() {
  const F = G.frameAlong([POST.x, POST.y, ARM.z], [0, 1, 0]);
  return C("chrome", S(G.disc(0, LANE.rx + TAPE.track - POST.y, ARM.r, F, P), { tone: "hi" })) + C("chrome", S(G.sphereOf([POST.x, POST.y, POST.top], 3.9, P), { tone: "hi" }));
}
function armFront() {
  const F = G.frameAlong([POST.x, LANE.rx + TAPE.track, ARM.z], [0, 1, 0]);
  return C("chrome", S(G.disc(0, LANE.tx - LANE.rx, ARM.r, F, P), { tone: "hi" }));
}

function watch() {
  const { x, y, r, h } = WATCH;
  const z = h + 1.4;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - r, y: y - r, w: 2 * r, d: 2 * r, r }, 0, 3, P)}"/>`];
  const crown = G.frameAlong([x, y, h / 2], [0, -1, 0]);
  out.push(C("chrome", S(G.disc(r - 0.5, r + 3.4, 1.5, crown, P), { tone: "hi" })));
  out.push(C("chrome", S(G.disc(r + 3.4, r + 7.4, 3, crown, P), { tone: "hi", inner: L(G.ribsOf(crown, r + 3.4, r + 7.4, 3, 18, P), { tone: "lo" }) })));
  out.push(C("chrome", S(k.cylinder(x, y, r, 0, h, P, 72, 0.6), { tone: "hi", inner: L(k.sideArc(x, y, r, 2, P, 48), { tone: "faint" }) })));
  out.push(C("chrome", S(k.cylinder(x, y, r - 0.4, h, 1.4, P, 72, 0.3), { tone: "hi" })));
  out.push(`<path class="sw-face" d="${k.ring(x, y, r - 2.2, z, P, 72)}"/>`);
  out.push(L(k.ring(x, y, r - 2.2, z, P, 72), { tone: "hi" }));
  const ticks = k.radialTicks(x, y, r - 2.4, WATCH.dial * 10, 5, z, [1.3, 2.7], P);
  out.push(L(ticks.minor, { tone: "lo" }) + L(ticks.major, { tone: "hi" }));
  for (let s = 0; s < WATCH.dial; s++) {
    const a = (s / WATCH.dial) * Math.PI * 2;
    out.push(`<g transform="${top(x + Math.sin(a) * (r - 7.8), y - Math.cos(a) * (r - 7.8) + 1.6, z)}"><text class="sw-num" font-size="4.6" text-anchor="middle">${s}</text></g>`);
  }
  out.push(`<g data-part="watch-mark" style="opacity:0"><path class="sw-mark"/></g>`);
  out.push(`<path class="sw-hand" data-part="watch-hand"/>`);
  out.push(D([at([x, y, z])], { size: 0.9, tone: "hi" }));
  return out.join("");
}


// A desk magnifier hangs in front of the light gate, on the line of sight, so its lens shows the gate 2.5 times larger.
const SCALE = G.scaleOf(P);
const VIEW = G.viewOf(P);
const RIGHT = (() => {
  const a = (P.azimuth * Math.PI) / 180;
  const u = [Math.sin(a), -Math.cos(a), 0];
  return k.iso(u, P)[0] > k.iso([0, 0, 0], P)[0] ? u : [-u[0], -u[1], 0];
})();
const JOINT = [0, (LANE.rx + LANE.tx) / 2 + TAPE.track, TAPE_Z + 12.5];
const LENS = { mag: 2.3, r: 62, rim: 6, out: 70 };
LENS.at = G.add3(JOINT, G.mul3(VIEW, LENS.out));
LENS.rWorld = (LENS.r + LENS.rim) / SCALE;
const ARM_ROOT = G.add3(LENS.at, G.mul3(RIGHT, LENS.rWorld));
const STAND = { x: 116, y: -84, r: 2.8, top: ARM_ROOT[2] };

function magnifierStand() {
  const base = { x: STAND.x - 13, y: STAND.y - 13, w: 26, d: 26, r: 13 };
  const out = [`<path class="iso-halo" d="${k.haloOf(base, 0, 3, P)}"/>`];
  out.push(C("red", S(k.cylinder(STAND.x, STAND.y, 13, 0, 5, P, 56, 0.7), { tone: "hi", inner: L(k.sideArc(STAND.x, STAND.y, 13, 1.8, P, 40), { tone: "faint" }) })));
  out.push(L(k.ring(STAND.x, STAND.y, 8.4, 5, P, 36), { tone: "faint" }));
  out.push(C("chrome", S(k.cylinder(STAND.x, STAND.y, 4.6, 5, 3.4, P, 24, 0.4), { tone: "hi" })));
  out.push(C("chrome", S(k.cylinder(STAND.x, STAND.y, STAND.r, 8.4, STAND.top - 8.4, P, 20), { tone: "hi", inner: L(k.sideArc(STAND.x, STAND.y, STAND.r, STAND.top - 16, P, 16), { tone: "faint" }) })));
  return out.join("");
}

function magnifier(content) {
  const [cx, cy] = at(JOINT);
  const r = LENS.r, rim = LENS.rim;
  const out = [];
  const reach = G.sub3([STAND.x, STAND.y, STAND.top], ARM_ROOT);
  const len = Math.hypot(...reach);
  out.push(C("chrome", S(G.disc(-1, len, 2, G.frameAlong(ARM_ROOT, G.mul3(reach, 1 / len)), P), { tone: "hi" })));
  out.push(C("chrome", S(G.sphereOf([STAND.x, STAND.y, STAND.top], 4.2, P), { tone: "hi" })));
  out.push(`<clipPath id="lens-clip"><circle cx="${f(cx)}" cy="${f(cy)}" r="${r}"/></clipPath>`);
  out.push(`<g clip-path="url(#lens-clip)"><circle class="pb-lens-bg" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/>`);
  out.push(`<g transform="translate(${f(cx)} ${f(cy)}) scale(${LENS.mag}) translate(${f(-cx)} ${f(-cy)})">${content}</g>`);
  out.push(`<circle class="pb-glass" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/>`);
  const a0 = (200 * Math.PI) / 180, a1 = (256 * Math.PI) / 180, ri = r * 0.82, ro = r * 0.9;
  const pt = (rr, a) => `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  out.push(`<path class="pb-shine" d="M${pt(ro, a0)}A${ro} ${ro} 0 0 1 ${pt(ro, a1)}L${pt(ri, a1)}A${ri} ${ri} 0 0 0 ${pt(ri, a0)}Z"/></g>`);
  out.push(`<circle class="pb-rim" cx="${f(cx)}" cy="${f(cy)}" r="${r + rim / 2}" stroke-width="${rim}"/>`);
  out.push(`<circle class="pb-rim-line" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/><circle class="pb-rim-line" cx="${f(cx)}" cy="${f(cy)}" r="${r + rim}"/>`);
  return `<g class="pb-lens">${out.join("")}</g>`;
}

const LENS_AT = at(JOINT);
const SOUNDS = {
  gate: [LENS_AT[0] + 8, LENS_AT[1] - LENS.r - LENS.rim - 9],
  phoneLever: at([LEVER.phoneX - 6, LEVER.y0 + 30, DECK_H + 26]),
  meterLever: at([LEVER.meterX + 18, LEVER.y0 + 30, DECK_H + 26]),
  race: at([86, LANE.rx - 6, BED_H + 32]),
  check: at([PHONE.x + 34, PHONE.y + PHONE.d + 44, -6]),
  ding: at([PHONE.x + PHONE.w + 30, PHONE.y + PHONE.d + 30, 14]),
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench with two tape machines facing each other: the phone on the left and the water meter on the right. Each one's paper tape, punched with the letters it will send, runs across a steel bed through a light gate in the middle, where light shines up through the holes into a sensor head. A speed lever on each machine, a stopwatch on the bench and a checker with seven XOR wheels on the phone complete it.",
  body: [
    bench(),
    postBack(),
    magnifierStand(),
    phoneDeck(),
    bed(),
    tape("rx"),
    tape("tx"),
    beam("rx"),
    beam("tx"),
    armBack(),
    head("rx"),
    bracket("rx"),
    armFront(),
    head("tx"),
    bracket("tx"),
    watch(),
    meterDeck(),
    magnifier(bed() + tape("rx", "-lens") + tape("tx", "-lens") + beam("rx") + beam("tx") + armBack() + head("rx") + bracket("rx") + armFront() + head("tx") + bracket("tx")),
  ],
});

const STEPS = [
  { label: "Wake the meter “/?!”", hint: "The phone's tape runs past the lamp: / ? ! and two line ends. Each letter is ten spots. A hole lets light through (0); paper blocks it (1).", dur: 6.0, sound: { word: "tick tick tick", at: SOUNDS.gate, from: 0.05, to: 0.92 } },
  { label: "Meter names itself", hint: "The meter waits 0.2 s, then sends its name. The 5 in it means “I can also go 9600 bits a second, 32 times faster.”", dur: 6.6, sound: { word: "tick tick tick", at: SOUNDS.gate, from: 0.27, to: 0.95 } },
  { label: "Pick the speed", hint: "The phone answers with six letters, ACK 0 5 0: “OK, read me everything, at speed 5.”", dur: 3.6, sound: { word: "tick tick", at: SOUNDS.gate, from: 0.08, to: 0.9 } },
  { label: "Switch gears", hint: "While the meter waits 0.2 s, both sides push their lever from 300 to 9600. If only one switched, every letter would come out wrong.", dur: 3.2, sound: [{ word: "clunk!", at: SOUNDS.phoneLever, from: 0.4, to: 0.8 }, { word: "clunk!", at: SOUNDS.meterLever, from: 0.6, to: 0.97 }] },
  { label: "Read the data", hint: `Now the meter's tape races 32 times faster: ${F1.READOUT.length} letters in ${M.READ_FAST.toFixed(3)} s. At the old speed the same tape would take ${M.READ_SLOW.toFixed(2)} s.`, dur: 4.2, sound: { word: "brrrrrrt!", at: SOUNDS.race, from: 0.04, to: 0.96 } },
  { label: "Check every letter's parity", hint: "", dur: 3.0, sound: { word: "tap tap tap", at: SOUNDS.check, from: 0.05, to: 0.85 } },
  { label: "Check the BCC", hint: "", dur: 2.7, sound: { word: "ding!", at: SOUNDS.ding, from: 0.84, to: 0.99 } },
].map((step, i) => ({ ...step, real: M.realOf(M.PHASES[i]) }));

const GOOD = M.checks(false), BAD = M.checks(true);
const HINTS = {
  parity: {
    ok: `In every letter the phone counts the dark spots in the 7 letter bits and the parity bit. The count is always even, so all ${F1.READOUT.length} letters pass.`,
    broken: `One letter came in with an extra hole: its dark spots add up to an odd number, so the phone throws that letter out. ${F1.READOUT.length - BAD.bad.length} of ${F1.READOUT.length} pass.`,
  },
  bcc: {
    ok: `The phone XORs every letter after STX up to ETX into seven wheels. They stop at ${M.binary7(GOOD.sum)}, the meter's last letter “${String.fromCharCode(GOOD.got)}”. It matches: nothing got lost.`,
    broken: `The seven XOR wheels stop at ${M.binary7(BAD.sum)}, but the meter's last letter says ${M.binary7(BAD.got)}. No match: the phone throws the reading away and asks again.`,
  },
  outro: {
    ok: `Done! ${M.TAPE.tx.length + M.TAPE.rx.length} letters, every one ten flashes long, and the phone has the meter's reading: ${F1.METER.totalM3.toFixed(3)} m³.`,
    broken: "Caught! One wrong hole failed its parity count and broke the checksum, so this reading is not trusted.",
  },
};

const live = `
${MODEL_SRC}
const P = ${JSON.stringify(P)};
const STEPS = ${JSON.stringify(STEPS)};
const HINTS = ${JSON.stringify(HINTS)};
const PITCH = ${TAPE.pitch}, LEVER_TRAVEL = ${LEVER.travel};
const WATCH = ${JSON.stringify(WATCH)}, WATCH_Z = ${WATCH.h + 1.4};
const svg = document.querySelector(".bk-card svg");
const all = (name) => [...svg.querySelectorAll('[data-part="' + name + '"]')];
const one = (name) => svg.querySelector('[data-part="' + name + '"]');
const both = (name) => ({ tx: all(name + "-tx"), rx: all(name + "-rx") });
const tapes = both("tape"), blurs = both("blur"), blurred = both("blurred"), spots = both("spot"), beams = both("beam"), eyes = both("eye");
const wrongEls = all("wrong");
const each = (els, fn) => els.forEach(fn);
const levers = { phone: one("lever-phone"), meter: one("lever-meter") };
const rows = [...svg.querySelectorAll('[data-part="screen"] text')];
const screenEl = svg.querySelector(".pb-screen");
const wheels = Array.from({ length: 7 }, (_, b) => svg.querySelector('[data-wheel="' + b + '"]'));
const matchEl = one("match"), tallyEl = one("tally"), flagEl = one("flag"), flagMark = one("flag-mark");
const handEl = one("watch-hand"), markEl = one("watch-mark");
const marks = [...svg.querySelectorAll("[data-check]")];
const scope = document.querySelector("[data-scope]");
let broken = false;
let CHECK = checks(false);

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.min(1, Math.max(0, t));
const ease = (p, a, b) => smooth(clamp((p - a) / (b - a)));
const realOfStep = (i) => STEPS[i] ? STEPS[i].real : null;

function realSoFar(i, p) {
  let s = 0;
  for (let j = 0; j <= i; j++) if (realOfStep(j)) s += (j < i ? 1 : Math.min(1, p)) * realOfStep(j);
  return s;
}
const READ_START = PHASES.slice(0, 4).reduce((s, ph) => s + realOf(ph), 0);

// Share of the last frame each gate spent lit, so 9600-baud bits blur into a glow instead of flickering.
function gateGlow(i, p) {
  const phase = PHASES[i];
  const glow = { tx: 0, rx: 0 };
  if (!phase || !phase.talk || p >= 1) return { glow, line: null };
  const span = phase.to - phase.from;
  const r = phase.from + p * span;
  const dr = span / STEPS[i].dur / 60;
  const n = 16;
  for (let j = 0; j < n; j++) {
    const g = gateAt(phase.talk, Math.max(phase.from, r - dr) + ((j + 0.5) / n) * dr, broken);
    if (g && g.lit) glow[g.dir] += 1 / n;
  }
  return { glow, line: gateAt(phase.talk, r, broken) };
}

const HEADER = (baud) => "OptoRead  " + baud + " 7E1";
function screen(i, p) {
  const lines = ["", "", "", "", "", "", "", ""];
  screenEl.toggleAttribute("data-on", i >= 0);
  if (i < 0) return lines;
  const fast = i > 3 || (i === 3 && p >= 0.5);
  lines[0] = HEADER(fast ? FAST_BAUD : LINK.startBaud);
  const tx = Math.floor(bitsAt("tx", i, p) / 10), rx = Math.floor(bitsAt("rx", i, p) / 10);
  lines[1] = "> " + show(SIGN_ON.slice(0, tx));
  if (i >= 1) lines[2] = "< " + show(IDENT.slice(0, Math.max(0, rx)));
  if (i >= 2) lines[3] = "> " + show(OPTION.slice(0, Math.max(0, tx - SIGN_ON.length))) + (fast ? "  now " + FAST_BAUD : "");
  if (i >= 4) {
    const got = READOUT.slice(1, Math.max(1, rx - IDENT.length)).split("\\r\\n");
    for (let r = 0; r < 3; r++) if (got[r] !== undefined) lines[4 + r] = "< " + show(got[r]);
  }
  if (i === 5) lines[7] = "parity " + String(passed(p)).padStart(2, "0") + "/64" + (CHECK.bad.length && checkedOf(p) > CHECK.bad[0] ? " 1 bad ✗" : " ✓");
  if (i >= 6) {
    const ok = 64 - CHECK.bad.length;
    lines[7] = ok + "/64" + (ok === 64 ? " ✓" : " ✗") + (i === 6 && p < 0.85 ? "" : "  BCC " + hex(CHECK.sum) + (CHECK.match ? " ✓" : "≠" + hex(CHECK.got)));
  }
  return lines;
}

const checkedOf = (p) => Math.min(READOUT.length, Math.floor(clamp(p / 0.85) * READOUT.length + 1e-9));
const passed = (p) => { const n = checkedOf(p); return n - CHECK.bad.filter((b) => b < n).length; };

function wheelsAt(i, p) {
  const last = CHECK.xors.length - 1;
  if (i < 6) return { value: 0, next: 0, frac: 0, n: 0 };
  if (i > 6) return { value: CHECK.sum, next: CHECK.sum, frac: 0, n: last };
  const q = clamp(p / 0.8) * last;
  const n = Math.min(last, Math.floor(q));
  return { value: CHECK.xors[n], next: CHECK.xors[Math.min(last, n + 1)], frac: n < last ? smooth(q - n) : 0, n };
}

const BITNAMES = ["S", "0", "1", "2", "3", "4", "5", "6", "P", "E"];
function scopeHtml(i, p, line) {
  let bits = null, ch = "—", meta = [], now = -1, verdict = "";
  if (i === 5 || i === 6 || (i > 6)) {
    const n = i === 5 ? Math.min(READOUT.length - 1, Math.floor(clamp(p / 0.85) * READOUT.length)) : i === 6 ? Math.min(READOUT.length - 1, wheelsAt(i, p).n + 1) : READOUT.length - 1;
    bits = CHECK.letters[n];
    ch = show(String.fromCharCode(dataOf(bits)));
    const dark = onesOf(bits);
    if (i === 5) {
      meta = ["letter " + (n + 1) + " of 64", dark + " dark spots in 0–6 + P"];
      verdict = dark % 2 ? "odd ✗ thrown out" : "even ✓";
    } else {
      const w = wheelsAt(i, p);
      meta = i === 6 && p < 0.85 ? ["XOR of letters 2–" + (w.n + 1), "wheels " + binary7(w.value)] : ["XOR " + binary7(CHECK.sum) + " = " + hex(CHECK.sum), "last letter " + binary7(CHECK.got) + " = " + hex(CHECK.got)];
      verdict = i === 6 && p < 0.85 ? "" : CHECK.match ? "match ✓" : "no match ✗";
    }
  } else if (line) {
    bits = line.bits; now = line.index;
    ch = show(String.fromCharCode(dataOf(bits)));
    const dark = onesOf(bits);
    meta = [hex(dataOf(bits)) + "  " + (line.dir === "tx" ? "phone → meter" : "meter → phone"), line.baud + " baud"];
    verdict = now >= 8 ? (dark % 2 ? "odd ✗" : "even ✓") : "";
  } else if (i >= 0 && i < 5) {
    meta = ["no letter in the gate", "the line rests dark"];
  }
  const W = 300, cell = W / 10;
  let body = '<rect class="sc-tape" x="0" y="6" width="' + W + '" height="34" rx="3"/>';
  BITNAMES.forEach((name, j) => {
    const cx = (j + 0.5) * cell;
    if (j === now) body += '<rect class="sc-now" x="' + j * cell + '" y="6" width="' + cell + '" height="34"/>';
    if (bits && bits[j] === 0) body += '<circle class="sc-hole" cx="' + cx + '" cy="23" r="7.5"/>';
    else body += '<circle class="sc-paper" cx="' + cx + '" cy="23" r="7.5"/>';
    body += '<text x="' + cx + '" y="56">' + name + "</text>";
    if (bits) body += '<text class="sc-bit" x="' + cx + '" y="70">' + bits[j] + "</text>";
  });
  body += '<path class="sc-brace" d="M' + (cell + 2) + ' 44V47H' + (9 * cell - 2) + 'V44"/>';
  return '<svg viewBox="-4 0 ' + (W + 8) + ' 76" class="sc-svg" aria-hidden="true">' + body + "</svg>" +
    '<div class="sc-meta"><b>' + ch + "</b>" + meta.map((m) => "<span>" + m + "</span>").join("") + (verdict ? '<span class="sc-verdict' + (verdict.includes("✗") ? " sc-bad" : "") + '">' + verdict + "</span>" : "") + "</div>";
}

function handPath(angle, len, tail) {
  const c = [WATCH.x, WATCH.y, WATCH_Z];
  const tip = [WATCH.x + Math.sin(angle) * len, WATCH.y - Math.cos(angle) * len, WATCH_Z];
  const back = [WATCH.x - Math.sin(angle) * tail, WATCH.y + Math.cos(angle) * tail, WATCH_Z];
  return pathOf([iso(back, P), iso(tip, P)]);
}
function markPath(angle) {
  const r0 = WATCH.r - 2.6, r1 = WATCH.r - 6.4, w = 0.09;
  const pt = (r, a) => iso([WATCH.x + Math.sin(a) * r, WATCH.y - Math.cos(a) * r, WATCH_Z], P);
  return pathOf([pt(r0, angle - w), pt(r1, angle), pt(r0, angle + w)], true);
}

let lastScope = "";
function pose(i, p) {
  const bits = { tx: bitsAt("tx", i, p), rx: bitsAt("rx", i, p) };
  each(tapes.tx, (el) => el.setAttribute("transform", "translate(" + (bits.tx * PITCH).toFixed(2) + " 0)"));
  each(tapes.rx, (el) => el.setAttribute("transform", "translate(" + (-bits.rx * PITCH).toFixed(2) + " 0)"));
  const speed = speedAt(i, p);
  for (const dir of ["tx", "rx"]) {
    const perFrame = speed[dir] && STEPS[i] ? (speed[dir] * STEPS[i].real / STEPS[i].dur / 60) * PITCH : 0;
    const sigma = perFrame > 8 ? Math.min(9, perFrame * 0.45) : 0;
    each(blurs[dir], (el) => el.setAttribute("stdDeviation", sigma.toFixed(2) + " 0"));
    each(blurred[dir], (el) => { if (sigma) el.setAttribute("filter", el.dataset.filter); else el.removeAttribute("filter"); });
  }

  const { glow, line } = gateGlow(i, p);
  for (const dir of ["tx", "rx"]) {
    each(spots[dir], (el) => { el.style.opacity = glow[dir].toFixed(2); });
    each(beams[dir], (el) => { el.style.opacity = glow[dir].toFixed(2); });
    each(eyes[dir], (el) => el.toggleAttribute("data-lit", glow[dir] > 0.35));
  }

  const gear = { phone: i < 3 ? 0 : i === 3 ? ease(p, 0.12, 0.5) : 1, meter: i < 3 ? 0 : i === 3 ? ease(p, 0.42, 0.82) : 1 };
  levers.phone.setAttribute("transform", translateAlong(P, [0, LEVER_TRAVEL * gear.phone, 0]));
  levers.meter.setAttribute("transform", translateAlong(P, [0, LEVER_TRAVEL * gear.meter, 0]));

  const lines = screen(i, p);
  rows.forEach((row, r) => { if (row.textContent !== lines[r]) row.textContent = lines[r]; });

  const w = wheelsAt(i, p);
  wheels.forEach((g, b) => {
    const from = (w.value >> b) & 1, to = (w.next >> b) & 1;
    const [a, c] = g.children;
    a.textContent = from; c.textContent = to;
    g.setAttribute("transform", from !== to ? "translate(0 " + (-12 * w.frac).toFixed(2) + ")" : "");
    g.toggleAttribute("data-turn", from !== to && w.frac > 0);
  });
  const compared = i > 6 || (i === 6 && p >= 0.85);
  matchEl.setAttribute("data-state", compared ? (CHECK.match ? "ok" : "bad") : "off");

  const n = i < 5 ? 0 : i === 5 ? checkedOf(p) : READOUT.length;
  const pass = i < 5 ? 0 : i === 5 ? passed(p) : 64 - CHECK.bad.length;
  tallyEl.textContent = String(pass).padStart(2, "0");
  const failed = CHECK.bad.some((b) => b < n);
  flagEl.setAttribute("data-state", n === 0 ? "off" : failed ? "bad" : "ok");
  flagMark.textContent = n === 0 ? "" : failed ? "✗" : "✓";
  marks.forEach((m, j) => {
    const on = j < n;
    const bad = CHECK.bad.includes(j);
    m.style.opacity = on ? "1" : "0";
    m.textContent = bad ? "✗" : "✓";
    m.toggleAttribute("data-bad", bad);
  });

  const t = realSoFar(i, p);
  handEl.setAttribute("d", handPath((t / WATCH.dial) * Math.PI * 2, WATCH.r - 4.2, 3));
  markEl.style.opacity = i >= 4 ? "1" : "0";

  const html = scopeHtml(i, p, line);
  if (html !== lastScope) { scope.innerHTML = html; lastScope = html; }
}
markEl.firstChild.setAttribute("d", markPath(((READ_START + READ_SLOW) / WATCH.dial) * Math.PI * 2));

function chips(i, p) {
  const fast = i > 3 || (i === 3 && p >= 0.5);
  const baud = fast ? FAST_BAUD : LINK.startBaud;
  const tx = Math.floor(bitsAt("tx", i, p) / 10 + 1e-9), rx = Math.floor(bitsAt("rx", i, p) / 10 + 1e-9);
  const n = i < 5 ? 0 : i === 5 ? checkedOf(p) : 64;
  const compared = i > 6 || (i === 6 && p >= 0.85);
  return [
    { k: "Speed", v: (i > 3 || (i === 3 && p >= 0.82) ? FAST_BAUD : LINK.startBaud) + " baud", hot: i === 3 },
    { k: "One letter", v: (charSeconds(baud) * 1000).toFixed(fast ? 2 : 1) + " ms" },
    { k: "Phone sent", v: tx + " letters" },
    { k: "Meter sent", v: rx + " letters" },
    { k: "Real time", v: realSoFar(i, p).toFixed(3) + " s" },
    { k: "Readout", v: i >= 4 ? READ_FAST.toFixed(3) + " s, not " + READ_SLOW.toFixed(3) + " s" : "—", hot: i === 4 },
    { k: "Parity", v: n ? (i === 5 ? passed(p) : 64 - CHECK.bad.length) + "/64 even" : "—", hot: i === 5 },
    { k: "Checksum", v: compared ? hex(CHECK.sum) + (CHECK.match ? " ✓" : " ✗") : "—", hot: i === 6 && compared },
  ];
}

const cfg = {
  key: "probe-fig5",
  svg,
  steps: STEPS,
  intro: "Press step 1. Then watch the phone and the meter take turns sending punched tape past the light.",
  outro: HINTS.outro.ok,
  pose,
  chips,
};
function setBroken(on) {
  broken = on;
  CHECK = checks(on);
  const mode = on ? "broken" : "ok";
  STEPS[5].hint = HINTS.parity[mode];
  STEPS[6].hint = HINTS.bcc[mode];
  cfg.outro = HINTS.outro[mode];
  wrongEls.forEach((el) => { el.style.display = on ? "" : "none"; });
  document.querySelectorAll(".bk-sound").forEach((el) => { if (el.textContent === "ding!" || el.textContent === "bzzt!") el.textContent = on ? "bzzt!" : "ding!"; });
}
setBroken(false);

const swatches = [...document.querySelectorAll("[data-swatch]")];
swatches.forEach((b) => b.addEventListener("click", () => {
  swatches.forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
  const [t, m, d] = b.dataset.swatch.split(",");
  svg.style.setProperty("--m-top", t); svg.style.setProperty("--m-mid", m); svg.style.setProperty("--m-dark", d);
}));

const stepper = mountStepper(cfg);
const breakBox = document.querySelector("[data-break]");
breakBox.addEventListener("change", () => { setBroken(breakBox.checked); lastScope = ""; stepper.render(); });
window.breakIt = (on) => { breakBox.checked = on; setBroken(on); lastScope = ""; stepper.render(); };
`;

const css = `
.pb-lcd{fill:#c9d8b4;stroke:none}
.pb-lcd-digits,.pb-lcd-unit{font-family:var(--font-mono);font-weight:700;fill:#26331d;letter-spacing:-.02em}
.pb-window{fill:rgba(190,178,235,.75);stroke:none}
.pb-screen{fill:#0f1626;stroke:none;transition:fill .5s}
.pb-screen[data-on]{fill:#17233b}
.pb-term{font-family:var(--font-mono);font-weight:700;fill:#9ff0c0;white-space:pre}
.pb-term[data-row="0"]{fill:#f6c445}
.pb-term[data-row="7"]{fill:#ffffff}
.lv-slot{fill:#2a3043;stroke:none}
.lv-label{font-family:var(--font-mono);font-weight:700;fill:#eef0f5}
.dk-slot{fill:#1d2232;stroke:var(--ink);stroke-width:.8px}
.fp-panel{fill:#3a4052;stroke:var(--ink);stroke-width:.9px}
.fp-window{fill:#1d2232;stroke:var(--ink);stroke-width:.8px}
.fp-cell{fill:#fbf7ee;stroke:none}
.fp-digit{font-family:var(--font-mono);font-weight:700;fill:var(--ink)}
.fp [data-turn] .fp-digit{fill:#b5651d}
.fp-bezel{fill:#c9d1db;stroke:var(--ink);stroke-width:.8px}
.fp-lamp{fill:#5d6479;stroke:var(--ink);stroke-width:.6px;transition:fill .15s}
.fp-lamp[data-state="ok"]{fill:#5fd07d}
.fp-lamp[data-state="bad"]{fill:#ff5a4f}
.fp-flag{fill:#5d6479;stroke:none}
.fp-flag[data-state="ok"]{fill:#5fb57d}
.fp-flag[data-state="bad"]{fill:#e8664f}
.fp-mark{font-family:var(--font-ui);font-weight:800;fill:#fff}
.fp-screw{fill:var(--ink)}
.fp-vent,.mp-vent{fill:#2a3043;stroke:var(--ink);stroke-width:.7px}
.mp-ring{fill:#cfd6df;stroke:var(--ink);stroke-width:.8px}
.mp-dot{fill:#232838}
.tp-channel{fill:#3a4256;stroke:none}
.tp-paper{stroke:none}
.tp-tx{fill:#f6e7b3}
.tp-rx{fill:color-mix(in srgb,var(--m-top,#8fb7ea) 42%,#fbf7ee)}
.tp-hole{fill:#2c3347;stroke:none}
.tp-wrong{fill:none;stroke:#e2495b;stroke-width:1.4px}
.tp-sep{fill:none;stroke:rgba(31,42,68,.35);stroke-width:.6px}
.tp-edge{fill:none;stroke:var(--ink);stroke-width:.9px}
.tp-text text{font-family:var(--font-mono);font-weight:700;fill:var(--ink)}
.tp-check{font-family:var(--font-ui);font-weight:800;fill:#2f8f52}
.tp-check[data-bad]{fill:#e2495b}
.gt-spot{fill:#ff6f7d}
.gt-halo{fill:var(--ir);opacity:.45;filter:blur(1.5px)}
.gt-glow{fill:var(--ir);opacity:.3;filter:blur(2px)}
.gt-beam{fill:var(--ir);stroke:none}
.gt-eye{fill:#232838;stroke:var(--ink);stroke-width:.5px}
.gt-eye[data-lit]{fill:#ff5a6a}
.sw-face{fill:#fbf7ee;stroke:none}
.sw-num{font-family:var(--font-mono);font-weight:700;fill:var(--ink)}
.sw-hand{fill:none;stroke:var(--ink);stroke-width:1.3px;stroke-linecap:round}
.sw-mark{fill:#e2495b;stroke:var(--ink);stroke-width:.5px}
.pb-lens-bg{fill:#ecc993}
.pb-glass{fill:rgba(190,220,255,.1);stroke:none}
.pb-shine{fill:#ffffff;opacity:.45}
.pb-rim{fill:none;stroke:#e0644f;vector-effect:none!important}
.pb-rim-line{fill:none;stroke:var(--ink);stroke-width:1.3px}
.bk-scope{display:grid;gap:6px}
.sc-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px}
.sc-svg{width:min(360px,100%);height:auto;display:block}
.sc-tape{fill:#f6e7b3;stroke:var(--ink);stroke-width:1.5}
.sc-hole{fill:#2c3347}
.sc-paper{fill:none;stroke:rgba(31,42,68,.18);stroke-width:1.2;stroke-dasharray:2 3}
.sc-now{fill:rgba(226,73,91,.35)}
.sc-brace{fill:none;stroke:var(--ink-soft);stroke-width:1.2}
.sc-svg text{font:700 10px var(--font-mono);fill:var(--ink-soft);text-anchor:middle}
.sc-svg .sc-bit{fill:var(--ink)}
.sc-meta{display:grid;gap:2px;min-width:170px;font-size:13px;color:var(--ink-soft);font-weight:700}
.sc-meta b{font:800 26px/1 var(--font-mono);color:var(--ink)}
.sc-verdict{color:#2f8f52}
.sc-verdict.sc-bad{color:#c8323f}
.bk-scope p{margin:0;font-size:13px;color:var(--ink-soft);font-weight:700}
@media (max-width:520px){
  .bk-card .iso-svg{width:110%;margin-left:-5%}
  .bk-toggle{flex-wrap:wrap}
  .bk-toggle small{flex-basis:100%;padding-left:46px}
}
`;

const extras = `
<div class="bk-panel bk-scope"><div class="sc-row" data-scope></div><p>The letter in the light gate (or being checked) right now, spot by spot. A hole lets light through = 0; paper stays dark = 1. Start spot, 7 letter spots (smallest first), a parity spot that makes the dark spots between the brackets an even number, and a stop spot.</p></div>
<div class="bk-extras">
  <div class="bk-swatches">Meter colour
    <button class="bk-swatch" type="button" aria-label="Blue" aria-pressed="true" data-swatch="#8fb7ea,#5f8fd0,#4370b0" style="background:#5f8fd0"></button>
    <button class="bk-swatch" type="button" aria-label="Teal" aria-pressed="false" data-swatch="#93d9c9,#4fb3a2,#378a7c" style="background:#4fb3a2"></button>
    <button class="bk-swatch" type="button" aria-label="Orange" aria-pressed="false" data-swatch="#f6b77a,#e58c43,#bf6a26" style="background:#e58c43"></button>
    <button class="bk-swatch" type="button" aria-label="Plum" aria-pressed="false" data-swatch="#cfb0e3,#a07bc0,#7c5a9c" style="background:#a07bc0"></button>
  </div>
  <label class="bk-toggle"><input type="checkbox" data-break> Let me break it <small>(punch one extra hole in the meter's ETX letter)</small></label>
</div>`;

const sources = [
  "The whole conversation (sign-on <code>/?!</code> at 300 baud, the meter's name with its speed letter <code>5</code>, the acknowledgement <code>␆050</code>, the 200 ms wait, then the data at 9600 baud ending in a BCC) and every letter on both tapes come from figure 1's model, so the two figures agree. Protocol as summarised in the <a href=\"https://www.openmuc.org/iec-62056-21/\" target=\"_blank\" rel=\"noopener\">OpenMUC j62056 guide</a> and the <a href=\"https://wiki.elseta.com/books/manual/page/30-iec-62056-21\" target=\"_blank\" rel=\"noopener\">Elseta IEC 62056-21 manual</a>.",
  `Times: 10 spots per letter (start, 7 data, even parity, stop). The ${F1.READOUT.length}-letter readout is ${F1.READOUT.length * 10} spots: ${F1.READOUT.length * 10} ÷ 300 = ${M.READ_SLOW.toFixed(3)} s, ${F1.READOUT.length * 10} ÷ 9600 = ${M.READ_FAST.toFixed(3)} s, ${M.SPEEDUP}× faster. The whole conversation takes ${(M.PHASES.reduce((s, ph) => s + (M.realOf(ph) ?? 0), 0)).toFixed(3)} s of real time; the stopwatch's red mark is where it would end if the readout stayed at 300 baud.`,
  "The checksum: XOR of every byte after STX up to and including ETX (IEC 62056-21, per OpenMUC). XOR is adding without carrying, so each wheel just flips when a letter has a 1 in its place. Here it comes out <code>0x7E</code>, the letter <code>~</code>.",
  "Even parity, 7 data bits, 1 stop bit at 300 baud: the settings reader drivers use, e.g. the <a href=\"https://kb.mervis.info/doku.php/en:mervis-ide:35-help:020-communication-protocols-description:030-iec62056_21_description\" target=\"_blank\" rel=\"noopener\">Mervis IEC 62056-21 driver</a>. One flipped bit always makes the count odd, so parity catches any single flip; two flips in one letter would slip past it, which is why the BCC is there too.",
  "After a failed check the phone “asks again”: reader software retries on a communication error (the Mervis driver's retry count). The standard's own rule for a bad BCC in readout mode is not checked here.",
  "The tape machines are a picture of the light link, not real hardware: the probe has no paper. Light on = 0 and dark = 1, as in figure 1 (how DIY read heads wire it; check the standard's optical clause before relying on it). The meter's name, serial and total are invented, as in figure 1.",
];

const page = bookPage({
  fig: "Fig 5",
  title: "The conversation",
  question: "What do the probe and the meter actually say to each other?",
  label: "Two tape machines, the phone and the meter, taking turns to send punched letters past a light gate. Use the step buttons to play each step.",
  svg,
  extras,
  idea: "The big idea: <em>every letter is ten flashes in a row, and both sides must count them at the same speed.</em>",
  sources,
  css,
  script: kitScript() + "\n" + live,
});

writeFileSync(join(HERE, "index.html"), page);
console.log("wrote index.html", (page.length / 1024).toFixed(0) + " KB", WIDTH + "x" + HEIGHT, "scale " + P.scale.toFixed(3));
