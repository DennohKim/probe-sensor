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

// World in millimetres: x along the pipe, y toward the front, z up. The bench top is z = 0.
const PLATE = { x: -112, y: -96, w: 290, d: 214, r: 10 };
const PLATE_H = 9;
const FOOT_H = 6;

const PIPE = { y: -40, z: 28, r: 10.6, x0: -100, x1: 80 };
const MX = -10;
const HEAD = { x: MX - 42, y: PIPE.y - 42, w: 84, d: 84, r: 12, z0: 54, z1: 82 };
const NOTCH_Z = 68;
const PORT = { x: MX + 14, y: PIPE.y + 14, rIn: 10.5, rOut: 16, proud: 0.5 };
const PROBE = { r: 17, h: 26, z0: HEAD.z1 + PORT.proud, lift: 34 };
const PROBE_TOP = PROBE.z0 + PROBE.h;
const BOOT_TOP = PROBE_TOP + 7.5;
const NOTCH = { x0: PORT.x - 19, x1: PORT.x + 19 };
const LED_X = 3.25;

const PHONE = { x: 26, y: 38, w: 142, d: 70, r: 10, h: 8 };
const SCREEN = { x: PHONE.x + 4, y: PHONE.y + 4, w: PHONE.w - 8, d: PHONE.d - 8, r: 7 };
const PLUG = { x0: PHONE.x - 29, x1: PHONE.x - 1, y: PHONE.y + PHONE.d / 2, z: PHONE.h / 2, half: 6, z0: 0.9, z1: 7.7, unplug: -20 };
const BOOT = { x0: PLUG.x0 - 9, r: 3.3 };
const CABLE_R = 2.1;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [PORT.x, PORT.y, BOOT_TOP + PROBE.lift + 26], [PORT.x - 40, PORT.y + 12, BOOT_TOP + PROBE.lift + 22]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52 },
);
const SCALE = G.scaleOf(P);

// A desk magnifier stands in front of the joint between probe and port, on the line of sight, so its lens shows that joint 2.7 times larger.
const VIEW = G.viewOf(P);
const RIGHT = (() => {
  const a = (P.azimuth * Math.PI) / 180;
  const u = [Math.sin(a), -Math.cos(a), 0];
  return k.iso(u, P)[0] > k.iso([0, 0, 0], P)[0] ? u : [-u[0], -u[1], 0];
})();
const JOINT = [PORT.x, PORT.y, HEAD.z1];
const LENS = { mag: 2.5, r: 44, rim: 5, out: 80 };
LENS.at = G.add3(JOINT, G.mul3(VIEW, LENS.out));
LENS.rWorld = (LENS.r + LENS.rim) / SCALE;
const ARM_ROOT = G.add3(LENS.at, G.mul3(RIGHT, LENS.rWorld));
const POST = { x: ARM_ROOT[0] + RIGHT[0] * 16, y: ARM_ROOT[1] + RIGHT[1] * 16, r: 3, top: LENS.at[2] };

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const C = (name, svg) => `<g class="c-${name}">${svg}</g>`;
const xAxis = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const zAxis = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const facePlane = (y) => k.sideMatrix([0, y], 0, P, "left");
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const f = (n) => +n.toFixed(2);

function clipRing(ring, { x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity }) {
  const planes = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((x0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((x1 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((y0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((y1 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y1]],
  ];
  let points = ring;
  for (const [inside, cross] of planes) {
    const out = [];
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length];
      if (inside(p)) {
        out.push(p);
        if (!inside(q)) out.push(cross(p, q));
      } else if (inside(q)) out.push(cross(p, q));
    });
    points = out;
  }
  return points;
}
const halfDisc = (cx, cy, r, steps = 40) => Array.from({ length: steps + 1 }, (_, i) => {
  const a = Math.PI + (i / steps) * Math.PI;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(C("wood", S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, P, 28), { tone: "hi" })));
  }
  const grain = [-58, -14, 30, 74].map((y) => k.lineOnTop([PLATE.x + 6, PLATE.y + 107 + y], [PLATE.x + PLATE.w - 6, PLATE.y + 107 + y], 0, P)).join("");
  out.push(C("wood", S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "hi", inner: "" })));
  out.push(L(grain, { tone: "faint", free: true }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.6, tone: "mid" }));
  return out.join("");
}

function stand(x) {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 9, y: PIPE.y - 9, w: 18, d: 18, r: 4 }, 0, 4, P)}"/>`];
  out.push(C("chrome", S(k.slabOf({ x: x - 9, y: PIPE.y - 9, w: 18, d: 18, r: 3 }, 0, 2.4, P, 4, 0.5), { tone: "hi" })));
  out.push(C("chrome", S(k.cylinder(x, PIPE.y, 3.6, 2.4, 9.6, P, 20), { tone: "hi" })));
  out.push(C("chrome", S(k.slabOf({ x: x - 5, y: PIPE.y - 8, w: 10, d: 16, r: 1.5 }, 12, PIPE.z - PIPE.r - 12, P, 3, 0.4), { tone: "hi" })));
  out.push(D([at([x - 6.5, PIPE.y - 6.5, 2.4]), at([x + 6.5, PIPE.y + 6.5, 2.4]), at([x + 6.5, PIPE.y - 6.5, 2.4]), at([x - 6.5, PIPE.y + 6.5, 2.4])], { size: 0.5, tone: "mid" }));
  return out.join("");
}

const pipeRun = (x0, x1) => C("chrome", S(G.disc(x0, x1, PIPE.r, xAxis(0, PIPE.y, PIPE.z), P), { tone: "hi" }));
const hexNut = (x0, x1, R) => {
  const hex = Array.from({ length: 6 }, (_, i) => [R * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), R * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)]);
  return C("brass", S(G.prismOf(xAxis(0, PIPE.y, PIPE.z), hex, x0, x1, P), { tone: "hi" }));
};

function valve(x) {
  const F = xAxis(0, PIPE.y, PIPE.z);
  const out = [hexNut(x - 12, x - 7, 14)];
  out.push(C("brass", S(G.solidOf([[x - 7, 13], [x - 5, 16, 1], [x, 17.5, 1], [x + 5, 16, 1], [x + 7, 13]], F, P), { tone: "hi" })));
  out.push(hexNut(x + 7, x + 12, 14));
  const top = PIPE.z + Math.sqrt(17.5 * 17.5 - 5 * 5);
  out.push(C("brass", S(k.cylinder(x, PIPE.y, 5, top - 0.5, 6, P, 24), { tone: "hi" })));
  out.push(C("red", S(k.slabOf({ x: x - 4, y: PIPE.y - 4, w: 8, d: 8, r: 2 }, top + 5.5, 3, P, 3, 0.4), { tone: "hi" })));
  out.push(C("red", S(k.slabOf({ x: x - 3.5, y: PIPE.y + 2, w: 7, d: 34, r: 3 }, top + 6, 2.4, P, 4, 0.5), { tone: "hi" })));
  out.push(D([at([x, PIPE.y, top + 8.5])], { size: 0.7, tone: "hi" }));
  return out.join("");
}

function meterBody() {
  const F = xAxis(0, PIPE.y, PIPE.z);
  const out = [hexNut(MX - 64, MX - 52, 17.2)];
  const profile = [[MX - 52, 12.5], [MX - 47, 12.5], [MX - 45, 16, 1], [MX - 30, 18, 1], [MX, 19, 1], [MX + 30, 18, 1], [MX + 45, 16, 1], [MX + 47, 12.5], [MX + 52, 12.5]];
  const body = G.solidOf(profile, F, P);
  const arrow = [[MX - 22, PIPE.y + 0.1, PIPE.z + 19.05], [MX + 16, PIPE.y + 0.1, PIPE.z + 19.05]];
  out.push(C("brass", S(body, { tone: "hi", inner: L(G.arcOf(F, MX - 30, 18, P, { slope: 0.06 }) + G.arcOf(F, MX + 30, 18, P, { slope: -0.06 }), { tone: "faint" }) })));
  out.push(L(k.pathOf(arrow.map(at)) + k.pathOf([[MX + 10, PIPE.y - 4, PIPE.z + 18.7], [MX + 16, PIPE.y + 0.1, PIPE.z + 19.05], [MX + 10, PIPE.y + 4.2, PIPE.z + 18.7]].map(at)), { tone: "lo", free: true }));
  out.push(hexNut(MX + 52, MX + 64, 17.2));
  const neckBase = PIPE.z + Math.sqrt(19 * 19 - 13 * 13);
  out.push(C("brass", S(k.cylinder(MX, PIPE.y, 13, neckBase, HEAD.z0 - neckBase, P, 48), { tone: "hi", inner: L(k.sideArc(MX, PIPE.y, 13, HEAD.z0 - 3, P, 40), { tone: "faint" }) })));
  return out.join("");
}

function head() {
  const out = [`<path class="iso-halo" d="${k.haloOf(HEAD, HEAD.z0, 2, P)}"/>`];
  const ring = k.ringOf(HEAD, 10);
  out.push(C("meter", S(k.extrude(ring, HEAD.z0, NOTCH_Z - HEAD.z0, P, { bevel: 0 }), { tone: "hi", inner: L(k.ringSeam(ring, HEAD.z0 + 3, P), { tone: "faint" }) })));
  const pieces = [
    clipRing(ring, { x1: NOTCH.x0 }),
    clipRing(ring, { x0: NOTCH.x0, x1: NOTCH.x1, y1: PORT.y }),
    clipRing(ring, { x0: NOTCH.x1 }),
  ];
  pieces.forEach((piece, index) => {
    const seam = index === 1 ? "" : L(k.ringSeam(piece, HEAD.z1 - 6, P), { tone: "faint" });
    out.push(C("meter", S(k.extrude(piece, NOTCH_Z, HEAD.z1 - NOTCH_Z, P, { bevel: index === 1 ? 0 : 1 }), { tone: "hi", inner: seam })));
    if (index === 1) out.push(meterSection());
  });
  return out.join("");
}

function headTop() {
  const z = HEAD.z1;
  const out = [];
  const front = HEAD.y + HEAD.d;
  const lcd = RR(HEAD.x + 13, HEAD.z0 + 5.5, HEAD.x + 36.6, HEAD.z0 + 21.5, 1.6);
  out.push(`<g transform="${facePlane(front)}"><path class="pb-lcd-bezel" d="${RR(HEAD.x + 11.4, HEAD.z0 + 4, HEAD.x + 38.2, HEAD.z0 + 23, 2.4)}"/><path class="pb-lcd" d="${lcd}"/><text class="pb-lcd-digits" x="${HEAD.x + 14.2}" y="${-(HEAD.z0 + 13.2)}" font-size="4.6">${M.METER.totalM3.toFixed(3)}</text><text class="pb-lcd-unit" x="${HEAD.x + 29.4}" y="${-(HEAD.z0 + 8)}" font-size="3">m³</text></g>`);
  const label = { x: HEAD.x + 54, y: HEAD.y + 9, w: 22, d: 10, r: 1.4 };
  out.push(C("cap", S(k.slabOf(label, z, 0.6, P, 3), { tone: "hi", crease: "none" })));
  out.push(L([14, 9].map((w, i) => k.lineOnTop([label.x + 3, label.y + 3.4 + i * 3.2], [label.x + 3 + w, label.y + 3.4 + i * 3.2], z + 0.6, P)).join(""), { tone: "lo", free: true }));
  const screws = [[HEAD.x + 7, HEAD.y + 7], [HEAD.x + HEAD.w - 7, HEAD.y + 7], [HEAD.x + 7, HEAD.y + HEAD.d - 7]];
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, z, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, z])), { size: 0.55, tone: "hi" }));
  const back = halfDisc(PORT.x, PORT.y, PORT.rOut);
  const inner = halfDisc(PORT.x, PORT.y, PORT.rIn).reverse();
  out.push(`<path class="pb-window" d="${k.pathOf(halfDisc(PORT.x, PORT.y, PORT.rIn).map(([x, y]) => at([x, y, z])), true)}"/>`);
  out.push(L(k.pathOf(halfDisc(PORT.x, PORT.y, PORT.rIn).map(([x, y]) => at([x, y, z]))), { tone: "lo" }));
  out.push(C("chrome", S(k.extrude([...back, ...inner], z, PORT.proud, P, { convex: false }), { tone: "hi", crease: "none" })));
  return out.join("");
}

// Faces in the cut plane y = PORT.y, drawn in (x, -z).
const R = (x0, z0, x1, z1) => `M${f(x0)} ${f(-z0)}H${f(x1)}V${f(-z1)}H${f(x0)}Z`;
const RR = (x0, z0, x1, z1, r) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 4).map(([u, v]) => [u, -v]), true);
const dome = (cx, zBase, zTip, w, up) => {
  const hw = w / 2;
  const s = up ? -1 : 1;
  const shoulder = zTip + s * hw;
  return `M${f(cx - hw)} ${f(-zBase)}V${f(-shoulder)}A${f(hw)} ${f(hw)} 0 0 ${up ? 1 : 0} ${f(cx + hw)} ${f(-shoulder)}V${f(-zBase)}Z`;
};

function meterSection() {
  const x0 = NOTCH.x0, x1 = NOTCH.x1, cx = PORT.x;
  const top = HEAD.z1;
  const parts = [
    `<path class="sx-meter" d="${R(x0, NOTCH_Z, x1, top)}"/>`,
    `<path class="sx-cavity" d="${R(x0 + 2.2, NOTCH_Z, x1 - 2.2, top - 2.4)}"/>`,
    `<path class="sx-pcb" d="${R(x0 + 2.2, NOTCH_Z + 2.4, x1 - 2.2, NOTCH_Z + 4)}"/>`,
    `<path class="sx-window" d="${R(cx - PORT.rIn, top - 2.4, cx + PORT.rIn, top)}"/>`,
    `<path class="sx-steel" d="${R(cx - PORT.rOut, top - 1.6, cx - PORT.rIn, top + PORT.proud)}"/>`,
    `<path class="sx-steel" d="${R(cx + PORT.rIn, top - 1.6, cx + PORT.rOut, top + PORT.proud)}"/>`,
    `<path class="sx-lead" d="M${cx - LED_X - 0.7} ${-(NOTCH_Z + 4)}V${-(NOTCH_Z + 6)}M${cx - LED_X + 0.7} ${-(NOTCH_Z + 4)}V${-(NOTCH_Z + 6)}M${cx + LED_X - 0.7} ${-(NOTCH_Z + 4)}V${-(NOTCH_Z + 6)}M${cx + LED_X + 0.7} ${-(NOTCH_Z + 4)}V${-(NOTCH_Z + 6)}"/>`,
    `<path class="sx-sensor" data-part="meter-sensor" d="${dome(cx - LED_X, NOTCH_Z + 6, top - 2.9, 3, true)}"/>`,
    `<path class="sx-led" data-part="meter-led" d="${dome(cx + LED_X, NOTCH_Z + 6, top - 2.9, 3, true)}"/>`,
    `<path class="sx-chip" d="${R(cx - 13, NOTCH_Z + 4, cx - 8.5, NOTCH_Z + 5.6)}"/>`,
    `<path class="sx-chip" d="${R(cx + 9, NOTCH_Z + 4, cx + 14, NOTCH_Z + 5.2)}"/>`,
  ];
  return `<g transform="${facePlane(PORT.y)}" class="sx">${parts.join("")}</g>`;
}

function probe() {
  const out = [];
  const z0 = PROBE.z0;
  const az = (P.azimuth * Math.PI) / 180;
  const seam = halfDisc(PORT.x, PORT.y, PROBE.r, 96).filter(([x, y]) => Math.cos(Math.atan2(y - PORT.y, x - PORT.x) - az) > 0);
  out.push(C("black", S(k.extrude(halfDisc(PORT.x, PORT.y, PROBE.r, 48), z0, PROBE.h, P, { bevel: 0.8 }), { tone: "hi", inner: L(k.pathOf(seam.map(([x, y]) => at([x, y, z0 + 4.2]))), { tone: "faint" }) })));
  out.push(C("black", S(k.extrude(halfDisc(PORT.x, PORT.y, 5.6, 24), PROBE_TOP, 3.5, P), { tone: "hi" })));
  out.push(C("black", S(k.extrude(halfDisc(PORT.x, PORT.y, 4.2, 24), PROBE_TOP + 3.5, 4, P), { tone: "hi" })));
  out.push(D(G.dotsOf(zAxis(PORT.x, PORT.y, 0), PROBE_TOP, PROBE.r - 3, 3, P, { phase: Math.PI * 1.25, all: true }).slice(0, 2), { size: 0.5, tone: "hi" }));
  const cx = PORT.x, base = z0;
  const parts = [
    `<path class="sx-shell" d="${RR(cx - PROBE.r, base, cx + PROBE.r, PROBE_TOP, 2.4)}"/>`,
    `<path class="sx-cavity" d="${R(cx - PROBE.r + 2, base + 4.2, cx + PROBE.r - 2, PROBE_TOP - 2)}"/>`,
    `<path class="sx-steel" d="${R(cx - 15, base, cx - 9.5, base + 4.2)}"/>`,
    `<path class="sx-steel" d="${R(cx + 9.5, base, cx + 15, base + 4.2)}"/>`,
    `<path class="sx-shell" d="${R(cx - 9.5, base, cx - LED_X - 1.9, base + 1.4)}"/>`,
    `<path class="sx-shell" d="${R(cx - LED_X + 1.9, base, cx + LED_X - 1.9, base + 1.4)}"/>`,
    `<path class="sx-shell" d="${R(cx + LED_X + 1.9, base, cx + 9.5, base + 1.4)}"/>`,
    `<path class="sx-filter" d="${R(cx - 9.5, base + 1.4, cx + 9.5, base + 2.4)}"/>`,
    `<path class="sx-pcb" d="${R(cx - PROBE.r + 2, base + 8.4, cx + PROBE.r - 2, base + 10)}"/>`,
    `<path class="sx-lead" d="M${cx - LED_X - 0.7} ${-(base + 7)}V${-(base + 8.4)}M${cx - LED_X + 0.7} ${-(base + 7)}V${-(base + 8.4)}M${cx + LED_X - 0.7} ${-(base + 7)}V${-(base + 8.4)}M${cx + LED_X + 0.7} ${-(base + 7)}V${-(base + 8.4)}"/>`,
    `<path class="sx-led" data-part="probe-led" d="${dome(cx - LED_X, base + 7, base + 2.9, 3, false)}"/>`,
    `<path class="sx-sensor" data-part="probe-sensor" d="${dome(cx + LED_X, base + 7, base + 2.9, 3, false)}"/>`,
    `<path class="sx-resistor" d="${RR(cx - 12.5, base + 10, cx - 7, base + 11.8, 0.6)}"/>`,
    `<path class="sx-resistor" d="${RR(cx + 7, base + 10, cx + 12.5, base + 11.8, 0.6)}"/>`,
    `<path class="sx-bands" d="M${cx - 11.2} ${-(base + 10)}V${-(base + 11.8)}M${cx - 10.2} ${-(base + 10)}V${-(base + 11.8)}M${cx + 8.4} ${-(base + 10)}V${-(base + 11.8)}M${cx + 9.4} ${-(base + 10)}V${-(base + 11.8)}"/>`,
    `<path class="sx-wire" data-wire="red" d="M${cx - 5} ${-(base + 10)}C${cx - 5} ${-(base + 16)} ${cx - 1.6} ${-(base + 18)} ${cx - 1.4} ${-(PROBE_TOP - 0.4)}"/>`,
    `<path class="sx-wire" data-wire="black" d="M${cx - 2} ${-(base + 10)}C${cx - 2} ${-(base + 15)} ${cx - 0.5} ${-(base + 18)} ${cx - 0.45} ${-(PROBE_TOP - 0.4)}"/>`,
    `<path class="sx-wire" data-wire="white" d="M${cx + 2} ${-(base + 10)}C${cx + 2} ${-(base + 15)} ${cx + 0.5} ${-(base + 18)} ${cx + 0.45} ${-(PROBE_TOP - 0.4)}"/>`,
    `<path class="sx-wire" data-wire="green" d="M${cx + 5} ${-(base + 10)}C${cx + 5} ${-(base + 16)} ${cx + 1.6} ${-(base + 18)} ${cx + 1.4} ${-(PROBE_TOP - 0.4)}"/>`,
    `<path class="sx-shell" d="${R(cx - 5.6, PROBE_TOP, cx + 5.6, PROBE_TOP + 3.5)}"/>`,
    `<path class="sx-shell" d="${R(cx - 4.2, PROBE_TOP + 3.5, cx + 4.2, BOOT_TOP)}"/>`,
    `<path class="sx-core" d="${R(cx - 2.1, PROBE_TOP - 2, cx + 2.1, BOOT_TOP)}"/>`,
  ];
  out.push(`<g transform="${facePlane(PORT.y)}" class="sx">${parts.join("")}</g>`);
  return `<g data-part="probe">${out.join("")}</g>`;
}

function beams() {
  const cx = PORT.x;
  const z0 = HEAD.z1 - 2.9, z1 = PROBE.z0 + 2.9;
  const beam = (x, dir) => `<g data-part="beam-${dir}" style="opacity:0"><ellipse class="sx-glow" cx="${x}" cy="${-(z0 + z1) / 2}" rx="5.2" ry="${(z1 - z0) / 2 + 3.4}"/><path class="sx-beam" d="${R(x - 1.3, z0, x + 1.3, z1)}"/></g>`;
  return `<g transform="${facePlane(PORT.y + 0.05)}">${beam(cx - LED_X, "tx")}${beam(cx + LED_X, "rx")}</g>`;
}

function phone() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PHONE, 0, 3, P)}"/>`];
  out.push(C("phone", S(k.slabOf(PHONE, 0, PHONE.h, P, 10, 1), { tone: "hi", inner: L(k.sideSeam(PHONE, PHONE.h - 1.6, P, 10), { tone: "faint" }) })));
  out.push(`<path class="pb-screen" d="${k.planOutline(SCREEN, PHONE.h, P, 8)}"/>`);
  out.push(L(k.planOutline(SCREEN, PHONE.h, P, 8), { tone: "hi" }));
  const rows = Array.from({ length: 8 }, (_, i) => `<text class="pb-term" data-row="${i}" x="0" y="${i * 7.1}" font-size="4.3"></text>`).join("");
  out.push(`<g transform="${k.topMatrix([SCREEN.x + 4, SCREEN.y + 8.4], PHONE.h, P, "x")}" data-part="screen">${rows}</g>`);
  out.push(L(k.planOutline({ x: PHONE.x + PHONE.w - 2.6, y: PHONE.y + 26, w: 1.2, d: 14, r: 0.6 }, PHONE.h, P, 3), { tone: "faint" }));
  out.push(D([at([PHONE.x + PHONE.w - 2, PHONE.y + 47, PHONE.h])], { size: 0.8, tone: "hi" }));
  const button = (y, w) => S(k.slabOf({ x: PHONE.x + 40 + y, y: PHONE.y + PHONE.d - 0.2, w, d: 1.1, r: 0.5 }, 2.4, 3, P, 2), { tone: "hi" });
  out.push(C("phone", button(0, 16) + button(22, 10)));
  return out.join("");
}

function plug() {
  const y = PLUG.y, z = PLUG.z;
  const plan = { x: PLUG.x0, y: y - PLUG.half, w: PLUG.x1 - PLUG.x0, d: PLUG.half * 2, r: 2.6 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, 2, P)}"/>`];
  out.push(C("black", S(G.disc(BOOT.x0, PLUG.x0, BOOT.r, xAxis(0, y, z), P), { tone: "hi", inner: L(G.arcOf(xAxis(0, y, z), BOOT.x0 + 4, BOOT.r, P), { tone: "faint" }) })));
  out.push(C("black", S(k.slabOf(plan, PLUG.z0, z - PLUG.z0, P, 4, 0.6), { tone: "hi" })));
  const pcb = { x: PLUG.x0 + 2, y: y - 4.6, w: PLUG.x1 - PLUG.x0 - 3, d: 9.2, r: 0.8 };
  out.push(C("pcb", S(k.slabOf(pcb, z, 0.8, P, 2), { tone: "hi" })));
  const chip = { x: PLUG.x0 + 10, y: y - 2.65, w: 10.2, d: 5.3, r: 0.3 };
  const pins = [];
  for (let i = 0; i < 14; i++) {
    const px = chip.x + 0.6 + i * 0.65;
    pins.push(k.lineOnTop([px, chip.y - 0.9], [px, chip.y], z + 0.8, P), k.lineOnTop([px, chip.y + chip.d], [px, chip.y + chip.d + 0.9], z + 0.8, P));
  }
  out.push(L(pins.join(""), { tone: "mid" }));
  out.push(C("chip", S(k.slabOf(chip, z + 0.8, 1.5, P, 2, 0.2), { tone: "hi" })));
  out.push(D([at([chip.x + 1.2, chip.y + 1.1, z + 2.3])], { size: 0.45, tone: "hi" }));
  out.push(`<g transform="${k.topMatrix([chip.x + 1.6, chip.y + 3.6], z + 2.3, P, "x")}"><text class="pb-chip-text" font-size="1.9">FT232R</text></g>`);
  out.push(C("cap", S(k.slabOf({ x: PLUG.x0 + 22.5, y: y + 1, w: 1.6, d: 2.6, r: 0.2 }, z + 0.8, 1, P, 2), { tone: "hi" })));
  const pad = (dy) => [PLUG.x0 + 3.4, y + dy];
  const wire = (dy, end, name) => `<path class="pb-wire" data-wire="${name}" d="${k.pathOf([at([PLUG.x0 - 0.2, y + dy * 0.4, z + 0.8]), at([...pad(dy), z + 0.8]), at([...end, z + 0.8])])}"/>`;
  out.push(wire(-3, [chip.x - 0.4, y - 3], "red") + wire(-1, [chip.x - 0.4, y - 1], "black") + wire(1, [chip.x - 0.4, y + 1], "white") + wire(3, [chip.x - 0.4, y + 3], "green"));
  out.push(C("chrome", S(k.slabOf({ x: PLUG.x1 - 1.6, y: y - 4.2, w: 1.6, d: 8.4, r: 1 }, z - 1.3, 2.6, P, 3), { tone: "hi" })));
  return `<g data-part="plug">${out.join("")}</g>`;
}

function magnifierStand() {
  const base = { x: POST.x - 17, y: POST.y - 17, w: 34, d: 34, r: 17 };
  const out = [`<path class="iso-halo" d="${k.haloOf(base, 0, 3, P)}"/>`];
  out.push(C("red", S(k.cylinder(POST.x, POST.y, 17, 0, 6, P, 64, 0.8), { tone: "hi", inner: L(k.sideArc(POST.x, POST.y, 17, 2, P, 48), { tone: "faint" }) })));
  out.push(L(k.ring(POST.x, POST.y, 11, 6, P, 40), { tone: "faint" }));
  out.push(C("chrome", S(k.cylinder(POST.x, POST.y, 6, 6, 4, P, 28, 0.4), { tone: "hi" })));
  out.push(C("chrome", S(k.cylinder(POST.x, POST.y, POST.r, 10, POST.top - 10, P, 20), { tone: "hi", inner: L(k.sideArc(POST.x, POST.y, POST.r, POST.top - 18, P, 16), { tone: "faint" }) })));
  return out.join("");
}

function magnifier(content) {
  const [cx, cy] = at(JOINT);
  const r = LENS.r, rim = LENS.rim;
  const out = [];
  const arm = G.frameAlong(ARM_ROOT, RIGHT);
  out.push(C("chrome", S(G.disc(-1, 15, 2.2, arm, P), { tone: "hi" })));
  out.push(C("chrome", S(G.sphereOf([POST.x, POST.y, POST.top], 4.4, P), { tone: "hi" })));
  out.push(`<clipPath id="pb-lens"><circle cx="${f(cx)}" cy="${f(cy)}" r="${r}"/></clipPath>`);
  out.push(`<g clip-path="url(#pb-lens)"><circle class="pb-lens-bg" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/>`);
  out.push(`<g transform="translate(${f(cx)} ${f(cy)}) scale(${LENS.mag}) translate(${f(-cx)} ${f(-cy)})">${content}</g>`);
  out.push(`<circle class="pb-glass" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/>`);
  const a0 = (200 * Math.PI) / 180, a1 = (262 * Math.PI) / 180, ri = r * 0.8, ro = r * 0.9;
  const pt = (rr, a) => `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  out.push(`<path class="pb-shine" d="M${pt(ro, a0)}A${ro} ${ro} 0 0 1 ${pt(ro, a1)}L${pt(ri, a1)}A${ri} ${ri} 0 0 0 ${pt(ri, a0)}Z"/></g>`);
  out.push(`<circle class="pb-rim" cx="${f(cx)}" cy="${f(cy)}" r="${r + rim / 2}" stroke-width="${rim}"/>`);
  out.push(`<circle class="pb-rim-line" cx="${f(cx)}" cy="${f(cy)}" r="${r}"/><circle class="pb-rim-line" cx="${f(cx)}" cy="${f(cy)}" r="${r + rim}"/>`);
  return `<g class="pb-lens">${out.join("")}</g>`;
}

const LENS_AT = at(JOINT);
const SOUNDS = {
  plug: at([PLUG.x0 - 8, PLUG.y + 22, 16]),
  probe: [LENS_AT[0] - LENS.r - 34, LENS_AT[1] - LENS.r * 0.55],
  light: [LENS_AT[0] - LENS.r * 0.55, LENS_AT[1] + LENS.r + 22],
  phone: at([PHONE.x + 108, PHONE.y + 8, 30]),
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A smart water meter on a brass pipe with an optical probe on its port, cut in half so the probe's infrared LED and light sensor face the meter's own sensor and LED; the probe's cable runs to a USB-C plug, opened to show its FT232 chip, plugged into a phone that shows the conversation.",
  body: [
    bench(),
    stand(PIPE.x0 + 10),
    C("chrome", S(G.solidOf([[PIPE.x0 - 8, 6.5, 1], [PIPE.x0 - 6.4, 10, 1], [PIPE.x0 - 4.4, 11.8], [PIPE.x0, 11.8]], xAxis(0, PIPE.y, PIPE.z), P), { tone: "hi" })),
    pipeRun(PIPE.x0, -84),
    valve(-76),
    pipeRun(-64, MX - 64),
    meterBody(),
    pipeRun(MX + 64, PIPE.x1),
    stand(PIPE.x1 - 10),
    C("chrome", S(G.solidOf([[PIPE.x1, 11.8], [PIPE.x1 + 4.4, 11.8], [PIPE.x1 + 6.4, 10, 1], [PIPE.x1 + 8, 6.5, 1]], xAxis(0, PIPE.y, PIPE.z), P), { tone: "hi" })),
    head(),
    headTop(),
    probe(),
    beams(),
    `<g data-part="cable"><path class="pb-cable-out"/><path class="pb-cable-in"/><path class="pb-cable-shine"/></g>`,
    plug(),
    magnifierStand(),
    phone(),
    magnifier(head() + headTop() + probe() + beams()),
  ],
});

const STEPS = [
  { label: "Plug in USB-C", hint: "Push the plug into the phone. The phone gives it 5 volts, and the little chip inside the plug wakes up.", dur: 2.0, real: null, sound: { word: "click", at: SOUNDS.plug, from: 0.55, to: 0.95 } },
  { label: "Snap the probe onto the port", hint: "Bring the probe to the steel ring on the meter. Its magnet grabs the ring and lines the lights up.", dur: 2.2, real: null, sound: { word: "clack!", at: SOUNDS.probe, from: 0.66, to: 0.98 } },
  { label: "Send the wake-up “/?!”", hint: "The probe's light blinks five letters at the meter: / ? ! and two line ends. Light on means 0, dark means 1.", dur: 6.5, real: M.lengthOf(M.TALK.wake), sound: { word: "blink blink", at: SOUNDS.light, from: 0.05, to: 0.9 } },
  { label: "Meter says who it is", hint: "The meter waits a moment, then blinks its name back. The 5 in it means “I can go 32 times faster.”", dur: 6.0, real: M.lengthOf(M.TALK.ident), sound: { word: "blink blink", at: SOUNDS.light, from: 0.25, to: 0.95 } },
  { label: "Agree on a faster speed", hint: "The phone answers OK with one special letter. Then both sides switch from 300 to 9600 bits a second.", dur: 4.4, real: M.lengthOf(M.TALK.option), sound: { word: "zip!", at: SOUNDS.light, from: 0.1, to: 0.8 } },
  { label: "Read the meter total", hint: "Now the meter blinks its whole reading, very fast: 1234.567 cubic metres of water so far.", dur: 5.0, real: M.lengthOf(M.TALK.read), sound: { word: "blinkblinkblink", at: SOUNDS.light, from: 0.3, to: 0.95 } },
  { label: "Check the checksum", hint: "The phone mixes every letter into one number. It matches the meter's last letter, so nothing got lost.", dur: 3.3, real: null, sound: { word: "beep!", at: SOUNDS.phone, from: 0.3, to: 0.9 } },
];

const live = `
${MODEL_SRC}
const P = ${JSON.stringify(P)};
const SCALE = ${SCALE};
const STEPS = ${JSON.stringify(STEPS)};
const LIFT = ${PROBE.lift}, UNPLUG = ${PLUG.unplug}, CABLE_R = ${CABLE_R};
const PORT = ${JSON.stringify(PORT)}, BOOT_TOP = ${BOOT_TOP};
const PLUG_END = ${JSON.stringify([BOOT.x0, PLUG.y, PLUG.z])};
const TALKS = [null, null, TALK.wake, TALK.ident, TALK.option, TALK.read, null];
const svg = document.querySelector(".bk-card svg");
const q = (sel) => svg.querySelector(sel);
const all = (name) => [...svg.querySelectorAll('[data-part="' + name + '"]')];
const plugEl = q('[data-part="plug"]');
const probeEls = all("probe"), beamTx = all("beam-tx"), beamRx = all("beam-rx");
const probeLed = all("probe-led"), probeSensor = all("probe-sensor"), meterLed = all("meter-led"), meterSensor = all("meter-sensor");
const set = (els, fn) => els.forEach(fn);
const wireTx = svg.querySelectorAll('[data-wire="white"]'), wireRx = svg.querySelectorAll('[data-wire="green"]');
const rows = [...svg.querySelectorAll('[data-part="screen"] text')];
const screenEl = q(".pb-screen");
const [cableOut, cableIn, cableShine] = q('[data-part="cable"]').children;
const scope = document.querySelector("[data-scope]");

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.min(1, Math.max(0, t));
function snap(p) {
  if (p < 0.6) return 0.8 * smooth(p / 0.6);
  if (p < 0.7) { const u = (p - 0.6) / 0.1; return 0.8 + 0.2 * u * u; }
  const u = (p - 0.7) / 0.3;
  return 1 - 0.04 * Math.abs(Math.sin(u * Math.PI * 2)) * Math.exp(-4 * u);
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
function cable(dx, lift) {
  const top = [PORT.x, PORT.y, BOOT_TOP + lift];
  const end = [PLUG_END[0] + dx, PLUG_END[1], PLUG_END[2]];
  const route = [top, [PORT.x, PORT.y, BOOT_TOP + 12 + lift], [PORT.x - 24, PORT.y + 10, BOOT_TOP + 20 + lift * 0.7], [-70, -6, 112], [-77, 4, 52], [-72, 16, CABLE_R], [-50, 52, CABLE_R], [end[0] - 16, end[1], end[2] - 1.2], end];
  const d = pathOf(catmull(route).map((p) => iso(p, P)));
  const w = 2 * CABLE_R * SCALE;
  cableOut.setAttribute("d", d); cableOut.style.strokeWidth = (w + 1.6).toFixed(2);
  cableIn.setAttribute("d", d); cableIn.style.strokeWidth = (w - 1).toFixed(2);
  cableShine.setAttribute("d", d); cableShine.style.strokeWidth = (w * 0.22).toFixed(2);
}

const HEADER = (baud) => "OptoRead  ·  FT232R  ·  " + baud + " 7E1";
function screen(i, p) {
  const lines = ["", "", "", "", "", "", "", ""];
  const on = i >= 0;
  screenEl.toggleAttribute("data-on", on && (i > 0 || p > 0.75));
  if (!(on && (i > 0 || p > 0.75))) return lines;
  lines[0] = HEADER(i > 4 || (i === 4 && p >= 1) ? FAST_BAUD : LINK.startBaud);
  const sent = (step, talk) => (i > step ? talk[0].text.length : i === step ? sentBy(talk[0], p * lengthOf(talk)) : 0);
  const a = sent(2, TALK.wake), b = sent(3, TALK.ident), c = sent(4, TALK.option), d = sent(5, TALK.read);
  if (i >= 2) lines[1] = "> " + show(SIGN_ON.slice(0, a));
  if (i >= 3) lines[2] = "< " + show(IDENT.slice(0, b));
  if (i >= 4) lines[3] = "> " + show(OPTION.slice(0, c)) + (c === OPTION.length && (i > 4 || p >= 1) ? "   now " + FAST_BAUD + " baud" : "");
  if (i >= 5) {
    const got = READOUT.slice(1, d).split("\\r\\n");
    for (let r = 0; r < 3; r++) if (got[r] !== undefined && (r === 0 || got[r - 1] !== undefined)) lines[4 + r] = "< " + show(got[r]);
  }
  if (i >= 6 && p > 0.25) lines[7] = "BCC " + hex(BCC) + " = " + hex(BCC) + " ✓" + (p > 0.55 ? "   total " + METER.totalM3.toFixed(3) + " m³" : "");
  return lines;
}

const BITNAMES = ["S", "0", "1", "2", "3", "4", "5", "6", "P", "E"];
function scopeHtml(line) {
  const W = 300, cell = W / 10, H = 46;
  let wave = "", fills = "", labels = "";
  const bits = line ? frameOf(line.code) : Array(10).fill(1);
  wave = "M0 10";
  bits.forEach((b, j) => {
    const ny = b ? 10 : 34;
    wave += "V" + ny + "H" + (j + 1) * cell;
    if (!b) fills += '<rect x="' + j * cell + '" y="8" width="' + cell + '" height="28" class="sc-on' + (line && j === line.index ? ' sc-now' : '') + '"/>';
    else if (line && j === line.index) fills += '<rect x="' + j * cell + '" y="8" width="' + cell + '" height="28" class="sc-now-dark"/>';
    labels += '<text x="' + (j + 0.5) * cell + '" y="' + (H + 6) + '">' + BITNAMES[j] + "</text>";
  });
  const ch = line ? show(String.fromCharCode(line.code)) : "—";
  const who = line ? (line.dir === "tx" ? "phone → meter" : "meter → phone") : "line resting";
  return '<svg viewBox="-4 0 ' + (W + 8) + ' ' + (H + 12) + '" class="sc-svg" aria-hidden="true">' + fills + '<path class="sc-wave" d="' + wave + '"/>' + labels + "</svg>" +
    '<div class="sc-meta"><b>' + ch + "</b><span>" + (line ? hex(line.code) : "") + "</span><span>" + who + "</span><span>" + (line ? line.baud + " baud" : "") + "</span></div>";
}

let lastScope = "", lastGlow = { tx: 0, rx: 0 };
window.tickProbe = () => Math.max(lastGlow.tx, lastGlow.rx);
function pose(i, p) {
  const plugIn = i < 0 ? 0 : i === 0 ? smooth(clamp(p / 0.85)) : 1;
  const dx = UNPLUG * (1 - plugIn);
  plugEl.setAttribute("transform", translateAlong(P, [dx, 0, 0]));
  const down = i < 1 ? 0 : i === 1 ? snap(p) : 1;
  const lift = LIFT * (1 - down);
  const moved = translateAlong(P, [0, 0, lift]);
  set(probeEls, (el) => el.setAttribute("transform", moved));
  cable(dx, lift);

  const talk = i >= 0 ? TALKS[i] : null;
  let glow = { tx: 0, rx: 0 }, line = null;
  if (talk && p < 1) {
    const len = lengthOf(talk), step = STEPS[i];
    const r = p * len, dr = len / step.dur / 60;
    glow = glowBetween(talk, Math.max(0, r - dr), r);
    line = lineAt(talk, r);
  }
  lastGlow = glow;
  set(beamTx, (el) => { el.style.opacity = glow.tx.toFixed(2); });
  set(beamRx, (el) => { el.style.opacity = glow.rx.toFixed(2); });
  set(probeLed, (el) => el.toggleAttribute("data-lit", glow.tx > 0.35));
  set(meterSensor, (el) => el.toggleAttribute("data-lit", glow.tx > 0.35));
  set(meterLed, (el) => el.toggleAttribute("data-lit", glow.rx > 0.35));
  set(probeSensor, (el) => el.toggleAttribute("data-lit", glow.rx > 0.35));
  wireTx.forEach((w) => w.toggleAttribute("data-lit", !!line && line.dir === "tx"));
  wireRx.forEach((w) => w.toggleAttribute("data-lit", !!line && line.dir === "rx"));

  const lines = screen(i, p);
  rows.forEach((row, r) => { if (row.textContent !== lines[r]) row.textContent = lines[r]; });
  const html = scopeHtml(line);
  if (html !== lastScope) { scope.innerHTML = html; lastScope = html; }
}

function realSoFar(i, p) {
  let s = 0;
  for (let k = 0; k <= i; k++) if (TALKS[k]) s += (k < i ? 1 : p) * lengthOf(TALKS[k]);
  return s;
}
function chips(i, p) {
  const fast = i > 4 || (i === 4 && p >= 1);
  const baud = fast ? FAST_BAUD : LINK.startBaud;
  const talk = i >= 0 ? TALKS[i] : null;
  const line = talk && p < 1 ? lineAt(talk, p * lengthOf(talk)) : null;
  const count = (dir) => {
    let n = 0;
    TALKS.forEach((t, k) => { if (t && k <= i) for (const s of t) if (s.dir === dir) n += k < i ? s.text.length : sentBy(s, p * lengthOf(t)); });
    return n;
  };
  return [
    { k: "Light", v: LINK.wavelengthNm + " nm, invisible", hot: !!line },
    { k: "Speed", v: baud + " baud", hot: i === 4 },
    { k: "One letter", v: (charSeconds(baud) * 1000).toFixed(fast ? 2 : 1) + " ms" },
    { k: "Phone sent", v: count("tx") + " letters" },
    { k: "Meter sent", v: count("rx") + " letters" },
    { k: "Real time", v: realSoFar(i, p).toFixed(3) + " s" },
    { k: "Meter total", v: i > 5 || (i === 5 && p >= 1) ? METER.totalM3.toFixed(3) + " m³" : "—", hot: i === 6 },
    { k: "Checksum", v: i === 6 && p > 0.25 ? hex(BCC) + " ✓" : "—", hot: i === 6 && p > 0.25 },
  ];
}

const swatches = [...document.querySelectorAll("[data-swatch]")];
swatches.forEach((b) => b.addEventListener("click", () => {
  swatches.forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
  const [top, mid, dark] = b.dataset.swatch.split(",");
  svg.style.setProperty("--m-top", top); svg.style.setProperty("--m-mid", mid); svg.style.setProperty("--m-dark", dark);
}));
const camera = document.querySelector("[data-camera]");
camera.addEventListener("change", () => svg.toggleAttribute("data-camera", camera.checked));

mountStepper({
  key: "probe-fig1",
  svg,
  steps: STEPS,
  intro: "Press step 1 to start. Then watch the light jump between the probe and the meter.",
  outro: "Done! The phone read the meter with nothing but flashes of light.",
  pose,
  chips,
});
`;

const css = `
.pb-lcd{fill:#c9d8b4;stroke:var(--ink);stroke-width:.8px}
.pb-lcd-bezel{fill:#2f3445;stroke:var(--ink);stroke-width:1.1px}
.pb-lcd-digits{font-family:var(--font-mono);font-weight:700;fill:#26331d;letter-spacing:-.02em}
.pb-lcd-unit{font-family:var(--font-mono);font-weight:700;fill:#26331d}
.pb-window{fill:rgba(190,178,235,.75);stroke:none}
.pb-screen{fill:#0f1626;stroke:none;transition:fill .5s}
.pb-screen[data-on]{fill:#17233b}
.pb-term{font-family:var(--font-mono);font-weight:700;fill:#9ff0c0;white-space:pre}
.pb-term[data-row="0"]{fill:#f6c445}
.pb-term[data-row="7"]{fill:#ffffff}
.pb-chip-text{font-family:var(--font-mono);font-weight:700;fill:#cfd3dc;letter-spacing:.02em}
.pb-wire{fill:none;stroke-width:1px;stroke-linecap:round}
svg path[data-wire="red"]{stroke:#e0644f}svg path[data-wire="black"]{stroke:#1f2a44}svg path[data-wire="white"]{stroke:#b9b2a0}svg path[data-wire="green"]{stroke:#3f9a60}
svg path[data-wire][data-lit]{stroke:#f2b400;filter:drop-shadow(0 0 1.5px #ffd84a)}
.pb-cable-out{fill:none;stroke:var(--ink);stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important}
.pb-cable-in{fill:none;stroke:#474e62;stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important}
.pb-cable-shine{fill:none;stroke:#7a8299;stroke-linecap:round;stroke-linejoin:round;vector-effect:none!important;transform:translate(-.6px,-.7px)}
.sx path{stroke:var(--ink);stroke-width:.9px;stroke-linejoin:round}
.sx-shell{fill:#5d6479}.sx-cavity{fill:#dfe4ee}.sx-steel{fill:#cfd6df}.sx-filter{fill:#7d2c3d}
.sx-meter{fill:var(--m-mid,#5f8fd0)}
.sx-pcb{fill:#4fa36c}.sx-chip{fill:#2f3445}.sx-resistor{fill:#e9d6a8}.sx-core{fill:#a46a3a}
.sx .sx-bands{fill:none;stroke:#b84835;stroke-width:.9px}
.sx .sx-lead{fill:none;stroke:#8a93a6;stroke-width:1px}
.sx-window{fill:rgba(190,178,235,.85)}
.sx-led{fill:#fffdf6;transition:fill .08s}
.sx-sensor{fill:#232838}
.sx-led[data-lit]{fill:var(--ir)}
.sx-sensor[data-lit]{fill:#7d2c3d}
.sx .sx-wire{fill:none;stroke-width:1.4px}
.sx-glow{fill:var(--ir);opacity:.28;filter:blur(2px)}
.sx-beam{fill:var(--ir);stroke:none!important}
svg[data-camera] .sx-glow,svg[data-camera] .sx-beam,svg[data-camera] .sx-led[data-lit]{fill:var(--cam)}
svg[data-camera] .sx-glow{opacity:.55}
.bk-scope{display:grid;gap:6px}
.sc-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px}
.sc-svg{width:min(360px,100%);height:auto;display:block}
.sc-meta{grid-auto-flow:row}
.sc-wave{fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round}
.sc-on{fill:var(--ir-soft)}
.sc-now{fill:rgba(226,73,91,.5)}
.sc-now-dark{fill:rgba(31,42,68,.12)}
.sc-svg text{font:700 10px var(--font-mono);fill:var(--ink-soft);text-anchor:middle}
.sc-meta{display:grid;gap:2px;min-width:150px;font-size:13px;color:var(--ink-soft);font-weight:700}
.sc-meta b{font:800 26px/1 var(--font-mono);color:var(--ink)}
.bk-scope p{margin:0;font-size:13px;color:var(--ink-soft);font-weight:700}
.pb-lens-bg{fill:#ecc993}
.pb-glass{fill:rgba(190,220,255,.1);stroke:none}
.pb-shine{fill:#ffffff;opacity:.45}
.pb-rim{fill:none;stroke:#e0644f;vector-effect:none!important}
.pb-rim-line{fill:none;stroke:var(--ink);stroke-width:1.3px}
`;

const extras = `
<div class="bk-panel bk-scope"><div class="sc-row" data-scope></div><p>The bits of the letter on the light right now. Light on = 0, dark = 1, so the line rests dark. Each letter: start bit, 7 data bits, a parity bit that keeps the count of 1s even, and a stop bit.</p></div>
<div class="bk-extras">
  <div class="bk-swatches">Meter colour
    <button class="bk-swatch" type="button" aria-label="Blue" aria-pressed="true" data-swatch="#8fb7ea,#5f8fd0,#4370b0" style="background:#5f8fd0"></button>
    <button class="bk-swatch" type="button" aria-label="Teal" aria-pressed="false" data-swatch="#93d9c9,#4fb3a2,#378a7c" style="background:#4fb3a2"></button>
    <button class="bk-swatch" type="button" aria-label="Orange" aria-pressed="false" data-swatch="#f6b77a,#e58c43,#bf6a26" style="background:#e58c43"></button>
    <button class="bk-swatch" type="button" aria-label="Plum" aria-pressed="false" data-swatch="#cfb0e3,#a07bc0,#7c5a9c" style="background:#a07bc0"></button>
  </div>
  <label class="bk-toggle"><input type="checkbox" data-camera> See it like a phone camera <small>(your eye can't see 940 nm; most phone cameras can)</small></label>
</div>`;

const sources = [
  "Mode C conversation (300 baud sign-on <code>/?!</code>, the meter's identification with its speed letter, the acknowledgement <code>␆0Z0</code>, then data at the new speed) and the BCC rule (XOR of every byte after STX up to and including ETX): IEC 62056-21, as summarised in the <a href=\"https://www.openmuc.org/iec-62056-21/\" target=\"_blank\" rel=\"noopener\">OpenMUC j62056 guide</a> and <a href=\"https://doc.ipesoft.com/display/D2DOCV26EN/IEC+62056-21:2002+Serial\" target=\"_blank\" rel=\"noopener\">Ipesoft D2000 docs</a>.",
  "300 baud, 7 data bits, even parity, 1 stop bit at sign-on: reported from real meters on the <a href=\"https://forum.mysensors.org/post/98000\" target=\"_blank\" rel=\"noopener\">MySensors forum</a>. 10 bits per letter gives 33.3 ms per letter at 300 baud and 1.04 ms at 9600.",
  "200 ms: the meter's minimum reaction time before it answers (Ipesoft docs, quoting the standard).",
  "Light on = 0, dark = 1, so the line rests dark: how DIY read heads wire the LED and sensor to a UART; check it against the standard's optical clause before you rely on it.",
  "940 nm: typical of these probes' LEDs (product listings, e.g. <a href=\"https://www.tindie.com/products/embedded4ever/62056-21-iec1107-optical-probe/\" target=\"_blank\" rel=\"noopener\">this one on Tindie</a>, give ~900 nm send and 800–1000 nm receive).",
  "<code>8-0:1.0.0</code>: OBIS medium 8 is water (IEC 62056-6-1, see <a href=\"https://itwissen.info/en/object-identification-system-smart-meter-OBIS-126702.html\" target=\"_blank\" rel=\"noopener\">ITWissen</a>). The rest of the code, the maker <code>WPA</code>, the serial and the total are invented for this figure. Your meter's manual lists its real registers.",
  "The probe is drawn after the MY015-D: a magnetic cup about 34 mm across with an LED and a sensor side by side, and an FT232 USB-to-serial chip in its USB-C plug.",
];

const page = bookPage({
  fig: "Fig 1",
  title: "Reading the meter",
  question: "How does an optical probe read a smart water meter?",
  label: "Optical probe reading a water meter. Use the step buttons to play each step.",
  svg,
  extras,
  idea: "The big idea: <em>the probe is a serial cable whose wire is a beam of invisible light.</em>",
  sources,
  css,
  script: kitScript() + "\n" + live,
});

writeFileSync(join(HERE, "index.html"), page);
console.log("wrote index.html", (page.length / 1024).toFixed(0) + " KB");
