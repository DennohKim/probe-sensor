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
const SOL = M.solve();

const WIDTH = 640;
const HEIGHT = 370;

// World in millimetres: x to the right and back, y toward the front, z up. The cutting mat's top is Z0.
const PLATE = { x: -165, y: -115, w: 330, d: 228, r: 10 };
const PLATE_H = 9;
const FOOT_H = 6;
const MAT = { x: -156, y: -107, w: 312, d: 212, r: 6 };
const Z0 = 1.5;

// The test stand: a mirror on the mat inside a printed riser, a steel washer on top, standing in for a meter's port.
const ST = { x: -10, y: -50 };
const MIR = { r: M.MIRROR.dia / 2, z0: Z0, z1: Z0 + M.MIRROR.t };
const RISER = { ro: 15, ri: 11, z0: Z0, z1: MIR.z1 + SOL.gap - M.WASHER.t };
const WASH = { ri: M.WASHER.id / 2, ro: M.WASHER.od / 2, z0: RISER.z1, z1: RISER.z1 + M.WASHER.t };
const FACE = WASH.z1;
const W = 12.5;

// The probe, built at its place on the stand. Heights are measured up from its face.
const CUPR = { ro: M.CUP.od / 2, ri: M.CUP.id / 2, h: M.CUP.h, floor: M.CUP.floor };
const BOSS = { r: 6, h: 4.4 };
const MAG = { ro: M.PORT.magnet.od / 2, ri: M.PORT.magnet.id / 2, z0: CUPR.floor, z1: CUPR.floor + M.PORT.magnet.h };
const PCB = { r: M.BOARD.dia / 2, z0: M.BOARD.at, z1: M.BOARD.at + M.BOARD.t };
const CAPZ = { z0: CUPR.h, z1: CUPR.h + M.CAP.h, boot: M.CAP.boot, bootR: M.CAP.bootR };
const HALF = M.PORT.spacing / 2;
const LEDX = -HALF, PTX = HALF;
const CHIP = M.SENSOR.chipDepth;

const PRINT = { cup: [-118, -70], cap: [-86, -40] };
const SHEET = { x: -142, y: -94, w: 74, d: 74, r: 3 };
const SHEET_Z = Z0 + 0.8;
const CUP_MOVE = [ST.x - PRINT.cup[0], ST.y - PRINT.cup[1], FACE - SHEET_Z];
const CAP_MOVE = [ST.x - PRINT.cap[0], ST.y - PRINT.cap[1], FACE + CAPZ.z0 - SHEET_Z];

const PHONE = { x: -6, y: 31, w: 146, d: 70, r: 10, h: 7.6 };
const SCREEN = { x: PHONE.x + 4, y: PHONE.y + 3.6, w: PHONE.w - 8, d: PHONE.d - 7.2, r: 7 };
const CAMERA = [PHONE.x + PHONE.w - 9, PHONE.y + PHONE.d / 2];
const HOVER = [CAMERA[0] - ST.x, CAMERA[1] - ST.y, PHONE.h + 22 - FACE];

const FT = { x: -106, y: 57, w: 34, d: 17, r: 1.2, t: 1.6 };
const FTZ = Z0 + 2.2;
const USBC = { x: FT.x + FT.w - 6.2, y: FT.y + FT.d / 2 - 4.5, w: 7.4, d: 9, z0: FTZ + FT.t, h: 3.2 };
const OTG = { x0: FT.x + FT.w + 1.2, x1: PHONE.x - 1, y: PHONE.y + PHONE.d / 2, z: PHONE.h / 2, unplug: -14 };
const TRAY = { x: -150, y: -8, w: 66, d: 46, r: 4, h: 8 };
const FOAM = { x: TRAY.x + 4, y: TRAY.y + 4, w: 26, d: 17, r: 2 };
const GLUE = { x: 96, y: -40 };

const IRON_DIR = G.unit3([0.6, -0.56, 0.57]);
const STAND_IRON = { x: 66, y: -94 };
const IRON_REST = [STAND_IRON.x - 6, STAND_IRON.y + 20, Z0 + 15];
const IRON_LEN = 98;
const LENS_CENTRE = [ST.x + 2, ST.y, FACE + 10];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), G.add3(IRON_REST, G.mul3(IRON_DIR, IRON_LEN + 10)), [ST.x, ST.y, FACE + 70], [CAMERA[0], CAMERA[1], PHONE.h + 22 + 40]],
  WIDTH,
  HEIGHT,
  { pad: 12, azimuth: 52 },
);
const SCALE = G.scaleOf(P);
const VIEW = G.viewOf(P);
const RIGHT = (() => {
  const a = (P.azimuth * Math.PI) / 180;
  const u = [Math.sin(a), -Math.cos(a), 0];
  return k.iso(u, P)[0] > k.iso([0, 0, 0], P)[0] ? u : [-u[0], -u[1], 0];
})();
const LENS = { mag: 2.0, r: 72, rim: 6, out: 90 };
LENS.at = G.add3(LENS_CENTRE, G.mul3(VIEW, LENS.out));
LENS.rWorld = (LENS.r + LENS.rim) / SCALE;
const ARM_ROOT = G.add3(LENS.at, G.mul3(RIGHT, LENS.rWorld));
const POST = { x: ARM_ROOT[0] + RIGHT[0] * 14, y: ARM_ROOT[1] + RIGHT[1] * 14, r: 2.6, top: LENS.at[2] };

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const C = (name, svg) => `<g class="c-${name}">${svg}</g>`;
const f = (n) => +n.toFixed(2);
const xAxis = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const yAxis = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
const zAxis = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const facePlane = (y) => k.sideMatrix([0, y], 0, P, "left");
const halo = (plan, z, h = 3) => `<path class="iso-halo" d="${k.haloOf(plan, z, h, P)}"/>`;

// Faces in the cut plane y = ST.y, drawn in (x, -z).
const R = (x0, z0, x1, z1) => `M${f(x0)} ${f(-z0)}H${f(x1)}V${f(-z1)}H${f(x0)}Z`;
const RR = (x0, z0, x1, z1, r) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 4).map(([u, v]) => [u, -v]), true);
const dome = (cx, zBase, zTip, w, down) => {
  const hw = w / 2;
  const shoulder = down ? zTip + hw : zTip - hw;
  return `M${f(cx - hw)} ${f(-zBase)}V${f(-shoulder)}A${f(hw)} ${f(hw)} 0 0 ${down ? 0 : 1} ${f(cx + hw)} ${f(-shoulder)}V${f(-zBase)}Z`;
};

const arc = (cx, cy, r, a0, a1, steps = 24) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / steps;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const halfDisc = (cx, cy, r, steps = 40) => arc(cx, cy, r, Math.PI, Math.PI * 2, steps);
const halfRing = (cx, cy, ro, ri, steps = 40) => [...arc(cx, cy, ro, Math.PI, Math.PI * 2, steps), ...arc(cx, cy, ri, Math.PI * 2, Math.PI, steps)];

// The front piece of a ring left beside the window: y > cy and |x - cx| > W.
function sliver(cx, cy, ro, ri, side) {
  const ao = Math.acos(W / ro);
  const out = arc(0, 0, ro, 0, ao, 12);
  const pts = [...out];
  if (ri > W) {
    const ai = Math.acos(W / ri);
    pts.push(...arc(0, 0, ri, ai, 0, 8));
  } else {
    pts.push([W, 0]);
  }
  return pts.map(([x, y]) => [cx + side * x, cy + y]);
}

// A turned part cut by the window: back half, then (after the section is drawn) the two front pieces.
function cutBack(cx, cy, ro, ri, z0, h, cls, opts = {}) {
  const ring = ri > 0 ? halfRing(cx, cy, ro, ri, 40) : halfDisc(cx, cy, ro, 48);
  return C(cls, S(k.extrude(ring, z0, h, P, { convex: ri <= 0, bevel: opts.bevel ?? 0 }), { tone: "hi", crease: "none", inner: opts.inner ?? "" }));
}
function cutFront(cx, cy, ro, ri, z0, h, cls) {
  return C(cls, S(k.extrude(sliver(cx, cy, ro, ri, -1), z0, h, P, { convex: false }), { tone: "hi", crease: "none" }));
}

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = k.corners(PLATE, 24).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) out.push(C("wood", S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, P, 28), { tone: "hi" })));
  out.push(C("wood", S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "hi", inner: L(k.sideSeam(PLATE, -PLATE_H / 2, P, 8), { tone: "faint" }) })));
  const screws = k.corners(PLATE, 6);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55, tone: "mid" }));
  out.push(C("mat", S(k.slabOf(MAT, 0, Z0, P, 6), { tone: "hi" })));
  const grid = [];
  for (let x = MAT.x + 16; x < MAT.x + MAT.w - 4; x += 16) grid.push(k.lineOnTop([x, MAT.y], [x, MAT.y + MAT.d], Z0, P));
  for (let y = MAT.y + 16; y < MAT.y + MAT.d - 4; y += 16) grid.push(k.lineOnTop([MAT.x, y], [MAT.x + MAT.w, y], Z0, P));
  out.push(`<g class="mat-grid">${L(grid.join(""), { tone: "faint" })}</g>`);
  const strip = { x: MAT.x + 10, y: MAT.y + MAT.d - 9, w: MAT.w - 20, d: 6, r: 1 };
  out.push(L(k.planOutline(strip, Z0, P, 3), { tone: "lo" }));
  const t = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 4, 5, strip.y, Z0, [1.6, 3.4], P);
  out.push(L(t.minor, { tone: "lo" }) + L(t.major, { tone: "mid" }));
  return out.join("");
}

function printSheet() {
  const out = [halo(SHEET, Z0, 1)];
  out.push(C("pei", S(k.slabOf(SHEET, Z0, 0.8, P, 4, 0.4), { tone: "hi", crease: "none" })));
  const tab = { x: SHEET.x + SHEET.w / 2 - 9, y: SHEET.y + SHEET.d - 1, w: 18, d: 7, r: 3 };
  out.push(C("pei", S(k.slabOf(tab, Z0, 0.8, P, 4), { tone: "hi", crease: "none" })));
  out.push(L(k.ring(tab.x + 9, tab.y + 4, 1.6, SHEET_Z, P, 16), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(SHEET, 3), SHEET_Z, P, 3), { tone: "faint" }));
  return out.join("");
}

// The cup and the cap as they come off the printer, rebuilt live while they grow.
const printing = () => `<g data-part="print-cup"></g><g data-part="print-cap"></g>`;

function testStand() {
  const { x, y } = ST;
  const out = [halo({ x: x - 16, y: y - 16, w: 32, d: 32, r: 16 }, Z0, 2)];
  out.push(cutBack(x, y, MIR.r, 0, MIR.z0, M.MIRROR.t, "glass", { bevel: 0.4 }));
  out.push(cutBack(x, y, RISER.ro, RISER.ri, RISER.z0, RISER.z1 - RISER.z0, "teal"));
  out.push(cutBack(x, y, WASH.ro, WASH.ri, WASH.z0, M.WASHER.t, "chrome"));
  const parts = [
    `<path class="bx-glass" d="${R(x - MIR.r, MIR.z0, x + MIR.r, MIR.z1 - 0.5)}"/>`,
    `<path class="bx-silver" d="${R(x - MIR.r, MIR.z1 - 0.5, x + MIR.r, MIR.z1)}"/>`,
    `<path class="bx-print bx-teal" d="${R(x - W, RISER.z0, x - RISER.ri, RISER.z1)}"/>`,
    `<path class="bx-print bx-teal" d="${R(x + RISER.ri, RISER.z0, x + RISER.ro, RISER.z1)}"/>`,
    `<path class="bx-steel" d="${R(x - W, WASH.z0, x - WASH.ri, WASH.z1)}"/>`,
    `<path class="bx-steel" d="${R(x + WASH.ri, WASH.z0, x + WASH.ro, WASH.z1)}"/>`,
  ];
  out.push(`<g transform="${facePlane(y)}" class="bx">${parts.join("")}</g>`);
  out.push(`<g data-part="beam" transform="${facePlane(y + 0.04)}"></g>`);
  return out.join("");
}
function testStandFront() {
  const { x, y } = ST;
  return cutFront(x, y, RISER.ro, RISER.ri, RISER.z0, RISER.z1 - RISER.z0, "teal") + cutFront(x, y, WASH.ro, WASH.ri, WASH.z0, M.WASHER.t, "chrome");
}

// The probe on the stand. Everything inside the cup is drawn in the cut plane; data-show names the step it appears in.
function cupBody() {
  const { x, y } = ST;
  const z = FACE;
  const out = [];
  out.push(cutBack(x, y, CUPR.ro, CUPR.ri, z, CUPR.h, "pla", { bevel: 0.6, inner: L(k.sideArc(x, y, CUPR.ro, z + CUPR.h - 3, P, 30), { tone: "faint" }) }));
  out.push(cutBack(x, y, CUPR.ri, 0, z, CUPR.floor, "pla"));
  out.push(cutBack(x, y, BOSS.r, 0, z + CUPR.floor, BOSS.h - CUPR.floor, "pla"));
  out.push(`<g data-show="magnet">${cutBack(x, y, MAG.ro, MAG.ri, z + MAG.z0, MAG.z1 - MAG.z0, "magnet")}</g>`);
  out.push(`<g data-show="board">${cutBack(x, y, PCB.r, 0, z + PCB.z0, M.BOARD.t, "pcb")}</g>`);
  out.push(`<g transform="${facePlane(y)}" class="bx">${cupSection()}</g>`);
  out.push(cutFront(x, y, CUPR.ro, CUPR.ri, z, CUPR.h, "pla"));
  return out.join("");
}

const BAND_FILL = { black: "#1f2a44", brown: "#8a5a2b", red: "#d8483a", orange: "#ee8a2c", yellow: "#f2cf3a", green: "#3f9a60", blue: "#3f6fd0", violet: "#8a5cc0", grey: "#9aa0ab", white: "#fbf7ee", gold: "#c9a227" };

// A standing resistor: body with four bands, the lower lead into the board, the upper one bent over and down.
function resistor(cx, z0, hairpinTo, name) {
  const top = z0 + 1 + 3.6;
  const body = RR(cx - 0.8, z0 + 1, cx + 0.8, top, 0.7);
  const bands = [0, 1, 2, 3].map((i) => `<path class="bx-band" data-band="${name}-${i}" d="${R(cx - 0.8, z0 + 1.5 + i * 0.75, cx + 0.8, z0 + 1.95 + i * 0.75)}"/>`).join("");
  const lead = `M${f(cx)} ${f(-(z0 - 0.4))}V${f(-(z0 + 1))}M${f(cx)} ${f(-top)}V${f(-(top + 0.9))}Q${f(cx)} ${f(-(top + 1.9))} ${f((cx + hairpinTo) / 2)} ${f(-(top + 1.9))}Q${f(hairpinTo)} ${f(-(top + 1.9))} ${f(hairpinTo)} ${f(-(top + 0.9))}V${f(-(z0 + 0.6))}`;
  return `<path class="bx-lead" d="${lead}"/><path class="bx-resistor" d="${body}"/>${bands}`;
}

function cupSection() {
  const z = FACE, x = ST.x;
  const bz = z + PCB.z0, tz = z + PCB.z1;
  const top = z + CUPR.h;
  const hole = M.CUP.hole / 2;
  const parts = [];
  parts.push(`<path class="bx-print" d="${R(x - W, z, x - BOSS.r, z + CUPR.floor)}"/>`, `<path class="bx-print" d="${R(x + BOSS.r, z, x + CUPR.ri, z + CUPR.floor)}"/>`, `<path class="bx-print" d="${R(x + CUPR.ri, z, x + CUPR.ro, top)}"/>`);
  parts.push(`<path class="bx-print" d="${R(x - BOSS.r, z, x + LEDX - hole, z + BOSS.h)}"/>`, `<path class="bx-print" d="${R(x + LEDX + hole, z, x + PTX - hole, z + BOSS.h)}"/>`, `<path class="bx-print" d="${R(x + PTX + hole, z, x + BOSS.r, z + BOSS.h)}"/>`);
  parts.push(`<path class="bx-hole" d="${R(x + LEDX - hole, z, x + LEDX + hole, z + BOSS.h)}"/>`, `<path class="bx-hole" d="${R(x + PTX - hole, z, x + PTX + hole, z + BOSS.h)}"/>`);
  parts.push(`<g data-show="magnet"><path class="bx-magnet" d="${R(x - W, z + MAG.z0, x - MAG.ri, z + MAG.z1)}"/><path class="bx-magnet" d="${R(x + MAG.ri, z + MAG.z0, x + MAG.ro, z + MAG.z1)}"/><path class="bx-glue" d="${R(x - MAG.ri - 2.6, z + MAG.z0 - 0.01, x - MAG.ri - 1, z + MAG.z0 + 0.35)}"/><path class="bx-glue" d="${R(x + MAG.ri + 1, z + MAG.z0 - 0.01, x + MAG.ri + 2.6, z + MAG.z0 + 0.35)}"/></g>`);
  const leads = (cx) => `M${f(cx - 1.27)} ${f(-(z + BOSS.h + 1))}V${f(-(tz + 0.7))}M${f(cx + 1.27)} ${f(-(z + BOSS.h + 1))}V${f(-(tz + 0.7))}`;
  const part = (cx, cls, name) => `<g data-show="${name}"><path class="bx-lead" d="${leads(cx)}"/><path class="${cls}" data-part="${name}-body" d="${dome(cx, z + BOSS.h, z, 3, true)}"/><path class="${cls}" d="${RR(cx - 1.9, z + BOSS.h, cx + 1.9, z + BOSS.h + 1, 0.3)}"/><path class="bx-chip" d="${R(cx - 0.45, z + CHIP - 0.15, cx + 0.45, z + CHIP + 0.25)}"/></g>`;
  parts.push(part(x + LEDX, "bx-led", "led"), part(x + PTX, "bx-pt", "sensor"));
  const board = [
    `<path class="bx-pcb" d="${R(x - PCB.r, bz, x + PCB.r, tz)}"/>`,
    `<path class="bx-copper" data-current="tx" d="${R(x - 5.6, bz - 0.35, x - 0.2, bz)}"/>`,
    `<path class="bx-copper" data-current="rx" d="${R(x + 0.2, bz - 0.35, x + 5.6, bz)}"/>`,
    resistor(x - 5.6, tz, x + LEDX - 1.27, "rled"),
    resistor(x + 5.6, tz, x + PTX + 1.27, "rpu"),
  ];
  parts.push(`<g data-show="board">${board.join("")}</g>`);
  const blobs = [x + LEDX - 1.27, x + LEDX + 1.27, x + PTX - 1.27, x + PTX + 1.27, x - 5.6, x + 5.6].map((cx) => `<ellipse class="bx-solder" cx="${f(cx)}" cy="${f(-(tz + 0.35))}" rx="0.75" ry="0.45"/>`).join("");
  parts.push(`<g data-show="solder">${blobs}</g>`);
  const jacket = top + 4;
  const coreTop = z + 18.5;
  const core = (name, x0, endX, endZ) => `<path class="bx-core" data-wire="${name}" d="M${f(x0)} ${f(-coreTop)}C${f(x0)} ${f(-(coreTop - 4))} ${f(endX)} ${f(-(endZ + 4))} ${f(endX)} ${f(-endZ)}"/>`;
  const wires = [
    `<path class="bx-jacket" d="${R(x - 2.1, coreTop, x + 2.1, jacket + 3)}"/>`,
    core("red", x - 1.2, x, tz + 0.4),
    core("black", x - 0.4, x + PTX - 1.27, tz + 0.9),
    core("white", x + 0.4, x + LEDX + 1.27, tz + 0.9),
    core("green", x + 1.2, x + PTX + 1.27, tz + 0.9),
    `<path class="bx-copper" d="${R(x - 0.7, bz - 0.35, x + 0.7, tz + 0.25)}"/>`,
    `<ellipse class="bx-solder" cx="${f(x)}" cy="${f(-(tz + 0.35))}" rx="0.8" ry="0.45"/>`,
  ];
  parts.push(`<g data-show="wires">${wires.join("")}</g>`);
  const flowTx = `M${f(x - 0.9)} ${f(-coreTop)}C${f(x - 0.9)} ${f(-(coreTop - 4))} ${f(x)} ${f(-(tz + 4.4))} ${f(x)} ${f(-(tz + 0.4))}V${f(-(bz - 0.2))}H${f(x - 5.6)}V${f(-(tz + 4.6))}Q${f(x - 5.6)} ${f(-(tz + 6.5))} ${f(x + LEDX - 1.27)} ${f(-(tz + 5.6))}V${f(-(z + CHIP))}H${f(x + LEDX + 1.27)}V${f(-(tz + 0.9))}C${f(x + LEDX + 1.27)} ${f(-(tz + 4.9))} ${f(x + 0.4)} ${f(-(coreTop - 4))} ${f(x + 0.4)} ${f(-coreTop)}`;
  const flowRx = `M${f(x - 0.9)} ${f(-(bz - 0.2))}H${f(x + 5.6)}V${f(-(tz + 4.6))}Q${f(x + 5.6)} ${f(-(tz + 6.5))} ${f(x + PTX + 1.27)} ${f(-(tz + 5.6))}V${f(-(z + CHIP))}H${f(x + PTX - 1.27)}V${f(-(tz + 0.9))}C${f(x + PTX - 1.27)} ${f(-(tz + 4.9))} ${f(x - 0.4)} ${f(-(coreTop - 4))} ${f(x - 0.4)} ${f(-coreTop)}`;
  parts.push(`<path class="bx-flow" data-part="flow-tx" d="${flowTx}" style="opacity:0"/><path class="bx-flow bx-flow-rx" data-part="flow-rx" d="${flowRx}" style="opacity:0"/>`);
  parts.push(`<g data-part="glow-led" style="opacity:0"><ellipse class="bx-glow" cx="${f(x + LEDX)}" cy="${f(-(z + 1.2))}" rx="3" ry="3.2"/></g>`);
  return parts.join("");
}

function capPiece() {
  const { x, y } = ST;
  const z0 = FACE + CAPZ.z0, h = M.CAP.h;
  const out = [];
  out.push(cutBack(x, y, CUPR.ro, 0, z0, h, "pla", { bevel: 0.6 }));
  out.push(cutBack(x, y, CAPZ.bootR, 0, z0 + h, CAPZ.boot, "pla", { bevel: 0.3 }));
  const sec = [
    `<path class="bx-print" d="${R(x - W, z0, x - 2.2, z0 + h)}"/>`,
    `<path class="bx-print" d="${R(x + 2.2, z0, x + CUPR.ro, z0 + h)}"/>`,
    `<path class="bx-print" d="${R(x - CAPZ.bootR, z0 + h, x - 2.2, z0 + h + CAPZ.boot)}"/>`,
    `<path class="bx-print" d="${R(x + 2.2, z0 + h, x + CAPZ.bootR, z0 + h + CAPZ.boot)}"/>`,
    `<path class="bx-print" d="${R(x - CUPR.ri + 0.4, z0 - 2, x - CUPR.ri + 1.6, z0)}"/>`,
    `<path class="bx-print" d="${R(x + CUPR.ri - 1.6, z0 - 2, x + CUPR.ri - 0.4, z0)}"/>`,
  ];
  out.push(`<g transform="${facePlane(y)}" class="bx">${sec.join("")}</g>`);
  out.push(cutFront(x, y, CUPR.ro, 0, z0, h, "pla"));
  return out.join("");
}

// The cable's jacket inside the cap, drawn with the probe so it moves with it.
function jacketTop() {
  const { x, y } = ST;
  const z0 = FACE + CAPZ.z0;
  return `<g transform="${facePlane(y)}" class="bx" data-show="wires"><path class="bx-jacket" d="${R(x - 2.1, z0 - 1.6, x + 2.1, z0 + M.CAP.h + CAPZ.boot)}"/></g>`;
}

function plainCup(cx, cy, z, h, kind) {
  if (kind === "cap") return C("pla", S(k.cylinder(cx, cy, CUPR.ro, z, Math.min(h, M.CAP.h), P, 56, 0.6), { tone: "hi" }));
  const out = [C("pla", S(k.cylinder(cx, cy, CUPR.ro, z, h, P, 56, 0.6), { tone: "hi" }))];
  if (h > CUPR.floor) out.push(`<path class="bx-inside" d="${k.pathOf(k.circleRing(cx, cy, CUPR.ri, 48).map(([px, py]) => at([px, py, z + h])), true)}"/>`);
  return out.join("");
}

function ironStand() {
  const { x, y } = STAND_IRON;
  const base = { x: x - 26, y: y - 16, w: 52, d: 40, r: 6 };
  const out = [halo(base, Z0, 3)];
  out.push(C("black", S(k.slabOf(base, Z0, 7, P, 6, 0.6), { tone: "hi", inner: L(k.sideSeam(base, Z0 + 2.4, P, 6), { tone: "faint" }) })));
  const tray = { x: x - 22, y: y - 12, w: 22, d: 24, r: 3 };
  out.push(C("chrome", S(k.slabOf(tray, Z0 + 7, 3, P, 4, 0.4), { tone: "hi" })));
  out.push(C("sun", S(k.slabOf(k.insetPlan(tray, 2.2), Z0 + 8, 3.2, P, 4, 0.4), { tone: "hi" })));
  out.push(L(k.lineOnTop([tray.x + 4, tray.y + 12], [tray.x + tray.w - 4, tray.y + 12], Z0 + 11.2, P), { tone: "lo", free: true }));
  out.push(C("brass", S(k.cylinder(x + 12, y + 8, 7, Z0 + 7, 6, P, 28, 0.4), { tone: "hi" })));
  out.push(L(k.ring(x + 12, y + 8, 4.6, Z0 + 13, P, 20), { tone: "lo" }));
  const wool = Array.from({ length: 7 }, (_, i) => {
    const a = i * 0.9;
    return k.lineOnTop([x + 12 + 3.6 * Math.cos(a), y + 8 + 3.6 * Math.sin(a)], [x + 12 + 1.2 * Math.cos(a + 2), y + 8 + 1.2 * Math.sin(a + 2)], Z0 + 13, P);
  });
  out.push(L(wool.join(""), { tone: "mid", free: true }));
  const foot = G.add3(IRON_REST, G.mul3(IRON_DIR, 14));
  out.push(C("chrome", S(k.cylinder(foot[0], foot[1], 3, Z0 + 7, foot[2] - Z0 - 7 - 6.4, P, 20), { tone: "hi" })));
  out.push(C("chrome", S(G.ringBand(10, 14, 5.6, 7.4, G.frameAlong(IRON_REST, IRON_DIR), P), { tone: "hi" })));
  return out.join("");
}

const IRON_F = G.frameAlong([0, 0, 0], IRON_DIR);
const helixPoints = (s0, s1, r, turns) => Array.from({ length: turns * 24 + 1 }, (_, i) => {
  const t = i / (turns * 24);
  const a = t * turns * Math.PI * 2;
  return G.add3(IRON_REST, G.pointOf(IRON_F, s0 + (s1 - s0) * t, r, a));
});
function coilHalf(front) {
  const pts = helixPoints(12, 44, 6.4, 5);
  const centre = (p) => G.dot3(G.sub3(p, G.add3(IRON_REST, G.mul3(IRON_DIR, G.dot3(G.sub3(p, IRON_REST), IRON_DIR)))), VIEW);
  const runs = [];
  let run = [];
  for (const p of pts) {
    const isFront = centre(p) > 0;
    if (isFront === front) run.push(at(p));
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return `<g class="coil-${front ? "front" : "back"}">${runs.map((r) => `<path class="coil-wire" d="${k.pathOf(r)}"/>`).join("")}</g>`;
}

function iron() {
  const F = G.frameAlong(IRON_REST, IRON_DIR);
  const out = [];
  out.push(C("chrome", S(G.solidOf([[0, 0.25, 1], [2, 0.7, 1], [6, 1.5], [36, 1.9], [37, 2.6]], F, P), { tone: "hi" })));
  out.push(C("chrome", S(G.solidOf([[37, 2.6], [40, 4.2, 1], [42, 4.4]], F, P), { tone: "hi" })));
  const handle = [[42, 5.2], [44, 6.2, 1], [64, 6.4, 1], [84, 6.0, 1], [IRON_LEN - 4, 5.0, 1], [IRON_LEN, 3.4]];
  out.push(C("red", S(G.solidOf(handle, F, P), { tone: "hi", inner: L([50, 54, 58, 62].map((s) => G.arcOf(F, s, 6.35, P)).join(""), { tone: "lo" }) })));
  out.push(C("black", S(G.solidOf([[IRON_LEN, 3.4], [IRON_LEN + 6, 2.4]], F, P), { tone: "hi" })));
  return `<g data-part="iron">${out.join("")}</g>`;
}
const IRON_TAIL = G.add3(IRON_REST, G.mul3(IRON_DIR, IRON_LEN + 6));

function tray() {
  const out = [halo(TRAY, Z0, 2)];
  out.push(C("cap", S(k.slabOf(TRAY, Z0, TRAY.h, P, 6, 0.5), { tone: "hi" })));
  const walls = [k.lineOnTop([FOAM.x + FOAM.w + 3, TRAY.y + 2], [FOAM.x + FOAM.w + 3, TRAY.y + TRAY.d - 2], Z0 + TRAY.h, P), k.lineOnTop([TRAY.x + 2, TRAY.y + 25], [FOAM.x + FOAM.w + 3, TRAY.y + 25], Z0 + TRAY.h, P)];
  out.push(L(walls.join(""), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2), Z0 + TRAY.h, P, 4), { tone: "faint" }));
  out.push(C("foam", S(k.slabOf(FOAM, Z0 + 1, TRAY.h + 1.5, P, 3, 0.4), { tone: "hi" })));
  out.push(D(k.dotGrid(FOAM.x + 3, FOAM.y + 3, 8, 4, 3, Z0 + TRAY.h + 2.5, P), { size: 0.35, tone: "lo" }));
  const shrink = (y, len, r) => C("black", S(G.disc(TRAY.x + 6, TRAY.x + 6 + len, r, xAxis(0, y, Z0 + 1 + r), P), { tone: "hi" }));
  out.push(shrink(TRAY.y + 32, 20, 2.4) + shrink(TRAY.y + 39, 14, 1.6));
  return out.join("");
}

const FLY = {
  led: { from: [FOAM.x + 8, FOAM.y + 8, Z0 + TRAY.h + 2.5], to: [ST.x + LEDX, ST.y, FACE + BOSS.h] },
  sensor: { from: [FOAM.x + 17, FOAM.y + 9, Z0 + TRAY.h + 2.5], to: [ST.x + PTX, ST.y, FACE + BOSS.h] },
  board: { from: [TRAY.x + 50, TRAY.y + 13, Z0 + TRAY.h], to: [ST.x, ST.y, FACE + PCB.z0] },
  magnet: { from: [TRAY.x + 49, TRAY.y + 33, Z0 + TRAY.h], to: [ST.x, ST.y, FACE + MAG.z0] },
};

function ledSolid(cx, cy, z, down, dark) {
  const F = down ? G.frameOf([cx, cy, z + 5.4], [0, 0, -1], [1, 0, 0], [0, 1, 0]) : zAxis(cx, cy, z);
  const cls = dark ? "black" : "glass";
  const body = S(G.solidOf([[0, 1.9], [1, 1.9], [1, 1.5], [3.9, 1.5, 1], [4.7, 1.1, 1], [5.2, 0.5, 1], [5.4, 0.05]], F, P), { tone: "hi" });
  return C(cls, body);
}
function flyer(name, inner) {
  return `<g data-part="fly-${name}">${inner}</g>`;
}
function flyers() {
  const out = [];
  const [lx, ly, lz] = FLY.led.from, [sx, sy, sz] = FLY.sensor.from;
  out.push(flyer("led", `<g data-face="up">${ledSolid(lx, ly, lz, false, false)}</g><g data-face="down" style="opacity:0">${ledSolid(lx, ly, lz - 5.4, true, false)}</g>`));
  out.push(flyer("sensor", `<g data-face="up">${ledSolid(sx, sy, sz, false, true)}</g><g data-face="down" style="opacity:0">${ledSolid(sx, sy, sz - 5.4, true, true)}</g>`));
  const [bx, by, bz] = FLY.board.from;
  const rbody = (x0, y0) => C("cap", S(G.solidOf([[0, 0.5], [0.4, 0.8, 1], [3.2, 0.8, 1], [3.6, 0.5]], xAxis(x0, y0, bz + M.BOARD.t + 0.8), P), { tone: "hi" }));
  out.push(flyer("board", C("pcb", S(k.cylinder(bx, by, PCB.r, bz, M.BOARD.t, P, 40, 0.3), { tone: "hi" })) + L(k.ring(bx, by, PCB.r - 1.2, bz + M.BOARD.t, P, 32), { tone: "faint" }) + rbody(bx - 4.6, by - 2.6) + rbody(bx + 1, by + 2.6) + D([at([bx - 2.2, by + 0.6, bz + M.BOARD.t]), at([bx + 2.2, by - 0.6, bz + M.BOARD.t]), at([bx, by - 4.2, bz + M.BOARD.t]), at([bx, by + 4.6, bz + M.BOARD.t])], { size: 0.5, tone: "mid" })));
  const [mx, my, mz] = FLY.magnet.from;
  out.push(flyer("magnet", C("magnet", S(k.extrude([...arc(mx, my, MAG.ro, 0, Math.PI * 2, 48)], mz, M.PORT.magnet.h, P, { bevel: 0.4 }), { tone: "hi" })) + `<path class="bx-hole-top" d="${k.pathOf(k.circleRing(mx, my, MAG.ri, 40).map(([px, py]) => at([px, py, mz + M.PORT.magnet.h])), true)}"/>` + L(k.ring(mx, my, MAG.ri, mz + M.PORT.magnet.h, P, 40), { tone: "mid" })));
  return out.join("");
}

function glueTube() {
  const F = xAxis(0, GLUE.y, Z0 + 3.2);
  const x0 = GLUE.x;
  return halo({ x: x0, y: GLUE.y - 3, w: 34, d: 6, r: 3 }, Z0, 1) + C("sun", S(G.solidOf([[x0, 2.4], [x0 + 2, 3.2, 1], [x0 + 22, 3.2, 1], [x0 + 24, 2.2]], F, P), { tone: "hi", inner: L(G.arcOf(F, x0 + 8, 3.2, P) + G.arcOf(F, x0 + 16, 3.2, P), { tone: "faint" }) })) + C("red", S(G.solidOf([[x0 + 24, 2.2], [x0 + 26, 1.4], [x0 + 31, 0.5, 1], [x0 + 32, 0.1]], F, P), { tone: "hi" }));
}

function ftBoard() {
  const z = FTZ;
  const out = [halo(FT, Z0, 2)];
  const feet = [[FT.x + 3, FT.y + 3], [FT.x + FT.w - 3, FT.y + FT.d - 3], [FT.x + FT.w - 3, FT.y + 3], [FT.x + 3, FT.y + FT.d - 3]];
  for (const [x, y] of feet) out.push(C("black", S(k.cylinder(x, y, 1.6, Z0, z - Z0, P, 14), { tone: "hi" })));
  out.push(C("red", S(k.slabOf(FT, z, FT.t, P, 3, 0.3), { tone: "hi" })));
  const top = z + FT.t;
  const chip = { x: FT.x + 12, y: FT.y + 5.8, w: 10.2, d: 5.4, r: 0.3 };
  const pins = [];
  for (let i = 0; i < 14; i++) {
    const px = chip.x + 0.55 + i * 0.65;
    pins.push(k.lineOnTop([px, chip.y - 0.9], [px, chip.y], top, P), k.lineOnTop([px, chip.y + chip.d], [px, chip.y + chip.d + 0.9], top, P));
  }
  out.push(L(pins.join(""), { tone: "mid" }));
  out.push(`<g data-part="ft-chip">${C("chip", S(k.slabOf(chip, top, 1.5, P, 2, 0.2), { tone: "hi" }))}</g>`);
  out.push(D([at([chip.x + 1, chip.y + 1, top + 1.5])], { size: 0.4, tone: "hi" }));
  out.push(`<g transform="${k.topMatrix([chip.x + 1.6, chip.y + 3.5], top + 1.5, P, "x")}"><text class="ft-text" font-size="1.7">FT232RL</text></g>`);
  const smd = (x, y, cls) => C(cls, S(k.slabOf({ x, y, w: 1.6, d: 0.9, r: 0.15 }, top, 0.6, P, 2), { tone: "hi" }));
  out.push(smd(FT.x + 24, FT.y + 3, "cap") + smd(FT.x + 24, FT.y + 13, "cap") + smd(FT.x + 9, FT.y + 13.6, "cap"));
  out.push(`<g data-part="ft-tx">${smd(FT.x + 6, FT.y + 2.2, "ledoff")}</g><g data-part="ft-rx">${smd(FT.x + 8.6, FT.y + 2.2, "ledoff")}</g>`);
  const pads = ["VCC", "GND", "TXD", "RXD"].map((_, i) => [FT.x + 2.6, FT.y + 3.1 + i * 3.6]);
  out.push(L(pads.map(([x, y]) => k.ring(x, y, 1.1, top, P, 14)).join(""), { tone: "mid" }));
  out.push(`<g transform="${k.topMatrix([FT.x + 4.6, FT.y + 3.8], top, P, "x")}" class="ft-labels">${["5V", "GND", "TX", "RX"].map((t, i) => `<text font-size="1.5" y="${f(i * 3.6)}">${t}</text>`).join("")}</g>`);
  out.push(C("chrome", S(k.slabOf(USBC, USBC.z0, USBC.h, P, 3, 0.3), { tone: "hi" })));
  out.push(`<path class="usb-mouth" d="${k.pathOf([[USBC.x + USBC.w, USBC.y + 1.4, USBC.z0 + 0.8], [USBC.x + USBC.w, USBC.y + USBC.d - 1.4, USBC.z0 + 0.8], [USBC.x + USBC.w, USBC.y + USBC.d - 1.4, USBC.z0 + USBC.h - 0.8], [USBC.x + USBC.w, USBC.y + 1.4, USBC.z0 + USBC.h - 0.8]].map(at), true)}"/>`);
  return out.join("");
}

// The four cores land on the FT board's pads; heat-shrink slides over them in step 4.
function ftCores() {
  const top = FTZ + FT.t;
  const colours = ["red", "black", "white", "green"];
  const ends = colours.map((_, i) => [FT.x + 2.6, FT.y + 3.1 + i * 3.6, top + 0.4]);
  const start = [FT.x - 13, FT.y + FT.d / 2, top + 1.6];
  const wires = colours.map((c, i) => `<path class="pb-wire" data-wire="${c}" d="${k.pathOf(G.fillet([start, [FT.x - 4, ends[i][1], top + 1.2], ends[i]], 2).map(at))}"/>`).join("");
  const blobs = D(ends.map((e) => at(e)), { size: 0.9, tone: "mid" });
  const F = xAxis(0, FT.y + FT.d / 2, top + 1.6);
  const sleeve = (s0, r) => C("black", S(G.disc(s0, FT.x + 4, r, F, P), { tone: "hi" }));
  return `<g data-show-ft="wires">${wires}<g data-show-ft="solder">${blobs}</g></g><g data-part="shrink-loose">${sleeve(FT.x - 18, 4.6)}</g><g data-part="shrink-tight" style="opacity:0">${sleeve(FT.x - 18, 3.4)}</g>`;
}

function phone() {
  const out = [halo(PHONE, 0, 3)];
  out.push(C("phone", S(k.slabOf(PHONE, Z0, PHONE.h - Z0, P, 10, 1), { tone: "hi", inner: L(k.sideSeam(PHONE, PHONE.h - 1.6, P, 10), { tone: "faint" }) })));
  out.push(`<path class="pb-screen" d="${k.planOutline(SCREEN, PHONE.h, P, 8)}"/>`);
  out.push(`<clipPath id="f2-screen"><path d="${k.planOutline(SCREEN, PHONE.h, P, 8)}"/></clipPath>`);
  const rows = Array.from({ length: 6 }, (_, i) => `<text class="pb-term" data-row="${i}" x="0" y="${f(i * 9.6)}" font-size="6.2"></text>`).join("");
  const cam = cameraView();
  out.push(`<g clip-path="url(#f2-screen)"><g transform="${k.topMatrix([SCREEN.x + 5, SCREEN.y + 9], PHONE.h, P, "x")}" data-part="screen">${cam}${rows}</g></g>`);
  out.push(L(k.planOutline(SCREEN, PHONE.h, P, 8), { tone: "hi" }));
  out.push(`<path class="f2-shadow" data-part="hover-shadow" style="opacity:0" d="${k.pathOf(k.circleRing(CAMERA[0] - 2, CAMERA[1] - 3, CUPR.ro, 40).map(([px, py]) => at([px, py, PHONE.h])), true)}"/>`);
  out.push(L(k.ring(CAMERA[0], CAMERA[1], 1.6, PHONE.h, P, 16), { tone: "mid" }));
  out.push(D([at([CAMERA[0], CAMERA[1], PHONE.h])], { size: 0.9, tone: "hi" }));
  out.push(L(k.planOutline({ x: CAMERA[0] - 1.5, y: CAMERA[1] - 9, w: 1.2, d: 5, r: 0.6 }, PHONE.h, P, 3), { tone: "faint" }));
  const button = (x, w) => S(k.slabOf({ x, y: PHONE.y - 0.9, w, d: 1.1, r: 0.5 }, 2.6, 2.8, P, 2), { tone: "hi" });
  out.push(C("phone", button(PHONE.x + 60, 16) + button(PHONE.x + 82, 9)));
  const port = { x: PHONE.x - 0.2, y: OTG.y - 4.2, w: 0.4, d: 8.4, r: 0.2 };
  out.push(`<path class="usb-mouth" d="${k.pathOf([[PHONE.x, OTG.y - 4.2, OTG.z - 1.3], [PHONE.x, OTG.y + 4.2, OTG.z - 1.3], [PHONE.x, OTG.y + 4.2, OTG.z + 1.3], [PHONE.x, OTG.y - 4.2, OTG.z + 1.3]].map(at), true)}"/>` + (port ? "" : ""));
  return out.join("");
}

// What the front camera shows: the probe's face from below, the LED glowing when TX pulls low.
function cameraView() {
  const cx = 52, cy = 28;
  return `<g data-part="camera-view" style="opacity:0"><rect class="cv-bg" x="-6" y="-12" width="${SCREEN.w}" height="${SCREEN.d}"/>` +
    `<circle class="cv-face" cx="${cx}" cy="${cy}" r="21"/><circle class="cv-rim" cx="${cx}" cy="${cy}" r="17"/>` +
    `<circle class="cv-dome" cx="${cx - 4.2}" cy="${cy}" r="2.4"/><circle class="cv-dome cv-pt" cx="${cx + 4.2}" cy="${cy}" r="2.4"/>` +
    `<circle class="cv-glow" data-part="cv-glow" cx="${cx - 4.2}" cy="${cy}" r="7" style="opacity:0"/><circle class="cv-core" data-part="cv-core" cx="${cx - 4.2}" cy="${cy}" r="2.2" style="opacity:0"/>` +
    `<circle class="cv-shutter" cx="${SCREEN.w - 24}" cy="${SCREEN.d - 22}" r="0"/></g>`;
}

function otgPlug() {
  const y = OTG.y, z = OTG.z;
  const plugAt = (x0, x1) => {
    const plan = { x: x0, y: y - 4.6, w: x1 - x0, d: 9.2, r: 2.4 };
    return C("black", S(k.slabOf(plan, z - 3.2, 6.4, P, 4, 0.5), { tone: "hi" }));
  };
  const fixed = plugAt(OTG.x0, OTG.x0 + 12);
  const moving = `<g data-part="otg-plug">${C("chrome", S(k.slabOf({ x: OTG.x1 - 6.6, y: y - 4.1, w: 6.6, d: 8.2, r: 1.2 }, z - 1.25, 2.5, P, 3), { tone: "hi" }))}${plugAt(OTG.x1 - 18.6, OTG.x1 - 6.6)}</g>`;
  return { fixed, moving };
}

function magnifierStand() {
  const base = { x: POST.x - 14, y: POST.y - 14, w: 28, d: 28, r: 14 };
  const out = [halo(base, Z0, 3)];
  out.push(C("black", S(k.cylinder(POST.x, POST.y, 14, Z0, 6, P, 56, 0.8), { tone: "hi", inner: L(k.sideArc(POST.x, POST.y, 14, Z0 + 2, P, 40), { tone: "faint" }) })));
  out.push(L(k.ring(POST.x, POST.y, 9, Z0 + 6, P, 36), { tone: "faint" }));
  out.push(C("chrome", S(k.cylinder(POST.x, POST.y, 4.4, Z0 + 6, 3, P, 24, 0.4), { tone: "hi" })));
  out.push(C("chrome", S(k.cylinder(POST.x, POST.y, POST.r, Z0 + 9, POST.top - Z0 - 9, P, 18), { tone: "hi", inner: L(k.sideArc(POST.x, POST.y, POST.r, POST.top - 24, P, 14), { tone: "faint" }) })));
  return out.join("");
}

function magnifier(content) {
  const [cx, cy] = at(LENS_CENTRE);
  const r = LENS.r, rim = LENS.rim;
  const out = [];
  out.push(C("chrome", S(G.disc(-1, 13, 2, G.frameAlong(ARM_ROOT, RIGHT), P), { tone: "hi" })));
  out.push(C("chrome", S(G.sphereOf([POST.x, POST.y, POST.top], 4, P), { tone: "hi" })));
  out.push(`<clipPath id="f2-lens"><circle cx="${f(cx)}" cy="${f(cy)}" r="${r}"/></clipPath>`);
  out.push(`<g clip-path="url(#f2-lens)"><circle class="pb-lens-bg" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/>`);
  out.push(`<g transform="translate(${f(cx)} ${f(cy)}) scale(${LENS.mag}) translate(${f(-cx)} ${f(-cy)})">${content}</g>`);
  out.push(`<circle class="pb-glass" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/>`);
  const a0 = (200 * Math.PI) / 180, a1 = (258 * Math.PI) / 180, ri = r * 0.82, ro = r * 0.9;
  const pt = (rr, a) => `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  out.push(`<path class="pb-shine" d="M${pt(ro, a0)}A${ro} ${ro} 0 0 1 ${pt(ro, a1)}L${pt(ri, a1)}A${ri} ${ri} 0 0 0 ${pt(ri, a0)}Z"/></g>`);
  out.push(`<circle class="pb-rim" cx="${f(cx)}" cy="${f(cy)}" r="${r + rim / 2}" stroke-width="${rim}"/>`);
  out.push(`<circle class="pb-rim-line" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/><circle class="pb-rim-line" cx="${f(cx)}" cy="${f(cy)}" r="${r + rim}"/>`);
  return `<g class="pb-lens">${out.join("")}</g>`;
}

const probeGroup = () => `<g data-part="probe" style="opacity:0">${cupBody()}${jacketTop()}<g data-part="cap" style="opacity:0">${capPiece()}</g></g>`;
const CABLE_R = 2.1;
const cableEls = `<g data-part="cable"><path class="pb-cable-out"/><path class="pb-cable-in"/><path class="pb-cable-shine"/></g><g data-part="otg-cable"><path class="pb-cable-out"/><path class="pb-cable-in"/><path class="pb-cable-shine"/></g><g data-part="cord"><path class="pb-cord-out"/><path class="pb-cord-in"/></g>`;
const plugs = otgPlug();

const LENS_AT = at(LENS_CENTRE);
const SOUNDS = {
  print: at([PRINT.cup[0] + 34, PRINT.cup[1] - 4, 30]),
  push: [LENS_AT[0] - LENS.r - 30, LENS_AT[1] - LENS.r * 0.4],
  solder: [LENS_AT[0] + LENS.r * 0.15, LENS_AT[1] - LENS.r * 0.82],
  shrink: at([FT.x - 6, FT.y + FT.d + 14, 12]),
  clack: [LENS_AT[0] + LENS.r * 0.95, LENS_AT[1] + LENS.r + 12],
  snap: [LENS_AT[0] - LENS.r - 22, LENS_AT[1] - LENS.r * 0.7],
  click: at([OTG.x1 - 10, OTG.y + 18, 14]),
  blink: at([CAMERA[0] + 4, CAMERA[1] - 36, 44]),
  beep: at([PHONE.x + 60, PHONE.y + PHONE.d + 12, 12]),
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A workbench with the parts of a home-made optical probe: a printed cup and cap on a print sheet, a tray with an infrared LED, a light sensor, a small round board with two resistors and a ring magnet, a USB-to-serial board with a USB-C socket, a soldering iron on its stand, a phone, and a test stand with a small mirror under a steel washer. A magnifier shows the cup cut open: the LED and sensor side by side, the board and wires behind them, and light bouncing off the mirror.",
  body: [
    bench(),
    printSheet(),
    ironStand(),
    coilHalf(false),
    printing(),
    testStand(),
    tray(),
    glueTube(),
    ftBoard(),
    ftCores(),
    plugs.fixed,
    phone(),
    plugs.moving,
    magnifierStand(),
    probeGroup(),
    testStandFront(),
    cableEls,
    flyers(),
    iron(),
    coilHalf(true),
    magnifier(testStand() + probeGroup() + testStandFront() + flyers() + iron()),
    `<rect class="f2-sun" data-part="sun" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" style="opacity:0"/>`,
  ],
});

// Step timing: 0.9 + Σdur + 0.7 × 7 + 1.6 = 36 s. The mirror test is the slowest.
const SEND_SHARE = { 6: 0.55, 7: 0.62 };
const SEND_S = M.DESIGN.text.length * M.charSeconds(M.DESIGN.baud);
const PRINT_S = M.printSeconds().seconds;
const STEPS = [
  { label: "Print the cup", hint: "The printer lays down hot plastic, one thin layer on top of the last, until the cup and its cap are done.", dur: 3.4, real: PRINT_S, sound: { word: "bzzz…", at: SOUNDS.print, from: 0.05, to: 0.75 } },
  { label: "Push in the LED and the sensor", hint: "The clear LED will talk and the dark sensor will listen. They sit side by side, 6.5 mm apart, like the meter's own pair.", dur: 3.0, real: null, sound: { word: "push, push", at: SOUNDS.push, from: 0.45, to: 0.95 } },
  { label: "Solder the resistors", hint: "A small round board holds two resistors: one keeps the LED's current small, one lets the sensor pull the line down.", dur: 3.4, real: null, sound: { word: "tsss", at: SOUNDS.solder, from: 0.5, to: 0.95 } },
  { label: "Wire 5V, GND, TX, RX", hint: "Four wires: red brings 5 volts, black is ground, white goes to TX, green to RX. Heat-shrink covers the other end.", dur: 3.4, real: null, sound: [{ word: "tsss", at: SOUNDS.solder, from: 0.3, to: 0.55 }, { word: "shrink!", at: SOUNDS.shrink, from: 0.72, to: 0.98 }] },
  { label: "Glue in the ring magnet", hint: "The ring magnet goes round the LED and the sensor. It is what holds the probe on the meter's steel ring.", dur: 2.6, real: null, sound: { word: "clack!", at: SOUNDS.clack, from: 0.62, to: 0.98 } },
  { label: "Close the cap", hint: "The cap closes the cup and grips the cable, so a tug on the wire can't pull the joints apart.", dur: 2.6, real: null, sound: { word: "snap", at: SOUNDS.snap, from: 0.62, to: 0.98 } },
  { label: "Plug in and look through the phone camera", hint: "Plug into the phone and type. Your eye can't see 940 nm light, but a phone's front camera usually can: the LED blinks purple.", dur: 3.8, real: SEND_S / SEND_SHARE[6], sound: [{ word: "click", at: SOUNDS.click, from: 0.1, to: 0.3 }, { word: "blink blink", at: SOUNDS.blink, from: 0.45, to: 0.98 }] },
  { label: "Mirror test", hint: "On the test stand the LED's light bounces off the mirror into the sensor, so every letter you type comes straight back.", dur: 6.4, real: SEND_S / SEND_SHARE[7], sound: [{ word: "clack!", at: SOUNDS.clack, from: 0.1, to: 0.3 }, { word: "beep!", at: SOUNDS.beep, from: 0.9, to: 1.0 }] },
];

const live = `
${MODEL_SRC}
const P = ${JSON.stringify(P)};
const SCALE = ${SCALE};
const STEPS = ${JSON.stringify(STEPS)};
const SEND_SHARE = ${JSON.stringify(SEND_SHARE)};
const GEO = ${JSON.stringify({ ST, FACE, Z0, SHEET_Z, PRINT, CUPR, CAPH: M.CAP.h, CUP_MOVE, CAP_MOVE, HOVER, FLY, OTG, IRON_REST, IRON_DIR, IRON_TAIL, FT, FTZ, MIRZ: MIR.z1, WASH, LEDX, PTX, CHIP, CABLE_R, PHONE, BOOT_TOP: FACE + CAPZ.z1 + CAPZ.boot, BAND_FILL })};
${liveSource()}
`;

function liveSource() {
  return readFileSync(join(HERE, "live.js"), "utf8");
}

const css = readFileSync(join(HERE, "page.css"), "utf8");

const bom = (s) => [
  ["3D-printed cup and cap", "PLA, Ø" + M.CUP.od + " mm, " + Math.round(M.printSeconds().mm3 / 1000) + " cm³ of plastic"],
  ["Infrared LED", M.LED.maker + " " + M.LED.part + ", " + M.LED.nm + " nm, 3 mm"],
  ["Phototransistor", M.SENSOR.maker + " " + M.SENSOR.part + " (daylight filter)"],
  ["LED resistor", "<b data-bom='rled'>" + M.ohmsText(s.r) + "</b> for " + s.mA.toFixed(1) + " mA"],
  ["Pull-up resistor", M.ohmsText(s.pu.picked)],
  ["Round board", "Ø" + M.BOARD.dia + " mm"],
  ["Ring magnet", M.PORT.magnet.od + " × " + M.PORT.magnet.id + " × " + M.PORT.magnet.h + " mm, " + M.PORT.magnet.grade],
  ["Cable", "4 cores: 5V red, GND black, TX white, RX green"],
  ["USB-serial board", "FTDI FT232RL with USB-C (a CH340 board works too)"],
  ["Heat-shrink", "Ø6 → Ø3 mm sleeve"],
  ["Test stand", M.WASHER.name + " on a " + (RISER.z1 - RISER.z0).toFixed(1) + " mm printed riser, Ø" + M.MIRROR.dia + " mm mirror " + s.gap + " mm below the face"],
];

const extras = `
<div class="bk-panel f2-break">
  <h3>Break it</h3>
  <div class="f2-sliders">
    <label class="f2-slider"><span>Probe off-centre <b data-out="offset"></b></span><input type="range" min="0" max="6" step="0.1" value="0" data-slider="offset"></label>
    <label class="f2-slider"><span>Sunlight <b data-out="sun"></b></span><input type="range" min="0" max="1" step="0.01" value="0" data-slider="sun"></label>
    <label class="f2-slider"><span>LED resistor <b data-out="rled"></b></span><input type="range" min="0" max="16" step="1" value="0" data-slider="rled"></label>
    <label class="f2-slider"><span>Phone baud <b data-out="baud"></b></span><input type="range" min="0" max="6" step="1" value="0" data-slider="baud"></label>
  </div>
  <div class="f2-row"><label class="bk-toggle"><input type="checkbox" checked data-filter> Daylight filter on the sensor <small>(SFH 309 FA sees ${M.SENSOR.bandFiltered.join("–")} nm; the plain SFH 309 sees ${M.SENSOR.bandClear.join("–")} nm)</small></label><button class="f2-reset" type="button" data-slider-reset>Put it back</button></div>
  <p class="f2-note" data-note></p>
</div>
<div class="bk-panel f2-bom"><h3>Parts list, with the values the model picked</h3><table>${bom(SOL).map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</table></div>`;

const sources = [
  "LED: Vishay <a href=\"https://www.vishay.com/docs/81006/tsal4400.pdf\" target=\"_blank\" rel=\"noopener\">TSAL4400 datasheet</a>: 940 nm, ±25°, 100 mA maximum, VF 1.35 V at 100 mA and 2.6 V at 1 A, 36 mW/sr at 100 mA. The forward voltage at 5 mA (≈" + SOL.vf.toFixed(2) + " V) is fitted between those two points with a diode curve (n ≈ 2 assumed), and light is taken as proportional to current: both are estimates.",
  "Sensor: ams OSRAM <a href=\"https://www.farnell.com/datasheets/4020741.pdf\" target=\"_blank\" rel=\"noopener\">SFH 309 FA datasheet</a> (values read from v1.3, 2018): 730–1120 nm (the plain SFH 309: 380–1150 nm), ±12°, group -4 gives 1.0–2.0 mA at 0.5 mW/cm², 50 nA dark current at most, 0.2 V saturated, chip 2.4–2.8 mm behind the tip. The model uses the middle of group -4.",
  "Serial chip: FTDI <a href=\"https://ftdichip.com/wp-content/uploads/2020/08/DS_FT232R.pdf\" target=\"_blank\" rel=\"noopener\">FT232R datasheet</a> (FT_000053), VCCIO = 5 V: inputs switch between 1.0 and 1.5 V and have a 200 kΩ pull-up inside; outputs sink 2 mA (standard drive) or 6 mA (high drive, set in its EEPROM with FT_Prog) at 0.4 V, 24 mA absolute maximum. So " + SOL.mA.toFixed(1) + " mA needs the high-drive setting; at standard drive, add a transistor.",
  "Spacing 6.5 mm between LED and sensor: the footprints of twam's open <a href=\"https://github.com/twam/IEC-62056-21-Optical-Probe\" target=\"_blank\" rel=\"noopener\">IEC 62056-21 probe</a> PCB (SFH 487-2 at x = −146.75, SFH 309 FA-4 at x = −153.25). Ring magnet 27 × 16 × 5 mm N42: the parts list of the <a href=\"https://wiki.volkszaehler.org/hardware/controllers/ir-schreib-lesekopf-ttl-ausgang\" target=\"_blank\" rel=\"noopener\">volkszaehler.org TTL read head</a> (twam uses 26.75 × 16 × 5). I could not read the standard's own drawing (IEC 62056-21 is paywalled), so treat both as copied from working designs, not from the standard.",
  "Mirror gap " + SOL.gap + " mm: the model's best echo for 6.5 mm spacing and the sensor's ±12°. Pull-up " + M.ohmsText(SOL.pu.picked) + ": the smallest E12 value that pulls RX below 1.0 V with 1.5× margin on that echo.",
  "Guesses, not measured: daylight reaching the sensor chip on the stand (1 part in 1000), the share of sunlight the sensor answers to (¼ with the filter, ½ without), 100 lm per watt for sunlight, 0.9 for the mirror, 3 mm³/s for the printer (so the print takes about " + Math.round(PRINT_S / 60) + " min).",
  "The meter's reply <code>" + M.METER_ID + "</code> at 300 baud, 7E1, is the invented meter from figure 1; the noise you see at other speeds is what a UART sampling at the wrong speed really reads (simulated).",
  "Phone front cameras often lack the infrared-cut filter that rear cameras have, which is why the LED shows purple on the selfie camera: a common hobby tip, not true of every phone.",
];

const page = bookPage({
  fig: "Fig 2",
  title: "Build your own",
  question: "How do I build my own optical probe like the MY015-D?",
  label: "Building an optical probe on a workbench. Use the step buttons to play each step.",
  svg,
  extras,
  idea: "The big idea: <em>two parts make the probe, one LED to talk and one light sensor to listen; everything else holds them in the right place.</em>",
  sources,
  css,
  script: kitScript() + "\n" + live,
});

writeFileSync(join(HERE, "index.html"), page);
console.log("wrote index.html", (page.length / 1024).toFixed(0) + " KB", "scale", SCALE.toFixed(2));
