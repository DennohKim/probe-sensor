import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../vendor/anatomy/kit/iso-kit.mjs";
import * as G from "../../vendor/anatomy/kit/lathe.mjs";
import { kitScript } from "../../vendor/anatomy/scripts/inline-kit.mjs";
import { bookPage, stripExports } from "../../shared/page.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL_SRC = stripExports(readFileSync(join(HERE, "model.mjs"), "utf8"));

const WIDTH = 640;
const HEIGHT = 470;

// World: the USB-C plug from figure 1, opened and blown up. x runs from the USB end to the cable end, y toward the front, z up.
const PLATE = { x: -158, y: -72, w: 310, d: 142, r: 10 };
const PLATE_H = 9;
const FOOT_H = 6;

const TRAY = { x: -122, y: -64, w: 214, d: 124, r: 3 };
const WALL = 5;
const TRAY_H = 6;
const FLOOR = 3;
const PCB = { x: TRAY.x + WALL, y: TRAY.y + WALL, w: TRAY.w - WALL * 2, d: TRAY.d - WALL * 2, r: 0.6 };
const PCB_Z = FLOOR + 1.6;

const CHIP = { x: -96, y: -40, w: 158, d: 70, r: 1.2 };
const CHIP_Z0 = 5.4;
const TOP = 9.6;
const PITCH = CHIP.w / 14;
const FRONT = CHIP.y + CHIP.d;
const pinX = (n) => (n <= 14 ? CHIP.x + (14 - n + 0.5) * PITCH : CHIP.x + (n - 15 + 0.5) * PITCH);

const SHELL = { x0: -152, x1: -108, y: -2, z: 10, half: 10, r: 5 };
const RAIL = { ys: [-6, 2], x0: SHELL.x1, x1: -60, z0: 11, z1: 12.6 };
const CART = { dock: -72, entry: -100, y: -2, w: 20, d: 16, z0: RAIL.z1, z1: RAIL.z1 + 2.8 };
const RACK = { w: 19, d: 6, z0: CART.z1, z1: CART.z1 + 2.6 };
const CARD = { w: 3.2, h: 3.8, pitch: 3.7 };

const HOLE = 4.2;
const FRAME_W = 2.4;
const cabinet = (x, rows) => ({ x, y: -38, w: 16 * HOLE + FRAME_W * 2, d: 10, z0: 19, z1: 19 + rows * HOLE + FRAME_W * 2, rows });
const CAB_OUT = cabinet(-93, 8);
const CAB_IN = cabinet(-17, 16);
const CAB_FACE = CAB_OUT.y + CAB_OUT.d;
const holeAt = (cab, slot) => {
  const c = slot % 16, r = Math.floor(slot / 16);
  return [cab.x + FRAME_W + (c + 0.5) * HOLE, CAB_FACE, cab.z1 - FRAME_W - (r + 0.5) * HOLE];
};

// The baud wheel stands upright facing the viewer; one turn of it is one bit. The 3 MHz pinion meshes on its left.
const WHEEL = { x: -40, y0: -16, y1: -12.5, z: TOP + 24, r: 14, body: 12.6, teeth: 40 };
const PINION = { x: -60, z: WHEEL.z, r: 6, body: 5, teeth: 12 };
const PAWL = { u: -35.4, z: WHEEL.z + 18.4 };
const FRAMEBOX = { x: -94, y: 14, w: 26, d: 12, r: 1.4, h: 9.4 };
const COUNTER = { x: -62, y: 14, w: 30, d: 12, r: 1.4, h: 12 };
const SHIFT = { x: -16, y: 12, w: 50, d: 14, r: 1.4, h: 26.4 };
const TIMER = { x: 38, y: 12, w: 18, d: 14, r: 1.4, h: 18 };
const TX_TRAY = { x: -12, y: 15, w: 12, d: 8, r: 1 };
const RX_TRAY = { x: 16, y: 15, w: 12, d: 8, r: 1 };
const TRAY_TOP = TOP + SHIFT.h + 1.4;
const TIMER_TOP = TOP + TIMER.h;
const DIAL = { u: TIMER.x + TIMER.w / 2, z: TOP + 10.4, r: 6.4 };
const CELL = { u0: SHIFT.x + 9, pitch: 3.8, w: 3.2, h: 4.4, tx: TOP + 18.6, rx: TOP + 8.2 };

const PADS = [["red", -14], ["black", -8], ["white", -2], ["green", 4]];
const PAD_X = 76;
const BOOT = { x0: TRAY.x + TRAY.w - WALL, x1: TRAY.x + TRAY.w + 12, y: -5, z: TRAY_H, r: 4.6 };
const PROBE = { x: 132, y: 44, puck: 17, cup: 12.5, puckH: 7, cupH: 18 };
const CABLE_R = 2.1;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners({ x: CAB_IN.x, y: CAB_IN.y, w: CAB_IN.w, d: CAB_IN.d }, 0, CAB_IN.z1 + 2),
    [PROBE.x, PROBE.y - 8, 50],
  ],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 52 },
);
const SCALE = G.scaleOf(P);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const C = (name, svg) => `<g class="c-${name}">${svg}</g>`;
const face = (y) => k.sideMatrix([0, y], 0, P, "left");
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const f = (n) => +n.toFixed(2);
const rect = (cls, u0, z0, u1, z1, extra = "") => `<rect class="${cls}" x="${f(u0)}" y="${f(-z1)}" width="${f(u1 - u0)}" height="${f(z1 - z0)}"${extra}/>`;
const text = (cls, u, z, size, body, extra = "") => `<text class="${cls}" x="${f(u)}" y="${f(-z)}" font-size="${size}"${extra}>${body}</text>`;
const xAxis = (y, z) => G.frameOf([0, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const slabSeam = (plan, z, steps = 4) => L(k.sideSeam(plan, z, P, steps), { tone: "faint" });

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) out.push(C("wood", S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, P, 28), { tone: "hi" })));
  out.push(C("wood", S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "hi" })));
  const grain = [0.2, 0.45, 0.7, 0.9].map((t) => k.lineOnTop([PLATE.x + 6, PLATE.y + PLATE.d * t], [PLATE.x + PLATE.w - 6, PLATE.y + PLATE.d * t], 0, P)).join("");
  out.push(L(grain, { tone: "faint", free: true }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.6, tone: "mid" }));
  return out.join("");
}

// The USB-C shell: a flat stadium tube along x, half outside the plug and half on the board.
const stadiumRing = (half, r, steps = 14) => {
  const pts = [];
  for (let i = 0; i <= steps; i++) { const a = -Math.PI / 2 + (i / steps) * Math.PI; pts.push([half + r * Math.cos(a), r * Math.sin(a)]); }
  for (let i = 0; i <= steps; i++) { const a = Math.PI / 2 + (i / steps) * Math.PI; pts.push([-half + r * Math.cos(a), r * Math.sin(a)]); }
  return pts;
};
function shell(x0, x1) {
  const F = xAxis(SHELL.y, SHELL.z);
  return C("chrome", S(G.prismOf(F, stadiumRing(SHELL.half, SHELL.r), x0, x1, P), { tone: "hi" }));
}

function trayBack() {
  const out = [`<path class="iso-halo" d="${k.haloOf(TRAY, 0, 4, P)}"/>`];
  out.push(C("black", S(k.slabOf(TRAY, 0, FLOOR, P, 3, 0), { tone: "hi" })));
  out.push(C("black", S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: WALL, r: 1.2 }, 0, TRAY_H, P, 3, 0.5), { tone: "hi" })));
  out.push(C("black", S(k.slabOf({ x: TRAY.x, y: TRAY.y + WALL, w: WALL, d: TRAY.d - WALL * 2, r: 1.2 }, 0, TRAY_H, P, 3, 0.5), { tone: "hi" })));
  return out.join("");
}
function trayRight() {
  return C("black", S(k.slabOf({ x: TRAY.x + TRAY.w - WALL, y: TRAY.y + WALL, w: WALL, d: TRAY.d - WALL * 2, r: 1.2 }, 0, TRAY_H, P, 3, 0.5), { tone: "hi" }));
}
function trayFront() {
  const plan = { x: TRAY.x, y: TRAY.y + TRAY.d - WALL, w: TRAY.w, d: WALL, r: 1.2 };
  return C("black", S(k.slabOf(plan, 0, TRAY_H, P, 3, 0.5), { tone: "hi", inner: slabSeam(plan, 4, 3) }));
}

const trace = (points, name) => `<path class="pc-trace" data-wire="${name}" d="${k.onTop(points, PCB_Z, P)}"/>`;
const padAt = (x, y, w, d) => `<path class="pc-pad" d="${k.planOutline({ x: x - w / 2, y: y - d / 2, w, d, r: 0.6 }, PCB_Z, P, 3)}"/>`;

function board() {
  const out = [C("pcb", S(k.slabOf(PCB, FLOOR, PCB_Z - FLOOR, P, 2), { tone: "hi", crease: "none" }))];
  const holes = k.corners(PCB, 4.5);
  out.push(L(holes.map(([x, y]) => k.ring(x, y, 2.2, PCB_Z, P, 16)).join(""), { tone: "lo" }));
  out.push(D(holes.map(([x, y]) => at([x, y, PCB_Z])), { size: 0.6, tone: "mid" }));
  out.push(padAt(-104, -16, 3.6, 3), padAt(-98, -16, 3.6, 3));
  RAIL.ys.forEach((y) => out.push(padAt(-105, y, 4, 3)));
  out.push(trace([[-104, -16], [-104, -53], [72, -53], [72, -14], [PAD_X, -14]], "red"));
  out.push(trace([[-98, -16], [-98, -50], [69, -50], [69, -8], [PAD_X, -8]], "black"));
  const tx = pinX(1), rx = pinX(5);
  out.push(trace([[tx, FRONT + 6], [tx, FRONT + 11], [66, FRONT + 11], [66, -2], [PAD_X, -2]], "white"));
  out.push(trace([[rx, FRONT + 6], [rx, FRONT + 14], [68, FRONT + 14], [68, 4], [PAD_X, 4]], "green"));
  for (const [, y] of PADS) out.push(padAt(PAD_X + 2.5, y, 6, 3.6));
  out.push(D(PADS.map(([, y]) => at([PAD_X + 2.5, y, PCB_Z])), { size: 0.7, tone: "hi" }));
  for (let n = 1; n <= 28; n++) out.push(padAt(pinX(n), n <= 14 ? FRONT + 4.6 : CHIP.y - 4.6, 5.2, 5));
  const caps = [[-110, 24, "cap"], [-110, 32, "cap"], [-110, 40, "chip"], [80, 22, "cap"], [80, 30, "cap"]];
  for (const [x, y, c] of byDepth(caps)) {
    out.push(padAt(x - 1.6, y, 1.8, 2.8) + padAt(x + 1.6, y, 1.8, 2.8));
    out.push(C(c === "cap" ? "brown" : "chip", S(k.slabOf({ x: x - 2.6, y: y - 1.3, w: 5.2, d: 2.6, r: 0.3 }, PCB_Z, 1.8, P, 2), { tone: "hi" })));
  }
  return out.join("");
}

function legs(front) {
  const out = [];
  const list = Array.from({ length: 14 }, (_, i) => (front ? 1 + i : 15 + i)).map((n) => pinX(n)).sort((a, b) => a - b);
  for (const x of list) {
    const p = (y, d, z0, z1) => C("chrome", S(k.slabOf({ x: x - 2.2, y, w: 4.4, d, r: 0.3 }, z0, z1 - z0, P, 2), { tone: "hi", crease: "none" }));
    if (front) out.push(p(FRONT, 3.2, 6.6, 7.8), p(FRONT + 2.2, 1.1, PCB_Z, 7.8), p(FRONT + 2.2, 4.4, PCB_Z, PCB_Z + 0.9));
    else out.push(p(CHIP.y - 6.6, 4.4, PCB_Z, PCB_Z + 0.9), p(CHIP.y - 3.3, 1.1, PCB_Z, 7.8), p(CHIP.y - 3.2, 3.2, 6.6, 7.8));
  }
  return out.join("");
}

function chip() {
  const out = [C("chip", S(k.slabOf(CHIP, CHIP_Z0, TOP - CHIP_Z0, P, 2, 0.6), { tone: "hi", inner: slabSeam(CHIP, 7.2, 2) }))];
  const die = { x: CHIP.x + 4, y: CHIP.y + 3, w: CHIP.w - 8, d: CHIP.d - 9, r: 1 };
  out.push(`<path class="pc-die" d="${k.planOutline(die, TOP, P, 2)}"/>`);
  out.push(L(k.planOutline(die, TOP, P, 2), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(die, 1.6), TOP, P, 2), { tone: "faint" }));
  out.push(D([at([pinX(1), FRONT - 2.2, TOP])], { size: 1, tone: "hi" }));
  out.push(`<g transform="${k.topMatrix([-12, FRONT - 1.2], TOP, P, "x")}"><text class="pc-mark" font-size="2.4">FTDI  FT232RL</text></g>`);
  return out.join("");
}

function cabinetSvg(cab, label) {
  const out = [];
  const plinth = { x: cab.x + 3, y: cab.y + 1, w: cab.w - 6, d: cab.d - 2, r: 1 };
  out.push(C("machine", S(k.slabOf(plinth, TOP, cab.z0 - TOP, P, 2, 0.4), { tone: "hi" })));
  const body = { x: cab.x, y: cab.y, w: cab.w, d: cab.d, r: 1 };
  out.push(C("machine", S(k.slabOf(body, cab.z0, cab.z1 - cab.z0, P, 2, 0.6), { tone: "hi" })));
  out.push(C("machine", S(k.slabOf(k.insetPlan(body, -0.8), cab.z1, 1.6, P, 2, 0.5), { tone: "hi" })));
  const holes = [];
  for (let slot = 0; slot < cab.rows * 16; slot++) {
    const [u, , z] = holeAt(cab, slot);
    holes.push(`M${f(u - HOLE / 2 + 0.45)} ${f(-(z + HOLE / 2 - 0.45))}h${f(HOLE - 0.9)}v${f(HOLE - 0.9)}h${f(-(HOLE - 0.9))}Z`);
  }
  const inner = `<path class="cb-hole" d="${holes.join("")}"/>`;
  const plate = rect("cb-plate", cab.x + cab.w / 2 - 7, TOP + 3, cab.x + cab.w / 2 + 7, TOP + 7.4) + text("cb-plate-text", cab.x + cab.w / 2, TOP + 3.95, 3.6, label, ' text-anchor="middle"');
  out.push(`<g transform="${face(CAB_FACE)}">${inner}</g>`);
  out.push(`<g transform="${face(cab.y + cab.d - 1)}">${plate}</g>`);
  out.push(D([at([cab.x + cab.w / 2 - 5.6, cab.y + cab.d - 1, TOP + 5.2]), at([cab.x + cab.w / 2 + 5.6, cab.y + cab.d - 1, TOP + 5.2])], { size: 0.35, tone: "mid" }));
  return out.join("");
}

const yAxis = (x, z) => G.frameOf([x, 0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const gearPath = (cx, cz, r0, r1, teeth) => {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = (Math.PI * 2) / teeth;
    for (const [da, r] of [[0, r0], [0.18, r1], [0.5, r1], [0.68, r0]]) pts.push([cx + r * Math.sin(a + da * w), -cz - r * Math.cos(a + da * w)]);
  }
  return "M" + pts.map(([u, v]) => f(u) + " " + f(v)).join("L") + "Z";
};
const spokePath = (cx, cz, r0, r1, n, phase = 0) => Array.from({ length: n }, (_, i) => {
  const a = phase + (i / n) * Math.PI * 2;
  return `M${f(cx + r0 * Math.sin(a))} ${f(-cz - r0 * Math.cos(a))}L${f(cx + r1 * Math.sin(a))} ${f(-cz - r1 * Math.cos(a))}`;
}).join("");

function clock() {
  const out = [];
  const base = { x: PINION.x - 8, y: WHEEL.y0 - 6, w: WHEEL.x + 16 - (PINION.x - 8), d: 5.5, r: 1 };
  out.push(`<path class="iso-halo" d="${k.haloOf(base, TOP, 1, P)}"/>`);
  out.push(C("machine", S(k.slabOf(base, TOP, 3.4, P, 2, 0.4), { tone: "hi" })));
  const post = (x, top) => C("machine", S(k.slabOf({ x: x - 2, y: base.y + 0.6, w: 4, d: 4.4, r: 0.6 }, TOP + 3.4, top - TOP - 3.4, P, 2, 0.3), { tone: "hi" }));
  out.push(post(PINION.x, PINION.z + 2.4), post(WHEEL.x, PAWL.z + 1.6));
  out.push(C("machine", S(k.slabOf({ x: WHEEL.x - 2, y: base.y + 0.6, w: 6.6, d: 10.2, r: 0.6 }, PAWL.z - 0.8, 2.4, P, 2, 0.3), { tone: "hi" })));
  const disc = (x, z, r, name) => C(name, S(G.disc(WHEEL.y0, WHEEL.y1, r, yAxis(x, z), P), { tone: "hi" }));
  out.push(disc(PINION.x, PINION.z, PINION.body, "chrome"));
  out.push(`<g transform="${face(WHEEL.y1)}"><g data-part="pinion-rot"><path class="gr-pinion" d="${gearPath(PINION.x, PINION.z, PINION.body, PINION.r, PINION.teeth)}"/><path class="gr-spokes" d="${spokePath(PINION.x, PINION.z, 1.4, PINION.body - 0.8, 3)}"/></g><circle class="gr-blur" data-part="pinion-blur" cx="${PINION.x}" cy="${f(-PINION.z)}" r="${PINION.body - 1.2}"/><circle class="gr-hub" cx="${PINION.x}" cy="${f(-PINION.z)}" r="1.3"/></g>`);
  out.push(disc(WHEEL.x, WHEEL.z, WHEEL.body, "brass"));
  const wheelFace = `<path class="gr-gear" d="${gearPath(WHEEL.x, WHEEL.z, WHEEL.body, WHEEL.r, WHEEL.teeth)}"/>` +
    `<circle class="gr-ring" cx="${WHEEL.x}" cy="${f(-WHEEL.z)}" r="9.6"/>` +
    `<path class="gr-spokes-w" d="${spokePath(WHEEL.x, WHEEL.z, 2.6, 9.6, 4, Math.PI / 4)}"/>` +
    `<path class="gr-pointer" d="M${WHEEL.x} ${f(-WHEEL.z)}V${f(-WHEEL.z - 11)}"/>` +
    `<circle class="gr-cam" cx="${WHEEL.x}" cy="${f(-WHEEL.z - 11.4)}" r="1.1"/>`;
  out.push(`<g transform="${face(WHEEL.y1)}"><g data-part="wheel-rot">${wheelFace}</g><circle class="gr-hub" cx="${WHEEL.x}" cy="${f(-WHEEL.z)}" r="2.2"/><circle class="gr-hub-dot" cx="${WHEEL.x}" cy="${f(-WHEEL.z)}" r="0.6"/></g>`);
  const tipU = WHEEL.x + 0.6, tipZ = WHEEL.z + WHEEL.r + 0.3;
  out.push(`<g transform="${face(WHEEL.y1 + 0.3)}"><g data-part="pawl"><path class="gr-arm" d="M${f(PAWL.u)} ${f(-PAWL.z)}L${f(tipU)} ${f(-tipZ)}"/></g><circle class="gr-hub" cx="${f(PAWL.u)}" cy="${f(-PAWL.z)}" r="1"/></g>`);
  return out.join("");
}

function rails() {
  const out = [];
  for (const x of [-104, -99]) for (const y of RAIL.ys) out.push(C("chrome", S(k.slabOf({ x: x - 1, y: y - 1, w: 2, d: 2, r: 0.3 }, PCB_Z, RAIL.z0 - PCB_Z, P, 2), { tone: "hi", crease: "none" })));
  for (let x = -90; x <= -62; x += 6) out.push(C("wood", S(k.slabOf({ x, y: -10, w: 2.4, d: 16, r: 0.4 }, TOP, RAIL.z0 - TOP, P, 2), { tone: "hi", crease: "none" })));
  for (const y of RAIL.ys) out.push(C("chrome", S(k.slabOf({ x: RAIL.x0, y: y - 0.9, w: RAIL.x1 - RAIL.x0, d: 1.8, r: 0.4 }, RAIL.z0, RAIL.z1 - RAIL.z0, P, 2, 0.3), { tone: "hi" })));
  const stop = { x: RAIL.x1, y: -10, w: 3.4, d: 16, r: 0.8 };
  out.push(C("red", S(k.slabOf(stop, TOP, 6.6, P, 2, 0.4), { tone: "hi" })));
  out.push(D([at([RAIL.x1 + 1.7, -6, TOP + 6.6]), at([RAIL.x1 + 1.7, 2, TOP + 6.6])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// The cart is built at the dock and slid along x.
function cart() {
  const x = CART.dock;
  const base = { x: x - CART.w / 2, y: CART.y - CART.d / 2, w: CART.w, d: CART.d, r: 1.6 };
  const out = [`<path class="iso-halo" d="${k.haloOf(base, RAIL.z1, 1, P)}"/>`];
  out.push(C("red", S(k.slabOf(base, CART.z0, CART.z1 - CART.z0, P, 3, 0.5), { tone: "hi" })));
  for (const wx of [x - 6, x + 6]) out.push(C("chip", S(G.disc(0, 1, 2.1, G.frameOf([wx, base.y + base.d, CART.z0 + 0.6], [0, 1, 0], [1, 0, 0], [0, 0, 1]), P), { tone: "hi" })));
  const rack = { x: x - RACK.w / 2, y: CART.y - RACK.d / 2, w: RACK.w, d: RACK.d, r: 0.8 };
  out.push(C("wood", S(k.slabOf(rack, RACK.z0, RACK.z1 - RACK.z0, P, 2, 0.4), { tone: "hi" })));
  out.push(L(k.lineOnTop([rack.x, CART.y], [rack.x + rack.w, CART.y], RACK.z1, P), { tone: "lo" }));
  out.push(`<g transform="${face(base.y + base.d)}"><text class="cr-label" data-part="cart-label" x="${f(x)}" y="${f(-(CART.z0 + 0.75))}" font-size="1.9" text-anchor="middle">DATA0</text></g>`);
  return `<g data-part="cart" style="opacity:0">${out.join("")}</g>`;
}

function box(plan, h, inner) {
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, TOP, 1, P)}"/>`];
  out.push(C("machine", S(k.slabOf(plan, TOP, h, P, 2, 0.6), { tone: "hi", inner: slabSeam(plan, TOP + 2.2, 2) })));
  out.push(`<g transform="${face(plan.y + plan.d)}">${inner}</g>`);
  return out.join("");
}

function frameBox() {
  const b = FRAMEBOX, z = TOP;
  const inner = rect("dp-window", b.x + 3, z + 4.6, b.x + b.w - 3, z + 9.8) +
    text("dp-digits", b.x + b.w / 2, z + 5.6, 4.4, "0000", ' text-anchor="middle" data-part="frames"') +
    text("dp-engrave", b.x + b.w / 2, z + 1.6, 2.2, "USB FRAME · 1 ms", ' text-anchor="middle"');
  return box(b, b.h, inner);
}

function counterBox() {
  const b = COUNTER, z = TOP;
  const inner = rect("dp-window", b.x + 3, z + 6.4, b.x + b.w - 3, z + 11.6) +
    text("dp-digits", b.x + b.w / 2, z + 7.4, 4.4, "00000", ' text-anchor="middle" data-part="count"') +
    text("dp-engrave", b.x + b.w / 2, z + 3.4, 2.1, "÷" + M.DIVISOR + " → " + M.LINE.baud + " Bd", ' text-anchor="middle"') +
    text("dp-engrave dp-faint", b.x + b.w / 2, z + 1.0, 1.8, "÷" + M.FAST_DIVISOR + " → " + M.LINE.fastBaud + " Bd", ' text-anchor="middle"');
  return box(b, b.h, inner);
}

const BITNAMES = ["S", "0", "1", "2", "3", "4", "5", "6", "P", "E"];
function shiftBox() {
  const b = SHIFT;
  const row = (dir, z) => {
    const cells = BITNAMES.map((name, j) => rect("sh-cell", CELL.u0 + j * CELL.pitch, z, CELL.u0 + j * CELL.pitch + CELL.w, z + CELL.h, ` data-cell="${dir}${j}"`)).join("");
    const names = BITNAMES.map((name, j) => text("sh-name", CELL.u0 + j * CELL.pitch + CELL.w / 2, z - 2.4, 1.9, name, ' text-anchor="middle"')).join("");
    const win = rect("dp-window", b.x + 2.2, z - 0.6, b.x + 7.6, z + CELL.h + 0.6) + text("sh-glyph", b.x + 4.9, z + 0.7, 4.2, "", ` text-anchor="middle" data-part="${dir}-glyph"`);
    const tag = text("dp-engrave", b.x + 4.9, z + CELL.h + 1.4, 1.9, dir.toUpperCase(), ' text-anchor="middle"');
    const reader = `<path class="sh-reader" data-part="${dir}-reader" d="M0 ${f(-(z + CELL.h + 2.6))}l-1.3 -1.8h2.6Z" style="opacity:0"/>`;
    return cells + names + win + tag + reader;
  };
  return box(b, b.h, row("tx", CELL.tx) + row("rx", CELL.rx)) + trays();
}
function trays() {
  return [TX_TRAY, RX_TRAY].map((t) => C("chrome", S(k.slabOf(t, TOP + SHIFT.h, 1.4, P, 2, 0.3), { tone: "hi" })) + L(k.planOutline({ x: t.x + 1.4, y: t.y + t.d / 2 - 0.6, w: t.w - 2.8, d: 1.2, r: 0.6 }, TRAY_TOP, P, 3), { tone: "lo" })).join("");
}

function timerBox() {
  const b = TIMER;
  const ticks = [];
  for (let ms = 0; ms <= 16; ms++) {
    const a = (ms / 16) * Math.PI * 1.7 - Math.PI * 0.85;
    const r0 = DIAL.r - (ms % 4 === 0 ? 1.8 : 1);
    ticks.push(`M${f(DIAL.u + r0 * Math.sin(a))} ${f(-DIAL.z - r0 * Math.cos(a))}L${f(DIAL.u + DIAL.r * Math.sin(a))} ${f(-DIAL.z - DIAL.r * Math.cos(a))}`);
  }
  const inner = `<circle class="tm-face" cx="${f(DIAL.u)}" cy="${f(-DIAL.z)}" r="${DIAL.r}"/>` +
    `<path class="tm-ticks" d="${ticks.join("")}"/>` +
    text("tm-num", DIAL.u, DIAL.z - 3.6, 2.2, "ms", ' text-anchor="middle"') +
    text("tm-num", DIAL.u, DIAL.z + 2.2, 1.9, "16", ' text-anchor="middle" data-part="timer-read"') +
    `<g data-part="timer-hand"><path class="tm-hand" d="M${f(DIAL.u)} ${f(-DIAL.z + 1.2)}V${f(-DIAL.z - DIAL.r + 1.4)}"/></g>` +
    `<circle class="tm-hub" cx="${f(DIAL.u)}" cy="${f(-DIAL.z)}" r="0.8"/>` +
    text("dp-engrave", DIAL.u, TOP + 1.4, 1.9, "LATENCY", ' text-anchor="middle"');
  const bell = C("brass", S(G.sphereOf([b.x + b.w - 4, b.y + 4, TIMER_TOP + 2.2], 2.4, P), { tone: "hi" }));
  const stem = C("chrome", S(k.cylinder(b.x + b.w - 4, b.y + 4, 0.7, TIMER_TOP, 0.6, P, 12), { tone: "hi" }));
  return box(b, b.h, inner) + stem + bell;
}

// A letter card stands in the face plane y = 0 with its bottom centre on the origin, and is slid to wherever it is.
function card(id, glyph, kind) {
  const half = CARD.w / 2;
  return `<g data-card="${id}" style="opacity:0"><g transform="${face(0)}"><rect class="cd-${kind}" x="${-half}" y="${-CARD.h}" width="${CARD.w}" height="${CARD.h}" rx="0.4"/>${text("cd-glyph", 0, kind === "status" ? 1.15 : 0.85, kind === "status" ? 1.9 : 2.8, glyph, ' text-anchor="middle"')}</g></g>`;
}
function cards() {
  const out = [];
  [...M.MESSAGE].forEach((ch, i) => out.push(card("m" + i, M.show(ch), "letter")));
  M.CHIP.status.forEach((code, i) => out.push(card("s" + i, M.hex(code), "status")));
  out.push(card("r0", M.REPLY[0], "letter"));
  return out.join("");
}

function insideWires() {
  return PADS.map(([name, y], i) => {
    const end = [BOOT.x0 - WALL - 0.5, BOOT.y + (i - 1.5) * 1.6, BOOT.z];
    const pts = [[PAD_X + 4.5, y, PCB_Z + 0.4], [PAD_X + 8, y, PCB_Z + 1.4], [end[0] - 3, end[1], end[2] - 0.8], end].map(at);
    return `<path class="pb-wire" data-wire="${name}" d="${k.pathOf(pts)}"/>`;
  }).join("");
}

function catmull(points, per = 10) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function cableAndProbe() {
  const out = [];
  const F = xAxis(BOOT.y, BOOT.z);
  out.push(C("black", S(G.disc(BOOT.x0, BOOT.x1, BOOT.r, F, P), { tone: "hi", inner: L(G.arcOf(F, BOOT.x0 + 4, BOOT.r, P), { tone: "faint" }) })));
  const top = PROBE.puckH + 0.6 + PROBE.cupH + 6;
  const back = PROBE.y - PROBE.cup - 3;
  const route = [[BOOT.x1, BOOT.y, BOOT.z], [BOOT.x1 + 5, BOOT.y, BOOT.z - 1.6], [BOOT.x1 + 12, BOOT.y + 4, CABLE_R], [PROBE.x - 1, back - 12, CABLE_R], [PROBE.x, back - 2, 6], [PROBE.x, back, top - 4], [PROBE.x, back + 4, top + 7], [PROBE.x, PROBE.y - 4, top + 7], [PROBE.x, PROBE.y, top + 2], [PROBE.x, PROBE.y, top]];
  const d = k.pathOf(catmull(route).map(at));
  const w = 2 * CABLE_R * SCALE;
  out.push(`<path class="pb-cable-out" d="${d}" style="stroke-width:${f(w + 1.6)}"/><path class="pb-cable-in" d="${d}" style="stroke-width:${f(w - 1)}"/><path class="pb-cable-shine" d="${d}" style="stroke-width:${f(w * 0.22)}"/>`);
  return out.join("");
}

function probe() {
  const { x, y } = PROBE;
  const puck = { x: x - PROBE.puck, y: y - PROBE.puck, w: PROBE.puck * 2, d: PROBE.puck * 2, r: PROBE.puck };
  const out = [`<path class="iso-halo" d="${k.haloOf(puck, 0, 3, P)}"/>`];
  out.push(C("meter", S(k.cylinder(x, y, PROBE.puck, 0, PROBE.puckH, P, 72, 0.8), { tone: "hi", inner: L(k.sideArc(x, y, PROBE.puck, 2.4, P, 48), { tone: "faint" }) })));
  out.push(C("chrome", S(k.cylinder(x, y, PROBE.cup + 2.6, PROBE.puckH, 0.6, P, 64), { tone: "hi" })));
  out.push(`<path class="pr-glow" data-part="glow" d="${k.ring(x, y, PROBE.cup + 1.6, PROBE.puckH + 0.6, P, 56)}" style="opacity:0"/>`);
  const z0 = PROBE.puckH + 0.6, z1 = z0 + PROBE.cupH;
  out.push(C("black", S(k.cylinder(x, y, PROBE.cup, z0, PROBE.cupH, P, 64, 0.8), { tone: "hi", inner: L(k.sideArc(x, y, PROBE.cup, z0 + 4, P, 40), { tone: "faint" }) })));
  out.push(C("black", S(k.cylinder(x, y, 5.6, z1, 3, P, 24), { tone: "hi" })));
  out.push(C("black", S(k.cylinder(x, y, 4, z1 + 3, 3, P, 24), { tone: "hi" })));
  out.push(D(G.dotsOf(G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), z1, PROBE.cup - 3, 3, P, { phase: Math.PI * 1.25, all: true }).slice(0, 2), { size: 0.5, tone: "hi" }));
  return out.join("");
}

const SOUNDS = {
  rails: at([-112, -2, 34]),
  cabinet: at([-70, CAB_FACE, CAB_OUT.z1 + 16]),
  lever: at([WHEEL.x + 16, WHEEL.y1, PAWL.z + 6]),
  probe: at([PROBE.x - 4, PROBE.y + 30, 2]),
  timer: at([TIMER.x + 16, TIMER.y + 6, TIMER_TOP + 12]),
  out: at([-126, -2, 36]),
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "The USB-C plug from figure 1, opened and drawn large on a bench. Inside, the FT232R chip is a little mailroom: a cart on the two USB data rails brings a parcel of letters, a cabinet of 128 pigeonholes holds them, a brass wheel turned by a 3 MHz clock lets one bit out per turn onto the white TX wire to the probe, bits from the green RX wire become letters in a cabinet of 256 pigeonholes, and a 16 ms timer sends them back in a parcel.",
  body: [
    bench(),
    shell(SHELL.x0, TRAY.x + 1),
    trayBack(),
    board(),
    shell(TRAY.x + WALL, SHELL.x1),
    legs(false),
    chip(),
    legs(true),
    cabinetSvg(CAB_OUT, String(M.CHIP.outBuffer)),
    cabinetSvg(CAB_IN, String(M.CHIP.inBuffer)),
    clock(),
    rails(),
    cart(),
    frameBox(),
    counterBox(),
    shiftBox(),
    timerBox(),
    cards(),
    insideWires(),
    trayRight(),
    trayFront(),
    cableAndProbe(),
    probe(),
  ],
});

const FACTORS = [400000, null, 1000, 50, 150, 120, 600000];
const MOVING = [0.85, 1, 1, 1, 1, 0.6, 0.85];
const REAL = M.SPANS.map((_, i) => M.realOf(i));
const durOf = (i) => (FACTORS[i] ? +((FACTORS[i] * REAL[i]) / MOVING[i]).toFixed(4) : 3.0);
const realForBadge = (i) => (REAL[i] ? REAL[i] / MOVING[i] : null);

const millionths = (s) => Math.round(s * 1e6);
const TX_MS = Math.round(M.MESSAGE.length * M.CHAR_S * 1000);
const FASTER = (Math.round(M.SLOWER / 1000) * 1000).toLocaleString("en-US");
const STEPS = [
  { label: "Phone sends a USB packet", hint: `The phone sends a parcel of ${M.MESSAGE.length} letters, “/?!” and two line ends, down the two USB data wires. It arrives in about ${millionths(M.OUT_PACKET.seconds)} millionths of a second.`, sound: { word: "whoosh", at: SOUNDS.rails, from: 0.1, to: 0.8 } },
  { label: "Chip stores the letters", hint: `The chip drops each letter into its own little box. It has ${M.CHIP.outBuffer} boxes for letters going out, so ${M.MESSAGE.length} letters hardly fill it.`, sound: { word: "flip flip", at: SOUNDS.cabinet, from: 0.08, to: 0.8 } },
  { label: "Chip sets the speed", hint: `The phone asked for ${M.LINE.baud} bits a second. So the chip counts ${M.DIVISOR} ticks of its ${M.CHIP.baseHz / 1e6} MHz clock for every bit: one turn of the wheel, one bit.`, sound: { word: "tick", at: SOUNDS.lever, from: 0.88, to: 1.0 } },
  { label: "Bits leave on TX", hint: `One bit per turn, the letters leave on the white TX wire and blink the probe's light. ${M.MESSAGE.length} letters take ${TX_MS} ms: USB brought them ${FASTER} times faster.`, sound: { word: "blink blink", at: SOUNDS.probe, from: 0.05, to: 0.95 } },
  { label: "Bits come back on RX", hint: "After a pause the meter answers. Its light blinks back into the probe, and the green RX wire brings the bits in. The chip builds them into a letter: /", sound: { word: "blink", at: SOUNDS.probe, from: 0.05, to: 0.9 } },
  { label: "Chip packs a reply", hint: `A ${M.CHIP.latencyS * 1000} ms timer runs out. The chip packs the letter with ${M.CHIP.status.length} status bytes into a parcel, even though it is nearly empty.`, sound: { word: "ding!", at: SOUNDS.timer, from: 0.58, to: 0.85 } },
  { label: "Phone collects it", hint: `The phone asks “anything for me?” and the parcel zips back up the USB wires in ${millionths(M.IN_PACKET.seconds)} millionths of a second.`, sound: { word: "whoosh", at: SOUNDS.out, from: 0.35, to: 0.9 } },
].map((step, i) => ({ ...step, dur: durOf(i), real: realForBadge(i) }));

const vec = (p) => p.map((v) => +v.toFixed(3));
const live = `
${MODEL_SRC}
const P = ${JSON.stringify(P)};
const STEPS = ${JSON.stringify(STEPS)};
const MOVING = ${JSON.stringify(MOVING)};
const CART = ${JSON.stringify(CART)}, RACK_TOP = ${RACK.z1}, CARD = ${JSON.stringify(CARD)};
const HOLES_OUT = ${JSON.stringify([0, 1, 2, 3, 4].map((s) => vec(holeAt(CAB_OUT, s))))};
const HOLE_IN = ${JSON.stringify(vec(holeAt(CAB_IN, 0)))};
const TX_SPOT = ${JSON.stringify([TX_TRAY.x + TX_TRAY.w / 2, TX_TRAY.y + TX_TRAY.d / 2, TRAY_TOP])};
const RX_SPOT = ${JSON.stringify([RX_TRAY.x + RX_TRAY.w / 2, RX_TRAY.y + RX_TRAY.d / 2, TRAY_TOP])};
const STATUS_SPOTS = ${JSON.stringify([[TIMER.x + 4, TIMER.y + 9, TIMER_TOP], [TIMER.x + 8, TIMER.y + 9, TIMER_TOP]])};
const WHEEL = ${JSON.stringify(WHEEL)}, PINION = ${JSON.stringify(PINION)}, PAWL = ${JSON.stringify(PAWL)};
const CELL = ${JSON.stringify(CELL)};
const DIAL = ${JSON.stringify(DIAL)};
const svg = document.querySelector(".bk-card svg");
const q = (sel) => svg.querySelector(sel);
const part = (name) => q('[data-part="' + name + '"]');
const cartEl = part("cart"), cartLabel = part("cart-label");
const cardEls = Object.fromEntries([...svg.querySelectorAll("[data-card]")].map((el) => [el.dataset.card, el]));
const wires = { tx: [...svg.querySelectorAll('[data-wire="white"]')], rx: [...svg.querySelectorAll('[data-wire="green"]')] };
const cells = { tx: [...svg.querySelectorAll('[data-cell^="tx"]')], rx: [...svg.querySelectorAll('[data-cell^="rx"]')] };
const readers = { tx: part("tx-reader"), rx: part("rx-reader") };
const glyphs = { tx: part("tx-glyph"), rx: part("rx-glyph") };
const wheelRot = part("wheel-rot"), pinionRot = part("pinion-rot"), pawl = part("pawl"), blur = part("pinion-blur");
const countEl = part("count"), framesEl = part("frames"), hand = part("timer-hand"), glow = part("glow");
const scope = document.querySelector("[data-scope]");

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.min(1, Math.max(0, t));
const span = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a.map((v, j) => v + (b[j] - v) * t);
const arc = (a, b, t, h) => { const e = smooth(t); const p = lerp(a, b, e); p[2] += h * 4 * e * (1 - e); return p; };
const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
const setAttr = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };

const realAt = (i, p) => (i < 0 ? 0 : timeAt(i, Math.min(1, p / MOVING[i])));
const animAt = (i, p) => { let a = 0; for (let j = 0; j < i; j++) a += STEPS[j].dur; return i < 0 ? 0 : a + p * STEPS[i].dur; };

function cartX(i, p) {
  if (i === 0) return CART.entry + (CART.dock - CART.entry) * smooth(span(p, 0, 0.85));
  if (i === 6) return CART.dock + (CART.entry - CART.dock) * smooth(span(p, 0, 0.85));
  return i < 0 ? CART.entry : CART.dock;
}
function cartOpacity(i, p) {
  if (i === 0) return span(p, 0, 0.15);
  if (i === 1) return 1 - span(p, 0.85, 1);
  if (i === 5) return span(p, 0, 0.15);
  if (i === 6) return 1 - span(p, 0.8, 1);
  return 0;
}
const slotOf = (x, s, n) => [x + (s - (n - 1) / 2) * CARD.pitch, CART.y, RACK_TOP];

// Where each card is: [x, y, z] of its bottom centre and its opacity, or null when it is gone.
function messageCard(c, i, p, r) {
  const inCart = slotOf(cartX(i, p), c, 5);
  if (i < 1) return { at: inCart, o: cartOpacity(i, p) };
  if (i === 1) {
    const t = span(p, 0.06 + c * 0.13, 0.28 + c * 0.13);
    const hole = HOLES_OUT[c].slice(); hole[2] -= CARD.h / 2;
    if (c === 0 && p > 0.8) return { at: arc(hole, TX_SPOT, span(p, 0.8, 0.98), 14), o: 1 };
    return { at: t > 0 ? arc(inCart, hole, t, 16) : inCart, o: 1 };
  }
  const j = Math.floor((r - T.txStart) / CHAR_S), fr = (r - T.txStart) / CHAR_S - j;
  const hole = HOLES_OUT[c].slice(); hole[2] -= CARD.h / 2;
  if (r >= T.txEnd || c < j) return null;
  if (c === j) return { at: TX_SPOT, o: fr > 0.9 ? 1 - (fr - 0.9) / 0.1 : 1 };
  if (c === j + 1) return { at: fr > 0.62 ? arc(hole, TX_SPOT, span(fr, 0.62, 1), 14) : hole, o: 1 };
  return { at: hole, o: 1 };
}
function replyCard(i, p) {
  const hole = HOLE_IN.slice(); hole[2] -= CARD.h / 2;
  if (i < 4) return null;
  if (i === 4) return { at: RX_SPOT, o: span(p, 0.93, 1) };
  if (i === 5) {
    if (p < 0.25) return { at: arc(RX_SPOT, hole, span(p, 0.02, 0.25), 12), o: 1 };
    if (p < 0.74) return { at: hole, o: 1 };
    return { at: arc(hole, slotOf(CART.dock, 2, 3), span(p, 0.74, 0.98), 10), o: 1 };
  }
  return { at: slotOf(cartX(i, p), 2, 3), o: cartOpacity(i, p) };
}
function statusCard(s, i, p) {
  if (i < 5) return { at: STATUS_SPOTS[s], o: 1 };
  if (i === 5) return { at: arc(STATUS_SPOTS[s], slotOf(CART.dock, s, 3), span(p, 0.6 + s * 0.06, 0.8 + s * 0.06), 12), o: 1 };
  return { at: slotOf(cartX(i, p), s, 3), o: cartOpacity(i, p) };
}
function placeCard(el, state) {
  const o = state ? state.o : 0;
  el.style.opacity = o.toFixed(2);
  if (state && o > 0) setAttr(el, "transform", translateAlong(P, state.at));
}

function drawerCounts(i, p, r) {
  let out = 0;
  for (let c = 0; c < 5; c++) {
    if (i < 1) continue;
    if (i === 1) { if (p >= 0.28 + c * 0.13 && !(c === 0 && p > 0.8)) out++; continue; }
    const j = Math.floor((r - T.txStart) / CHAR_S), fr = (r - T.txStart) / CHAR_S - j;
    if (r < T.txEnd && c > j && !(c === j + 1 && fr > 0.62)) out++;
  }
  const back = i === 5 && p >= 0.25 && p < 0.74 ? 1 : 0;
  return { out, back };
}

function rows(i, p, r) {
  const line = i >= 2 && i <= 4 ? lineAt(r) : null;
  const tx = { code: null, index: -1 }, rx = { code: null, index: -1 };
  if (i === 1 && p > 0.98) tx.code = MESSAGE.charCodeAt(0);
  if (i >= 2 && r < T.txEnd) { const j = Math.min(4, Math.floor((r - T.txStart) / CHAR_S)); tx.code = MESSAGE.charCodeAt(j); tx.index = line && line.dir === "tx" ? line.index : -1; }
  if (i === 4) { rx.code = REPLY.charCodeAt(0); rx.index = line && line.dir === "rx" ? line.index : -1; rx.into = line ? line.into : 0; rx.done = p >= 1; }
  if (i === 5 && p < 0.25) { rx.code = REPLY.charCodeAt(0); rx.done = true; }
  for (const dir of ["tx", "rx"]) {
    const st = dir === "tx" ? tx : rx;
    const bits = st.code === null ? null : frameOf(st.code);
    cells[dir].forEach((el, j) => {
      let state = "idle";
      if (bits) {
        const shown = dir === "tx" || st.done || j < st.index || (j === st.index && st.into >= 0.5);
        if (shown) state = bits[j] ? "one" : "zero";
        if (dir === "tx" && st.index >= 0 && j < st.index) state += "-sent";
        if (j === st.index) state += "-now";
      }
      setAttr(el, "data-state", state);
    });
    const glyph = bits && (dir === "tx" || st.done) ? show(String.fromCharCode(st.code)) : "";
    setText(glyphs[dir], glyph);
    const rd = readers[dir];
    if (st.index >= 0) { rd.style.opacity = "1"; setAttr(rd, "transform", "translate(" + (CELL.u0 + st.index * CELL.pitch + CELL.w / 2).toFixed(2) + " 0)"); }
    else rd.style.opacity = "0";
  }
  return line;
}

function gears(i, p, r) {
  const turns = (r * CHIP.baseHz) / DIVISOR;
  setAttr(wheelRot, "transform", "rotate(" + ((turns % 1) * 360).toFixed(2) + " " + WHEEL.x + " " + (-WHEEL.z) + ")");
  const since = turns - Math.floor(turns);
  const kick = i >= 2 && turns >= 1 ? Math.exp(-since * 16) : 0;
  setAttr(pawl, "transform", "rotate(" + (-kick * 22).toFixed(2) + " " + PAWL.u + " " + (-PAWL.z) + ")");
  const spin = i < 0 ? 0 : animAt(i, p) * 900;
  setAttr(pinionRot, "transform", "rotate(" + (-(spin % 360)).toFixed(1) + " " + PINION.x + " " + (-PINION.z) + ")");
  blur.style.opacity = i < 0 ? "0" : "1";
  setText(countEl, String(i < 0 ? 0 : countAt(r)).padStart(5, "0"));
  setText(framesEl, String(i < 0 ? 0 : framesAt(r)).padStart(4, "0"));
}

function timer(i, p) {
  const ms = i === 5 ? 16 * span(p, 0, 0.6) * (1 - span(p, 0.62, 0.74)) : 0;
  const a = ((ms / 16) * 1.7 - 0.85) * 180;
  setAttr(hand, "transform", "rotate(" + a.toFixed(2) + " " + DIAL.u + " " + (-DIAL.z) + ")");
  return i === 5 ? 16 * span(p, 0, 0.6) : i > 5 ? 16 : 0;
}

const BITNAMES = ["S", "0", "1", "2", "3", "4", "5", "6", "P", "E"];
function scopeHtml(line, r) {
  const W = 300, cell = W / 10, H = 46;
  const bits = line ? frameOf(line.code) : Array(10).fill(1);
  let wave = "M0 16", fills = "", labels = "", frames = "";
  bits.forEach((b, j) => {
    wave += "V" + (b ? 16 : 40) + "H" + (j + 1) * cell;
    if (!b) fills += '<rect x="' + j * cell + '" y="14" width="' + cell + '" height="28" class="sc-on' + (line && j === line.index ? " sc-now" : "") + '"/>';
    else if (line && j === line.index) fills += '<rect x="' + j * cell + '" y="14" width="' + cell + '" height="28" class="sc-now-dark"/>';
    labels += '<text x="' + (j + 0.5) * cell + '" y="' + (H + 8) + '">' + BITNAMES[j] + "</text>";
  });
  const perFrame = W / (CHAR_S / USB.frameS);
  for (let x = 0; x <= W + 0.01; x += perFrame) frames += "M" + x.toFixed(1) + " 2V8";
  const ch = line ? show(String.fromCharCode(line.code)) : "—";
  const who = line ? (line.dir === "tx" ? "chip → probe (TX)" : "probe → chip (RX)") : "line resting";
  return '<svg viewBox="-4 0 ' + (W + 8) + " " + (H + 14) + '" class="sc-svg" aria-hidden="true"><path class="sc-frames" d="' + frames + '"/>' + fills + '<path class="sc-wave" d="' + wave + '"/>' + labels + "</svg>" +
    '<div class="sc-meta"><b>' + ch + "</b><span>" + (line ? "0x" + hex(line.code) : "") + "</span><span>" + who + "</span><span>" + (line ? LINE.baud + " baud" : "") + "</span></div>";
}

let lastScope = "";
function pose(i, p) {
  const r = realAt(i, p);
  const x = cartX(i, p);
  setAttr(cartEl, "transform", translateAlong(P, [x - CART.dock, 0, 0]));
  cartEl.style.opacity = cartOpacity(i, p).toFixed(2);
  setText(cartLabel, i >= 5 ? "DATA1" : "DATA0");
  for (let c = 0; c < 5; c++) placeCard(cardEls["m" + c], messageCard(c, i, p, r));
  placeCard(cardEls.r0, replyCard(i, p));
  placeCard(cardEls.s0, statusCard(0, i, p));
  placeCard(cardEls.s1, statusCard(1, i, p));
  const line = rows(i, p, r);
  const low = !!line && line.value === 0;
  wires.tx.forEach((w) => w.toggleAttribute("data-lit", low && line.dir === "tx"));
  wires.rx.forEach((w) => w.toggleAttribute("data-lit", low && line.dir === "rx"));
  glow.style.opacity = low ? "1" : "0";
  gears(i, p, r);
  timer(i, p);
  const html = scopeHtml(line, r);
  if (html !== lastScope) { scope.innerHTML = html; lastScope = html; }
}

function chips(i, p) {
  const r = realAt(i, p);
  const { out, back } = drawerCounts(i, p, r);
  const sent = i >= 3 || (i === 2 && p >= 1) ? lettersSent(r) : 0;
  const parcel = i <= 1 ? show(MESSAGE) + " · " + OUT_PACKET.bits + " bits · " + fmtTime(OUT_PACKET.seconds) : i >= 5 ? IN_PACKET.bytes.map((b, j) => (j < 2 ? hex(b) : String.fromCharCode(b))).join(" ") + " · " + IN_PACKET.bits + " bits · " + fmtTime(IN_PACKET.seconds) : "—";
  const ms = i === 5 ? 16 * span(p, 0, 0.6) : i > 5 ? 16 : 0;
  return [
    { k: "Parcel", v: parcel, hot: i === 0 || i === 6 },
    { k: "Out boxes", v: out + " of " + CHIP.outBuffer, hot: i === 1 },
    { k: "Speed", v: (CHIP.baseHz / 1e6) + " MHz ÷ " + DIVISOR + " = " + LINE.baud + " baud", hot: i === 2 },
    { k: "Sent on TX", v: sent + " of " + MESSAGE.length + " letters, " + (CHAR_S * 1000).toFixed(1) + " ms each", hot: i === 3 },
    { k: "Reply boxes", v: back + " of " + CHIP.inBuffer, hot: i === 4 || (i === 5 && back > 0) },
    { k: "Timer", v: ms.toFixed(1) + " of " + (CHIP.latencyS * 1000) + " ms", hot: i === 5 },
    { k: "USB frames", v: (i < 0 ? 0 : framesAt(r)) + " × 1 ms" },
    { k: "Real time", v: fmtTime(r) },
  ];
}

const swatches = [...document.querySelectorAll("[data-swatch]")];
swatches.forEach((b) => b.addEventListener("click", () => {
  swatches.forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
  const [top, mid, dark] = b.dataset.swatch.split(",");
  svg.style.setProperty("--k-top", top); svg.style.setProperty("--k-mid", mid); svg.style.setProperty("--k-dark", dark);
}));

mountStepper({
  key: "probe-fig4",
  svg,
  steps: STEPS,
  intro: "Press step 1. Watch the letters arrive in a flash and leave one bit at a time.",
  outro: "Done! USB brought ${M.MESSAGE.length} letters in ${M.OUT_PACKET.seconds * 1e6 < 10 ? (M.OUT_PACKET.seconds * 1e6).toFixed(1) : Math.round(M.OUT_PACKET.seconds * 1e6)} µs; the line took ${TX_MS} ms to send them.",
  pose,
  chips,
});
`;

const css = `
.c-machine{--anatomy-paper:var(--k-mid,#4fb3a2);--anatomy-top:var(--k-top,#93d9c9);--anatomy-face:var(--k-top,#93d9c9);--anatomy-shade-3:var(--k-mid,#4fb3a2);--anatomy-shade-2:var(--k-mid,#4fb3a2);--anatomy-shade-1:var(--k-dark,#378a7c);--anatomy-shade-0:var(--k-dark,#378a7c)}
.c-brown{--anatomy-paper:#a8794a;--anatomy-top:#c99a66;--anatomy-face:#c99a66;--anatomy-shade-3:#a8794a;--anatomy-shade-2:#a8794a;--anatomy-shade-1:#86592f;--anatomy-shade-0:#86592f}
.pc-trace{fill:none;stroke-width:2.2px;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.pc-pad{fill:#e2b85a;stroke:#9c7a2c;stroke-width:.6px}
.pc-die{fill:#cfd6df;stroke:none}
.pc-mark{font-family:var(--font-mono);font-weight:700;fill:#cfd3dc;letter-spacing:.04em}
.cb-hole{fill:#2b3247;stroke:none}
.cb-plate{fill:#f2d37f;stroke:var(--ink);stroke-width:.7px}
.cb-plate-text{font-family:var(--font-mono);font-weight:700;fill:var(--ink)}
.cr-label{font-family:var(--font-mono);font-weight:700;fill:#fff6dc}
.dp-window{fill:#1f2a44;stroke:var(--ink);stroke-width:.8px}
.dp-digits{font-family:var(--font-mono);font-weight:700;fill:#9ff0c0;letter-spacing:.06em}
.dp-engrave{font-family:var(--font-mono);font-weight:700;fill:var(--ink);opacity:.72}
.dp-faint{opacity:.5}
.sh-cell{fill:#fbf3e2;stroke:var(--ink);stroke-width:.7px;transition:fill .06s}
.sh-cell[data-state^="zero"]{fill:var(--ir)}
.sh-cell[data-state^="one"]{fill:#fff8e6}
.sh-cell[data-state$="-sent"]{opacity:.38}
.sh-cell[data-state$="-now"]{stroke-width:1.6px}
.sh-name{font-family:var(--font-mono);font-weight:700;fill:var(--ink);opacity:.62}
.sh-glyph{font-family:var(--font-mono);font-weight:700;fill:#9ff0c0}
.sh-reader{fill:var(--ink);stroke:none}
.tm-face{fill:#fff8e6;stroke:var(--ink);stroke-width:.9px}
.tm-ticks{fill:none;stroke:var(--ink);stroke-width:.7px}
.tm-num{font-family:var(--font-mono);font-weight:700;fill:var(--ink);opacity:.7}
.tm-hand{fill:none;stroke:#e0644f;stroke-width:1.4px;stroke-linecap:round}
.tm-hub{fill:var(--ink)}
.gr-gear{fill:#f2d37f;stroke:var(--ink);stroke-width:.9px;stroke-linejoin:round}
.gr-pinion{fill:#eef2f6;stroke:var(--ink);stroke-width:.9px;stroke-linejoin:round}
.gr-ring{fill:#dcb14e;stroke:var(--ink);stroke-width:.7px}
.gr-spokes-w{fill:none;stroke:#b48a2f;stroke-width:2.2px;stroke-linecap:round}
.gr-pointer{fill:none;stroke:#e0644f;stroke-width:1.8px;stroke-linecap:round}
.gr-cam{fill:#e0644f;stroke:var(--ink);stroke-width:.7px}
.gr-hub{fill:#c9d1db;stroke:var(--ink);stroke-width:.8px}
.gr-hub-dot{fill:var(--ink)}
.gr-arm{fill:none;stroke:var(--ink);stroke-width:1.6px;stroke-linecap:round}
.gr-spokes{fill:none;stroke:var(--ink);stroke-width:.9px}
.gr-blur{fill:rgba(201,209,219,.75);stroke:none;opacity:0}
.cd-letter{fill:#fffdf6;stroke:var(--ink);stroke-width:.8px}
.cd-status{fill:#cfd6df;stroke:var(--ink);stroke-width:.8px}
.cd-glyph{font-family:var(--font-mono);font-weight:700;fill:var(--ink)}
.pb-wire{fill:none;stroke-width:1.2px;stroke-linecap:round}
svg path[data-wire="red"]{stroke:#e0644f}svg path[data-wire="black"]{stroke:#1f2a44}svg path[data-wire="white"]{stroke:#b9b2a0}svg path[data-wire="green"]{stroke:#3f9a60}
svg path[data-wire][data-lit]{stroke:#f2b400;filter:drop-shadow(0 0 1.5px #ffd84a)}
.pb-cable-out{fill:none;stroke:var(--ink);stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important}
.pb-cable-in{fill:none;stroke:#474e62;stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important}
.pb-cable-shine{fill:none;stroke:#7a8299;stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important;transform:translate(-.6px,-.7px)}
.pr-glow{fill:none;stroke:var(--ir);stroke-width:5px;filter:blur(2px)}
.bk-scope{display:grid;gap:6px}
.sc-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px}
.sc-svg{width:min(360px,100%);height:auto;display:block}
.sc-wave{fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round}
.sc-frames{fill:none;stroke:var(--ink-soft);stroke-width:1}
.sc-on{fill:var(--ir-soft)}
.sc-now{fill:rgba(226,73,91,.5)}
.sc-now-dark{fill:rgba(31,42,68,.12)}
.sc-svg text{font:700 10px var(--font-mono);fill:var(--ink-soft);text-anchor:middle}
.sc-meta{display:grid;gap:2px;min-width:150px;font-size:13px;color:var(--ink-soft);font-weight:700}
.sc-meta b{font:800 26px/1 var(--font-mono);color:var(--ink)}
.bk-scope p{margin:0;font-size:13px;color:var(--ink-soft);font-weight:700}
`;

const extras = `
<div class="bk-panel bk-scope"><div class="sc-row" data-scope></div><p>The letter on the serial line right now. Light on = 0, so the line rests at 1. The little ticks on top are USB frames, 1 ms each: one letter at ${M.LINE.baud} baud lasts ${(M.CHAR_S / M.USB.frameS).toFixed(1)} of them.</p></div>
<div class="bk-extras">
  <div class="bk-swatches">Machine colour
    <button class="bk-swatch" type="button" aria-label="Teal" aria-pressed="true" data-swatch="#93d9c9,#4fb3a2,#378a7c" style="background:#4fb3a2"></button>
    <button class="bk-swatch" type="button" aria-label="Blue" aria-pressed="false" data-swatch="#8fb7ea,#5f8fd0,#4370b0" style="background:#5f8fd0"></button>
    <button class="bk-swatch" type="button" aria-label="Orange" aria-pressed="false" data-swatch="#f6b77a,#e58c43,#bf6a26" style="background:#e58c43"></button>
    <button class="bk-swatch" type="button" aria-label="Plum" aria-pressed="false" data-swatch="#cfb0e3,#a07bc0,#7c5a9c" style="background:#a07bc0"></button>
  </div>
</div>`;

const us = (s) => (s * 1e6).toFixed(2) + " µs";
const sources = [
  `Buffers: the <a href="https://ftdichip.com/wp-content/uploads/2020/08/DS_FT232R.pdf" target="_blank" rel="noopener">FT232R datasheet</a> (v2.15, section 4.2) gives a 128-byte “FIFO RX buffer” for data from the USB OUT endpoint on its way to the UART transmitter, and a 256-byte “FIFO TX buffer” for data from the UART receiver to the USB IN endpoint. The names are seen from the USB side, so the 128 boxes feed the TX wire. The 2005 datasheet (v1.04) lists the two sizes the other way round.`,
  `Speed: “Baud Rate = 3000000 / (n + x)”, n an integer from 2 to 16384 and x a multiple of 0.125 (datasheet section 4.2; the 3 MHz is the 48 MHz clock divided by 16). So ${M.LINE.baud} baud is ÷${M.DIVISOR} and ${M.LINE.fastBaud} baud is ÷${M.FAST_DIVISOR}, from the same clock (computed here, matching the Linux driver's <code>ftdi_232bm_baud_base_to_divisor</code>).`,
  `USB: full speed, 12 Mbit/s (datasheet); a start-of-frame every 1 ms ± 500 ns; 8-bit SYNC, 8-bit PID, CRC16 and EOP in a data packet; bulk packets up to 64 bytes at full speed (<a href="https://www.beyondlogic.org/usbnutshell/usb3.shtml" target="_blank" rel="noopener">USB in a NutShell</a>, chapters 3 and 4). A 0 is stuffed after six 1s (USB 2.0, section 7.1.9). Counted here: the phone's packet is ${M.OUT_PACKET.bits} bits with ${M.OUT_PACKET.stuffed} stuffed (${us(M.OUT_PACKET.seconds)}), the reply ${M.IN_PACKET.bits} bits (${us(M.IN_PACKET.seconds)}). The token and handshake packets around them are left out, and DATA0 out, DATA1 back is an assumption: the toggle depends on what came before.`,
  `Latency timer: 16 ms by default; when it runs out the chip sends its 2 status bytes and whatever data it holds; with 62 bytes waiting it sends at once (FTDI AN232B-04, and the comment in the Linux <code>ftdi_sio.h</code>). The timer counts from the last packet the chip sent, so the real wait after a letter lands is anywhere from 0 to 16 ms; the figure shows the longest. At ${M.LINE.baud} baud a letter takes ${(M.CHAR_S * 1000).toFixed(1)} ms, longer than the timer, so each letter of the meter's reply travels to the phone in a parcel of its own.`,
  `Status bytes <code>01 60</code>: byte 0 bit 0 is always 1; byte 1 bits 5 and 6 say the transmitter is empty (Linux <code>ftdi_sio.h</code>). <code>01 60</code> assumes the CTS, DSR, RI and DCD lines are all off, which is likely on this probe but not checked.`,
  `${M.LINE.baud} baud 7E1 (10 bits a letter), light on = 0, the meter's 200 ms pause and its reply “/WPA5WM-ULTRA-15” come from figure 1 (IEC 62056-21 mode C; the meter is invented there). Only its first letter is shown arriving.`,
  `Simplified: the chip's bit counter runs all the time and the figure starts the first bit right after the packet; the real chip starts it within 1/16 of a bit, on its 16× clock. Letters moving between boxes and the trays are drawn slowly but take no real time. Pins: TXD is pin 1, RXD pin 5, USBDP and USBDM pins 15 and 16 on the 28-pin FT232RL (datasheet section 3); the rails, wheel and cabinets are a picture of what the chip does, not of its silicon.`,
];

const page = bookPage({
  fig: "Fig 4",
  title: "The chip in the plug",
  question: "How does the FT232 chip turn USB into blinking serial bits?",
  label: "The FT232R chip drawn as a little mailroom inside the opened USB-C plug. Use the step buttons to play each step.",
  svg,
  extras,
  idea: "The big idea: <em>the chip is a translator with a bucket: USB pours letters in a millisecond at a time, and the chip lets them out one bit at a time at the speed you chose.</em>",
  sources,
  css,
  script: kitScript() + "\n" + live,
});

writeFileSync(join(HERE, "index.html"), page);
console.log("wrote index.html", (page.length / 1024).toFixed(0) + " KB", "steps", STEPS.map((s) => s.dur).join(" + "), "=", STEPS.reduce((a, s) => a + s.dur, 0).toFixed(2), "tour", (0.9 + STEPS.reduce((a, s) => a + s.dur, 0) + 0.7 * (STEPS.length - 1) + 1.6).toFixed(2));
