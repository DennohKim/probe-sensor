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

// World in millimetres: x along the pipe (the water flows toward +x), y toward the front, z up. Bench top is z = 0.
// The meter is cut open along the plane y = 0 through the pipe axis; its front half is removed.
const PLATE = { x: -117, y: -46, w: 230, d: 78, r: 10 };
const PLATE_H = 9;
const FOOT_H = 6;

const PIPE = { z: 30, r: 10.6 };
const ZC = PIPE.z;
const MX = 6;
const BODY = { x0: MX - 52, x1: MX + 52 };
const BORE = M.METER.boreMm / 2;
const HALF_PATH = M.METER.pathMm / 2;
const TXA = MX - HALF_PATH;
const TXB = MX + HALF_PATH;
const FACE_Z = ZC + BORE;
const BOSS = { r: 8, z0: 47, z1: 56 };
const HEAD = { x: MX - 48, y: -40, w: 96, d: 80, r: 10, z0: 56, z1: 86, wall: 2.4 };
const PORT = { x: MX + 26, rIn: 10.5, rOut: 16, proud: 0.5 };
const PCB = { z0: 76, z1: 77.6 };
const LCD = { x: MX - 44, y: -33, w: 50, d: 24, r: 3 };
const BATTERY = { x0: MX - 25.25, x1: MX + 25.25, z0: 59, z1: 73.5 };
const VALVE_X = -70;
const SUPPLY_X = -97;
const DRAIN_X = 94;
const BEAM_HALF = 4;

const BODY_PROFILE = [[BODY.x0, 12.5], [MX - 47, 12.5], [MX - 45, 16, 1], [MX - 30, 18, 1], [MX, 19, 1], [MX + 30, 18, 1], [MX + 45, 16, 1], [MX + 47, 12.5], [BODY.x1, 12.5]];
const CURVE = G.profileCurve(BODY_PROFILE);
const rAt = (x) => CURVE.radius(Math.min(BODY.x1, Math.max(BODY.x0, x)));

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [HEAD.x, HEAD.y, HEAD.z1 + 10], [HEAD.x + HEAD.w, 0, HEAD.z1 + 10], [HEAD.x, 0, HEAD.z1 + 18]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 66 },
);
const SCALE = G.scaleOf(P);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const C = (name, svg) => `<g class="c-${name}">${svg}</g>`;
const xAxis = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const PIPE_F = xAxis(0, 0, ZC);
const FACE = k.sideMatrix([0, 0], 0, P, "left");
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

// Faces in the cut plane y = 0, drawn in (x, -z).
const R = (x0, z0, x1, z1) => `M${f(x0)} ${f(-z0)}H${f(x1)}V${f(-z1)}H${f(x0)}Z`;
const RR = (x0, z0, x1, z1, r) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 4).map(([u, v]) => [u, -v]), true);
const poly = (points, closed = true) => points.map(([x, z], i) => `${i ? "L" : "M"}${f(x)} ${f(-z)}`).join("") + (closed ? "Z" : "");
const dome = (cx, zBase, zTip, w) => {
  const hw = w / 2;
  const shoulder = zTip - hw;
  return `M${f(cx - hw)} ${f(-zBase)}V${f(-shoulder)}A${f(hw)} ${f(hw)} 0 0 1 ${f(cx + hw)} ${f(-shoulder)}V${f(-zBase)}Z`;
};
const inFace = (svg, extra = "") => `<g transform="${FACE}" class="sx"${extra}>${svg}</g>`;

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(C("wood", S(k.cylinder(x, y, 8, -PLATE_H - FOOT_H, FOOT_H, P, 28), { tone: "hi" })));
  }
  const grain = [-27, -4, 19].map((y) => k.lineOnTop([PLATE.x, y], [PLATE.x + PLATE.w, y], 0, P)).join("");
  out.push(C("wood", S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "hi", inner: "" })));
  out.push(L(grain, { tone: "faint" }));
  const screws = k.corners(PLATE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.6, tone: "mid" }));
  return out.join("");
}

function floorFlange(x) {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 16, y: -16, w: 32, d: 32, r: 16 }, 0, 3, P)}"/>`];
  out.push(C("brass", S(k.cylinder(x, 0, 16, 0, 3, P, 48, 0.6), { tone: "hi" })));
  const bolts = [0, 1, 2, 3].map((i) => [x + 11.5 * Math.cos(Math.PI / 4 + (i * Math.PI) / 2), 11.5 * Math.sin(Math.PI / 4 + (i * Math.PI) / 2)]);
  out.push(L(bolts.map(([bx, by]) => k.ring(bx, by, 1.8, 3, P, 14)).join(""), { tone: "lo" }));
  out.push(D(bolts.map(([bx, by]) => at([bx, by, 3])), { size: 0.5, tone: "hi" }));
  out.push(C("brass", S(k.cylinder(x, 0, 12.4, 3, 4, P, 40), { tone: "hi" })));
  return out.join("");
}
const riser = (x) => C("chrome", S(k.cylinder(x, 0, PIPE.r, 7, ZC - 7, P, 40), { tone: "hi", inner: L(k.sideArc(x, 0, PIPE.r, 12, P, 30), { tone: "faint" }) }));
const elbow = (x) => C("brass", S(G.sphereOf([x, 0, ZC], 13.4, P), { tone: "hi" }));
const pipeRun = (x0, x1) => C("chrome", S(G.disc(x0, x1, PIPE.r, PIPE_F, P), { tone: "hi" }));
const hexNut = (x0, x1, Rr) => {
  const hex = Array.from({ length: 6 }, (_, i) => [Rr * Math.cos(Math.PI / 6 + (i * Math.PI) / 3), Rr * Math.sin(Math.PI / 6 + (i * Math.PI) / 3)]);
  return C("brass", S(G.prismOf(PIPE_F, hex, x0, x1, P), { tone: "hi" }));
};

function stand(x) {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 9, y: -9, w: 18, d: 18, r: 4 }, 0, 4, P)}"/>`];
  out.push(C("chrome", S(k.slabOf({ x: x - 9, y: -9, w: 18, d: 18, r: 3 }, 0, 2.4, P, 4, 0.5), { tone: "hi" })));
  out.push(C("chrome", S(k.cylinder(x, 0, 3.6, 2.4, 9.6, P, 20), { tone: "hi" })));
  out.push(C("chrome", S(k.slabOf({ x: x - 5, y: -8, w: 10, d: 16, r: 1.5 }, 12, ZC - PIPE.r - 12, P, 3, 0.4), { tone: "hi" })));
  out.push(D([[-6.5, -6.5], [6.5, 6.5], [6.5, -6.5], [-6.5, 6.5]].map(([dx, dy]) => at([x + dx, dy, 2.4])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

const VALVE_TOP = ZC + Math.sqrt(17.5 * 17.5 - 5 * 5);
const LEVER_Z = VALVE_TOP + 8.5;
function valve(x) {
  const out = [hexNut(x - 12, x - 7, 14)];
  out.push(C("brass", S(G.solidOf([[x - 7, 13], [x - 5, 16, 1], [x, 17.5, 1], [x + 5, 16, 1], [x + 7, 13]], PIPE_F, P), { tone: "hi", inner: L(G.arcOf(PIPE_F, x, 17.5, P), { tone: "faint" }) })));
  out.push(hexNut(x + 7, x + 12, 14));
  out.push(C("brass", S(k.cylinder(x, 0, 5, VALVE_TOP - 0.5, 6, P, 24), { tone: "hi" })));
  out.push(C("red", S(k.cylinder(x, 0, 4.4, VALVE_TOP + 5.5, 3, P, 24, 0.4), { tone: "hi" })));
  return out.join("");
}

function meterBodyBack() {
  const gen = [];
  for (let x = BODY.x0; x <= BODY.x1 + 1e-6; x += 1) gen.push(at([x, 0, ZC + rAt(x)]));
  const a = at([BODY.x0 - 30, 0, ZC + 12.5]);
  const b = at([BODY.x1 + 30, 0, ZC + 12.5]);
  const clip = k.pathOf([[a[0], a[1] - 400], a, ...gen, b, [b[0], b[1] - 400]], true);
  const body = G.solidOf(BODY_PROFILE, PIPE_F, P);
  const seams = L(G.arcOf(PIPE_F, MX - 30, 18, P, { slope: 0.06 }) + G.arcOf(PIPE_F, MX + 30, 18, P, { slope: -0.06 }), { tone: "faint" });
  return `<clipPath id="im-back"><path d="${clip}"/></clipPath><g clip-path="url(#im-back)">${C("brass", S(body, { tone: "hi", inner: seams }))}</g>`;
}

const bossBack = (x) => C("brass", S(k.extrude(halfDisc(x, 0, BOSS.r, 32), BOSS.z0, BOSS.z1 - BOSS.z0, P), { tone: "hi" }));

function headBack() {
  const ring = clipRing(k.ringOf(HEAD, 10), { y1: 0 });
  const out = [];
  out.push(C("meter", S(k.extrude(ring, HEAD.z0, HEAD.z1 - HEAD.z0, P, { bevel: 1 }), { tone: "hi", inner: L(k.ringSeam(ring, HEAD.z0 + 3.4, P), { tone: "faint" }) })));
  return out.join("");
}

const SLOT = 5.1;
const DIGITS = M.shownTotal(M.METER.startTotalM3);
const NEXT_DIGITS = M.shownTotal(M.END_TOTAL_M3);
function headTop() {
  const z = HEAD.z1;
  const out = [];
  out.push(`<path class="im-lcd" d="${k.planOutline(LCD, z, P, 4)}"/>`);
  out.push(L(k.planOutline(LCD, z, P, 4), { tone: "hi" }) + L(k.planOutline(k.insetPlan(LCD, 1.6), z, P, 4), { tone: "faint" }));
  const slots = [...DIGITS].map((ch, i) => {
    const x = 4.4 + i * SLOT;
    if (i === DIGITS.length - 1) {
      return `<g clip-path="url(#im-roll)"><g data-part="roll"><text class="im-lcd-digits" x="${f(x)}" y="0" font-size="8.6" text-anchor="middle">${ch}</text><text class="im-lcd-digits" x="${f(x)}" y="9" font-size="8.6" text-anchor="middle">${NEXT_DIGITS.at(-1)}</text></g></g>`;
    }
    return `<text class="im-lcd-digits" x="${f(x)}" y="0" font-size="8.6" text-anchor="middle">${ch}</text>`;
  }).join("");
  const lastX = 4.4 + (DIGITS.length - 1) * SLOT;
  const roll = `<clipPath id="im-roll" clipPathUnits="userSpaceOnUse"><rect x="${f(lastX - 2.7)}" y="-7.6" width="5.4" height="9.4"/></clipPath>`;
  const unit = `<text class="im-lcd-unit" x="${f(lastX + 4)}" y="-0.2" font-size="3.6">m³</text>`;
  const arrow = `<path class="im-lcd-seg" data-part="flow-seg" d="M2.2 -11.6h5.4v-1.1l2.4 1.9-2.4 1.9v-1.1h-5.4z"/>`;
  const bars = `<path class="im-lcd-seg im-lcd-on" d="M40.6 -12.4h5v2.6h-5zM45.6 -11.6h.7v1h-.7z"/>`;
  out.push(`<g transform="${k.topMatrix([LCD.x + 1.6, LCD.y + 16.2], z, P, "x")}">${roll}${slots}${unit}${arrow}${bars}</g>`);
  const label = { x: MX + 12, y: -36, w: 28, d: 11, r: 1.4 };
  out.push(C("cap", S(k.slabOf(label, z, 0.6, P, 3), { tone: "hi", crease: "none" })));
  out.push(L([16, 11, 19].map((w, i) => k.lineOnTop([label.x + 3, label.y + 2.8 + i * 2.7], [label.x + 3 + w, label.y + 2.8 + i * 2.7], z + 0.6, P)).join(""), { tone: "lo", free: true }));
  const screws = [[HEAD.x + 6.5, HEAD.y + 6.5], [HEAD.x + HEAD.w - 6.5, HEAD.y + 6.5], [HEAD.x + 6.5, -5]];
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, z, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, z])), { size: 0.55, tone: "hi" }));
  const inner = halfDisc(PORT.x, 0, PORT.rIn);
  out.push(`<path class="im-window" d="${k.pathOf(inner.map(([x, y]) => at([x, y, z])), true)}"/>`);
  out.push(L(k.pathOf(inner.map(([x, y]) => at([x, y, z]))), { tone: "lo" }));
  out.push(C("chrome", S(k.extrude([...halfDisc(PORT.x, 0, PORT.rOut), ...halfDisc(PORT.x, 0, PORT.rIn).reverse()], z, PORT.proud, P, { convex: false }), { tone: "hi", crease: "none" })));
  return out.join("");
}

// The cut face of the body: brass wall and the two transducer bosses, the bore full of water, transducers and mirrors.
function bodySection() {
  const top = [];
  for (let x = BODY.x0; x <= BODY.x1 + 1e-6; x += 1) {
    for (const t of [TXA, TXB]) {
      if (x > t - BOSS.r - 1 && x <= t - BOSS.r) top.push([t - BOSS.r, ZC + rAt(t - BOSS.r)], [t - BOSS.r, BOSS.z1], [t + BOSS.r, BOSS.z1], [t + BOSS.r, ZC + rAt(t + BOSS.r)]);
    }
    if (Math.abs(x - TXA) < BOSS.r || Math.abs(x - TXB) < BOSS.r) continue;
    top.push([x, ZC + rAt(x)]);
  }
  const bottom = [];
  for (let x = BODY.x1; x >= BODY.x0 - 1e-6; x -= 1) bottom.push([x, ZC - rAt(x)]);
  const parts = [`<path class="sx-brass" d="${poly([...top, ...bottom])}"/>`];
  parts.push(`<path class="sx-bore" d="${R(BODY.x0, ZC - BORE, BODY.x1, ZC + BORE)}"/>`);
  parts.push(`<path class="sx-shine" d="${R(BODY.x0, ZC + BORE - 1.6, BODY.x1, ZC + BORE - 0.9)}"/>`);
  for (const t of [TXA, TXB]) parts.push(`<path class="sx-pocket" d="${R(t - 5.8, FACE_Z, t + 5.8, BOSS.z1)}"/>`);
  const dashes = [-5.2, -2.2, 2.2, 5.2].map((dz, i) => `<path class="sx-flow" data-flow="${i}" d="M${f(BODY.x0)} ${f(-(ZC + dz))}H${f(BODY.x1)}"/>`).join("");
  parts.push(`<g data-part="water" style="opacity:0">${dashes}</g>`);
  parts.push(`<path class="sx-path" d="${poly([[TXA, FACE_Z], [TXA, ZC], [TXB, ZC], [TXB, FACE_Z]], false)}"/>`);
  parts.push(`<g data-part="sound"><path class="sx-trail" data-trail/><path class="sx-glow" data-glow/><path class="sx-crest" data-crests/></g>`);
  for (const [t, name] of [[TXA, "a"], [TXB, "b"]]) {
    parts.push(`<path class="sx-steel" d="${R(t - 5, FACE_Z, t + 5, FACE_Z + 10)}"/>`);
    parts.push(`<path class="sx-backing" d="${R(t - 4.2, FACE_Z + 2.6, t + 4.2, FACE_Z + 10)}"/>`);
    parts.push(`<path class="sx-piezo" data-part="xdcr-${name}" d="${R(t - 4.2, FACE_Z + 0.6, t + 4.2, FACE_Z + 2.6)}"/>`);
    parts.push(`<path class="sx-electrode" d="M${f(t - 4.2)} ${f(-(FACE_Z + 0.6))}H${f(t + 4.2)}M${f(t - 4.2)} ${f(-(FACE_Z + 2.6))}H${f(t + 4.2)}"/>`);
    parts.push(`<circle class="sx-oring" cx="${f(t - 5.4)}" cy="${f(-(FACE_Z + 6.4))}" r="0.62"/><circle class="sx-oring" cx="${f(t + 5.4)}" cy="${f(-(FACE_Z + 6.4))}" r="0.62"/>`);
    parts.push(`<path class="sx-wire" data-wire="${name}" d="M${f(t - 1.2)} ${f(-(FACE_Z + 2.6))}V${f(-PCB.z0)}M${f(t + 1.2)} ${f(-(FACE_Z + 2.6))}V${f(-PCB.z0)}"/>`);
  }
  const plate = (t, d, n) => {
    const a = [t - 5 * d[0], ZC - 5 * d[1]];
    const b = [t + 5 * d[0], ZC + 5 * d[1]];
    return poly([a, b, [b[0] - 1.2 * n[0], b[1] - 1.2 * n[1]], [a[0] - 1.2 * n[0], a[1] - 1.2 * n[1]]]);
  };
  const s2 = Math.SQRT1_2;
  parts.push(`<path class="sx-foot" d="${RR(TXA - 4, ZC - BORE, TXA + 1.6, ZC - BORE + 1, 0.4)}"/><path class="sx-strut" d="${R(TXA - 1.7, ZC - BORE + 1, TXA - 0.1, ZC - 1.4)}"/>`);
  parts.push(`<path class="sx-foot" d="${RR(TXB - 1.6, ZC - BORE, TXB + 4, ZC - BORE + 1, 0.4)}"/><path class="sx-strut" d="${R(TXB + 0.1, ZC - BORE + 1, TXB + 1.7, ZC - 1.4)}"/>`);
  parts.push(`<path class="sx-mirror" d="${plate(TXA, [s2, -s2], [s2, s2])}"/>`);
  parts.push(`<path class="sx-mirror" d="${plate(TXB, [s2, s2], [-s2, s2])}"/>`);
  return inFace(parts.join(""));
}

function headSection() {
  const x0 = HEAD.x, x1 = HEAD.x + HEAD.w, w = HEAD.wall;
  const parts = [
    `<path class="sx-meter" d="${R(x0, HEAD.z0, x1, HEAD.z1)}"/>`,
    `<path class="sx-cavity" d="${R(x0 + w, HEAD.z0 + w, x1 - w, HEAD.z1 - w)}"/>`,
    ...[TXA, TXB].map((t) => `<path class="sx-cavity" d="${R(t - 2.4, HEAD.z0 - 0.4, t + 2.4, HEAD.z0 + w + 0.4)}"/>`),
    `<path class="sx-window" d="${R(PORT.x - PORT.rIn, HEAD.z1 - w, PORT.x + PORT.rIn, HEAD.z1)}"/>`,
    `<path class="sx-steel" d="${R(PORT.x - PORT.rOut, HEAD.z1 - 1.6, PORT.x - PORT.rIn, HEAD.z1 + PORT.proud)}"/>`,
    `<path class="sx-steel" d="${R(PORT.x + PORT.rIn, HEAD.z1 - 1.6, PORT.x + PORT.rOut, HEAD.z1 + PORT.proud)}"/>`,
    `<path class="sx-lcdglass" d="${R(LCD.x, PCB.z1 + 2.8, LCD.x + LCD.w, HEAD.z1 - w)}"/>`,
    `<path class="sx-zebra" d="${R(LCD.x + 1, PCB.z1, LCD.x + 3.6, PCB.z1 + 2.8)}"/>`,
    `<path class="sx-zebra" d="${R(LCD.x + LCD.w - 3.6, PCB.z1, LCD.x + LCD.w - 1, PCB.z1 + 2.8)}"/>`,
    `<path class="sx-pcb" d="${R(x0 + w, PCB.z0, x1 - w, PCB.z1)}"/>`,
    `<path class="sx-led" d="${dome(PORT.x + 4, PCB.z1, PCB.z1 + 3.6, 3)}"/>`,
    `<path class="sx-sensor" d="${dome(PORT.x - 4, PCB.z1, PCB.z1 + 3.6, 3)}"/>`,
    `<path class="sx-foam" d="${R(MX - 16, HEAD.z0 + w, MX + 16, BATTERY.z0)}"/>`,
    `<path class="sx-clip" d="${R(BATTERY.x0 - 1.8, BATTERY.z0 + 3, BATTERY.x0, PCB.z0)}"/>`,
    `<path class="sx-clip" d="${R(BATTERY.x1 + 1.3, BATTERY.z0 + 3, BATTERY.x1 + 3.1, PCB.z0)}"/>`,
    `<path class="sx-steel" d="${RR(BATTERY.x1 - 1, BATTERY.z0 + 5.2, BATTERY.x1 + 1.3, BATTERY.z0 + 9.3, 0.6)}"/>`,
    `<path class="sx-can" d="${RR(BATTERY.x0, BATTERY.z0, BATTERY.x1, BATTERY.z1, 2.2)}"/>`,
    `<path class="sx-label" d="${R(BATTERY.x0 + 3.2, BATTERY.z0, BATTERY.x1 - 2.6, BATTERY.z1)}"/>`,
    `<path class="sx-labelshade" d="${R(BATTERY.x0 + 3.2, BATTERY.z0, BATTERY.x1 - 2.6, BATTERY.z0 + 3.4)}"/>`,
    `<path class="sx-labelshine" d="${R(BATTERY.x0 + 3.2, BATTERY.z1 - 4.2, BATTERY.x1 - 2.6, BATTERY.z1 - 2.6)}"/>`,
    `<path class="sx-labelband" d="${R(BATTERY.x1 - 13, BATTERY.z0, BATTERY.x1 - 9.6, BATTERY.z1)}"/>`,
    `<path class="sx-chip" data-part="tdc" d="${R(MX - 21, PCB.z0 - 1.6, MX - 9, PCB.z0)}"/>`,
    `<path class="sx-chip" data-part="mcu" d="${R(MX - 5, PCB.z0 - 1.8, MX + 9, PCB.z0)}"/>`,
    `<path class="sx-xtal" d="${RR(MX + 12, PCB.z0 - 1.1, MX + 15.4, PCB.z0, 0.4)}"/>`,
    `<path class="sx-can" d="${R(MX - 43.2, PCB.z0 - 2.8, MX - 33.6, PCB.z0)}"/>`,
    `<path class="sx-pins" d="M${f(MX - 41.6)} ${f(-(PCB.z0 - 1.4))}h6.4"/>`,
    `<path class="sx-pins" d="${[MX - 20, MX - 17, MX - 14, MX - 11, MX - 4, MX - 1, MX + 2, MX + 5, MX + 8].map((x) => `M${f(x)} ${f(-(PCB.z0 - 0.15))}h1`).join("")}"/>`,
  ];
  return inFace(parts.join(""));
}

const SOUNDS = {
  tap: at([VALVE_X + 4, 26, LEVER_Z + 18]),
  pingA: at([TXA - 20, 18, BOSS.z1 - 2]),
  pingB: at([TXB + 26, 10, BOSS.z1 - 6]),
  tick: at([MX - 30, -6, HEAD.z1 + 26]),
  bleep: at([MX - 2, -6, HEAD.z1 + 26]),
  glug: at([DRAIN_X - 8, 34, ZC - 12]),
  click: at([LCD.x + 30, LCD.y - 8, HEAD.z1 + 20]),
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A smart water meter on a pipe, cut open along the pipe. Inside the brass body, two ultrasonic transducers sit above two 45-degree mirrors, so a click of sound runs down, along the water and up to the other side. Above them, the blue head holds the circuit board, the battery, the display and the optical port. A tap upstream lets the water in.",
  body: [
    bench(),
    floorFlange(SUPPLY_X),
    riser(SUPPLY_X),
    elbow(SUPPLY_X),
    pipeRun(SUPPLY_X, VALVE_X - 12),
    valve(VALVE_X),
    hexNut(BODY.x0 - 12, BODY.x0, 17.2),
    `<g class="c-red" data-part="lever"></g>`,
    meterBodyBack(),
    bossBack(TXA),
    bossBack(TXB),
    headBack(),
    headTop(),
    bodySection(),
    headSection(),
    hexNut(BODY.x1, BODY.x1 + 12, 17.2),
    pipeRun(BODY.x1 + 12, DRAIN_X),
    floorFlange(DRAIN_X),
    riser(DRAIN_X),
    elbow(DRAIN_X),
  ],
});

const TAIL_S = 2.1e-6;
const SLOW = 1e5;
const fmt = (n, d) => n.toFixed(d);
const T = M.TIMES;
const STEPS = [
  { label: "Open the tap", hint: `Turn the tap. Water rushes into the meter at ${M.METER.q3M3h} cubic metres an hour, about ${fmt(M.V, 1)} metres every second.`, dur: 3.26, real: null, sound: { word: "squeak", at: SOUNDS.tap, from: 0.15, to: 0.85 } },
  { label: "Ping downstream", hint: "The left speaker clicks. The sound bounces off a mirror, rides with the water to the next mirror, and up to the right speaker.", dur: (T.down + TAIL_S) * SLOW, real: T.down + TAIL_S, sound: { word: "ping!", at: SOUNDS.pingA, from: 0.0, to: 0.4 } },
  { label: "Ping upstream", hint: "Now the right speaker clicks back. This time the sound swims against the water, so it arrives a tiny bit later.", dur: (T.up + TAIL_S) * SLOW, real: T.up + TAIL_S, sound: { word: "ping!", at: SOUNDS.pingB, from: 0.0, to: 0.4 } },
  { label: "Measure the difference", hint: `A stopwatch chip compares the two trips. Going with the water won by ${fmt(M.ns(T.dt), 1)} billionths of a second.`, dur: 4.2, real: null, sound: { word: "tick tick", at: SOUNDS.tick, from: 0.1, to: 0.7 } },
  { label: "Work out the speed", hint: `A bigger head start means faster water. ${fmt(M.ns(T.dt), 1)} ns works out to ${fmt(M.SPEED, 2)} metres every second.`, dur: 3.7, real: null, sound: { word: "bleep", at: SOUNDS.bleep, from: 0.25, to: 0.8 } },
  { label: "Add it to the total", hint: `Speed times the size of the hole: ${fmt(M.ADDED_M3 * 1000, 3)} litres went by in this one-second check. Add it to the total.`, dur: 3.8, real: null, sound: { word: "glug glug", at: SOUNDS.glug, from: 0.1, to: 0.85 } },
  { label: "Show it on the screen", hint: `The screen ticks from ${DIGITS} to ${NEXT_DIGITS} m³: the same number the probe in Fig 1 reads.`, dur: 3.8, real: null, sound: { word: "click", at: SOUNDS.click, from: 0.3, to: 0.8 } },
];

const live = `
${MODEL_SRC}
const P = ${JSON.stringify(P)};
const STEPS = ${JSON.stringify(STEPS)};
const TXA = ${TXA}, TXB = ${TXB}, MX = ${MX}, ZC = ${ZC}, FACE_Z = ${FACE_Z}, BEAM_HALF = ${BEAM_HALF};
const VALVE_X = ${VALVE_X}, LEVER_Z = ${LEVER_Z};
const DIGITS = ${JSON.stringify(DIGITS)}, NEXT_DIGITS = ${JSON.stringify(NEXT_DIGITS)};
const DEPICT_MM_S = 14;
const svg = document.querySelector(".bk-card svg");
const q = (sel) => svg.querySelector(sel);
const lever = q('[data-part="lever"]');
const water = q('[data-part="water"]');
const flows = [...svg.querySelectorAll(".sx-flow")];
const trail = q("[data-trail]"), crestsEl = q("[data-crests]"), glowEl = q("[data-glow]");
const xdcr = { a: q('[data-part="xdcr-a"]'), b: q('[data-part="xdcr-b"]') };
const wires = { a: q('[data-wire="a"]'), b: q('[data-wire="b"]') };
const tdc = q('[data-part="tdc"]'), mcu = q('[data-part="mcu"]');
const roll = q('[data-part="roll"]');
const flowSeg = q('[data-part="flow-seg"]');
const clockEl = document.querySelector("[data-clock]");
const clockWho = document.querySelector("[data-clock-who]");
const lanesEl = document.querySelector("[data-lanes]");
const zoomEl = document.querySelector("[data-zoom]");
const sumEls = [...document.querySelectorAll("[data-sum]")];

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.min(1, Math.max(0, t));
const ramp = (p, a, b) => smooth(clamp((p - a) / (b - a)));
const fx = (n) => +n.toFixed(2);

let lastAngle = null;
function setLever(angle) {
  const key = angle.toFixed(1);
  if (key === lastAngle) return;
  lastAngle = key;
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const ring = roundedPlan({ x: -3, y: -3.5, w: 29, d: 7, r: 3 }, 4).map(([u, v]) => [VALVE_X + u * c - v * s, u * s + v * c]);
  const paths = extrude(ring, LEVER_Z, 2.4, P, { bevel: 0.5 });
  lever.innerHTML = solidSvg(paths, { tone: "hi" }) + dotsSvg([iso([VALVE_X, 0, LEVER_Z + 2.4], P)], { size: 0.7, tone: "hi" });
}

// The water streaks are drawn far slower than the real water; during the pings they move at the real speed slowed 100000 times, so they stand still.
function waterTravel(i, p) {
  let mm = 0;
  for (let j = 0; j <= i; j++) {
    const u = j < i ? 1 : p;
    const step = STEPS[j];
    if (j === 0) mm += DEPICT_MM_S * step.dur * (u * u * u - (u * u * u * u) / 2);
    else if (step.real) mm += V * 1000 * step.real * u;
    else mm += DEPICT_MM_S * step.dur * u;
  }
  return mm;
}

// One crest of the burst at distance s (m) along the U, as seen in the cut face: every ray of the beam has gone s.
function crestPoints(s, dir) {
  const mm = s * 1000, leg = LEG_M * 1000, run = PATH_M * 1000;
  const offsets = [-BEAM_HALF, BEAM_HALF, mm - leg, leg + run - mm].filter((u) => u >= -BEAM_HALF && u <= BEAM_HALF).sort((a, b) => a - b);
  const pts = offsets.map((u) => {
    let x, z;
    if (mm < leg + u) { x = TXA + u; z = FACE_Z - mm; }
    else if (mm < leg + run - u) { x = TXA + mm - leg; z = ZC - u; }
    else { x = TXB - u; z = ZC + mm - leg - run; }
    return [dir === "down" ? x : 2 * MX - x, z];
  });
  return "M" + pts.map(([x, z]) => fx(x) + " " + fx(-z)).join("L");
}
function trailPath(s, dir) {
  const mm = Math.min(s * 1000, PATH_LEN_M * 1000), leg = LEG_M * 1000, run = PATH_M * 1000;
  const pts = [[TXA, FACE_Z]];
  if (mm <= leg) pts.push([TXA, FACE_Z - mm]);
  else {
    pts.push([TXA, ZC]);
    if (mm <= leg + run) pts.push([TXA + mm - leg, ZC]);
    else { pts.push([TXB, ZC]); pts.push([TXB, ZC + mm - leg - run]); }
  }
  return "M" + pts.map(([x, z]) => fx(dir === "down" ? x : 2 * MX - x) + " " + fx(-z)).join("L");
}

const PINGS = { 1: "down", 2: "up" };
const arrivalOf = (dir) => (dir === "down" ? TIMES.down : TIMES.up);
const burstS = METER.burstCycles / METER.freqHz;

function lcd(i, p) {
  const u = i > 6 || i === 6 ? (i === 6 ? smooth(clamp((p - 0.2) / 0.45)) : 1) : 0;
  roll.setAttribute("transform", "translate(0 " + fx(-9 * u) + ")");
}

const LANE = { x0: 112, x1: 344, max: 54e-6 };
const laneX = (t) => LANE.x0 + (Math.min(t, LANE.max) / LANE.max) * (LANE.x1 - LANE.x0);
function lanesHtml(i, p) {
  const rows = [["down", "With the water", 1], ["up", "Against it", 2]];
  let out = "";
  rows.forEach(([dir, name, step], r) => {
    const y = 18 + r * 30;
    const done = i > step;
    const running = i === step;
    const t = done ? arrivalOf(dir) : running ? Math.min(p * STEPS[step].real, arrivalOf(dir)) : 0;
    const cls = dir === "down" ? "tw-ds" : "tw-us";
    out += '<text class="tw-name" x="0" y="' + (y + 4) + '">' + name + "</text>";
    out += '<line class="tw-track" x1="' + LANE.x0 + '" y1="' + y + '" x2="' + LANE.x1 + '" y2="' + y + '"/>';
    if (t > 0) out += '<line class="tw-bar ' + cls + '" x1="' + LANE.x0 + '" y1="' + y + '" x2="' + fx(laneX(t)) + '" y2="' + y + '"/>';
    if (done || (running && p * STEPS[step].real >= arrivalOf(dir))) out += '<text class="tw-val" x="' + LANE.x1 + '" y="' + (y - 6) + '" text-anchor="end">' + us(arrivalOf(dir)).toFixed(4) + " µs</text>";
  });
  for (let m = 0; m <= 50; m += 10) out += '<line class="tw-tick" x1="' + fx(laneX(m * 1e-6)) + '" y1="66" x2="' + fx(laneX(m * 1e-6)) + '" y2="70"/><text class="tw-axis" x="' + fx(laneX(m * 1e-6)) + '" y="80" text-anchor="middle">' + m + "</text>";
  out += '<text class="tw-axis" x="' + LANE.x1 + '" y="80" text-anchor="end">µs</text>';
  return '<svg viewBox="0 0 350 84" class="tw-svg" aria-hidden="true">' + out + "</svg>";
}

const ZOOM = { t0: TIMES.down - 0.3e-6, t1: TIMES.down + TAIL_S_JS(), x0: 8, x1: 252, mid: 50, amp: 22 };
function TAIL_S_JS() { return ${TAIL_S}; }
const zx = (t) => ZOOM.x0 + ((t - ZOOM.t0) / (ZOOM.t1 - ZOOM.t0)) * (ZOOM.x1 - ZOOM.x0);
function wavePath(arrival, until) {
  let d = "";
  const n = 260;
  for (let j = 0; j <= n; j++) {
    const t = ZOOM.t0 + (j / n) * (ZOOM.t1 - ZOOM.t0);
    if (t > until) break;
    d += (j ? "L" : "M") + fx(zx(t)) + " " + fx(ZOOM.mid - ZOOM.amp * received(t, arrival));
  }
  return d;
}
function zoomHtml(i, p) {
  let out = "";
  for (let t = Math.ceil(ZOOM.t0 * 2e6) / 2e6; t <= ZOOM.t1; t += 0.5e-6) {
    out += '<line class="tw-grid" x1="' + fx(zx(t)) + '" y1="18" x2="' + fx(zx(t)) + '" y2="82"/>';
    out += '<text class="tw-axis" x="' + fx(zx(t)) + '" y="94" text-anchor="middle">' + (t * 1e6).toFixed(1) + "</text>";
  }
  out += '<line class="tw-track" x1="' + ZOOM.x0 + '" y1="' + ZOOM.mid + '" x2="' + ZOOM.x1 + '" y2="' + ZOOM.mid + '"/>';
  const reach = (step, dir) => (i > step ? ZOOM.t1 : i === step ? p * STEPS[step].real : -1);
  const dDown = reach(1, "down"), dUp = reach(2, "up");
  if (dDown > ZOOM.t0) out += '<path class="tw-wave tw-ds" d="' + wavePath(TIMES.down, dDown) + '"/>';
  if (dUp > ZOOM.t0) out += '<path class="tw-wave tw-us" d="' + wavePath(TIMES.up, dUp) + '"/>';
  if (dDown >= TIMES.down) out += '<line class="tw-mark tw-ds" x1="' + fx(zx(TIMES.down)) + '" y1="16" x2="' + fx(zx(TIMES.down)) + '" y2="84"/>';
  if (dUp >= TIMES.up) out += '<line class="tw-mark tw-us" x1="' + fx(zx(TIMES.up)) + '" y1="16" x2="' + fx(zx(TIMES.up)) + '" y2="84"/>';
  const show = i > 3 ? 1 : i === 3 ? smooth(clamp(p / 0.4)) : 0;
  if (show > 0) {
    const a = zx(TIMES.down), b = a + (zx(TIMES.up) - a) * show;
    out += '<path class="tw-bracket" d="M' + fx(a) + ' 12V8H' + fx(b) + 'V12"/>';
    if (show > 0.95) out += '<text class="tw-dt" x="' + fx(b + 5) + '" y="12">' + ns(TIMES.dt).toFixed(1) + " ns</text>";
  }
  return '<svg viewBox="0 0 260 98" class="tw-zoom-svg" aria-hidden="true">' + out + "</svg>";
}

let lastLanes = "", lastZoom = "";
function panel(i, p) {
  const dir = PINGS[i];
  let clock = "0.0000 µs", who = "waiting for a click";
  if (dir) {
    const r = p * STEPS[i].real;
    clock = us(Math.min(r, arrivalOf(dir))).toFixed(4) + " µs";
    who = r >= arrivalOf(dir) ? "heard it!" : dir === "down" ? "left speaker → right" : "right speaker → left";
  } else if (i >= 3) {
    clock = (ns(TIMES.dt)).toFixed(1) + " ns";
    who = "head start, with the water";
  }
  if (clockEl.textContent !== clock) clockEl.textContent = clock;
  if (clockWho.textContent !== who) clockWho.textContent = who;
  const lanes = lanesHtml(i, p);
  if (lanes !== lastLanes) { lanesEl.innerHTML = lanes; lastLanes = lanes; }
  const zoom = zoomHtml(i, p);
  if (zoom !== lastZoom) { zoomEl.innerHTML = zoom; lastZoom = zoom; }
  sumEls.forEach((el) => {
    const from = +el.dataset.sum;
    el.toggleAttribute("data-on", i > from || (i === from && p > 0.2));
  });
}

function pose(i, p) {
  const open = i < 0 ? 0 : i === 0 ? smooth(p) : 1;
  setLever(90 * (1 - open));
  water.style.opacity = open.toFixed(2);
  const travel = i < 0 ? 0 : waterTravel(i, p);
  flows.forEach((el, j) => { el.style.strokeDashoffset = fx(-travel - j * 3.7); });
  flowSeg.toggleAttribute("data-on", open > 0.5);

  const dir = PINGS[i];
  let lit = { a: false, b: false };
  if (dir && p < 1) {
    const r = p * STEPS[i].real;
    const crests = crestsAt(dir, r);
    const crestD = crests.map((c) => crestPoints(c.s, dir)).join("");
    crestsEl.setAttribute("d", crestD);
    glowEl.setAttribute("d", crestD);
    crestsEl.setAttribute("class", "sx-crest " + (dir === "down" ? "sx-ds" : "sx-us"));
    const lead = pathAt(dir, r);
    trail.setAttribute("d", trailPath(lead, dir));
    trail.setAttribute("class", "sx-trail " + (dir === "down" ? "sx-ds" : "sx-us"));
    const arrive = arrivalOf(dir);
    trail.style.opacity = (r < arrive ? 1 : Math.max(0, 1 - (r - arrive) / TAIL_S_JS())).toFixed(2);
    const sender = dir === "down" ? "a" : "b", hearer = dir === "down" ? "b" : "a";
    lit[sender] = r < burstS;
    lit[hearer] = r >= arrive;
  } else {
    crestsEl.setAttribute("d", "");
    glowEl.setAttribute("d", "");
    trail.setAttribute("d", "");
  }
  for (const n of ["a", "b"]) {
    xdcr[n].toggleAttribute("data-lit", lit[n]);
    wires[n].toggleAttribute("data-lit", lit[n]);
  }
  tdc.toggleAttribute("data-lit", (i >= 1 && i <= 2 && p < 1) || i === 3);
  mcu.toggleAttribute("data-lit", i === 4 || i === 5);
  lcd(i, p);
  panel(i, p);
}

function chips(i, p) {
  const open = i < 0 ? 0 : i === 0 ? smooth(p) : 1;
  const ping = (step, dir) => {
    if (i > step) return us(arrivalOf(dir)).toFixed(4) + " µs";
    if (i === step) return us(Math.min(p * STEPS[step].real, arrivalOf(dir))).toFixed(4) + " µs";
    return "—";
  };
  return [
    { k: "Tap", v: open === 0 ? "closed" : open < 1 ? "opening…" : "open, " + METER.q3M3h.toFixed(2) + " m³/h", hot: i === 0 },
    { k: "Sound in water", v: C.toFixed(0) + " m/s at " + WATER.tempC + " °C" },
    { k: "With the water", v: ping(1, "down"), hot: i === 1 },
    { k: "Against it", v: ping(2, "up"), hot: i === 2 },
    { k: "Head start", v: i >= 3 ? ns(TIMES.dt).toFixed(1) + " ns" : "—", hot: i === 3 },
    { k: "Water speed", v: i > 4 || (i === 4 && p > 0.4) ? SPEED.toFixed(2) + " m/s" : "—", hot: i === 4 },
    { k: "This second", v: i > 5 || (i === 5 && p > 0.4) ? "+" + (ADDED_M3 * 1000).toFixed(3) + " L" : "—", hot: i === 5 },
    { k: "Total", v: (i > 6 || (i === 6 && p > 0.45) ? NEXT_DIGITS : DIGITS) + " m³", hot: i === 6 },
  ];
}

const swatches = [...document.querySelectorAll("[data-swatch]")];
swatches.forEach((b) => b.addEventListener("click", () => {
  swatches.forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
  const [top, mid, dark] = b.dataset.swatch.split(",");
  svg.style.setProperty("--m-top", top); svg.style.setProperty("--m-mid", mid); svg.style.setProperty("--m-dark", dark);
}));

mountStepper({
  key: "probe-fig3",
  svg,
  steps: STEPS,
  intro: "Press step 1 to start. Then watch a click of sound race through the water, one way and back.",
  outro: "Done! The meter repeats this every second, for years, on one small battery.",
  pose,
  chips,
});
`;

const css = `
:root{--ds:#e8664f;--ds-soft:rgba(232,102,79,.22);--us:#7a55c7;--us-soft:rgba(122,85,199,.2);--water:#7fb6e6}
.im-lcd{fill:#c9d8b4;stroke:none}
.im-lcd-digits{font-family:var(--font-mono);font-weight:700;fill:#26331d}
.im-lcd-unit{font-family:var(--font-mono);font-weight:700;fill:#26331d}
.im-lcd-seg{fill:#26331d;opacity:.12;stroke:none}
.im-lcd-seg[data-on],.im-lcd-on{opacity:.85}
.im-window{fill:rgba(190,178,235,.75);stroke:none}
.sx path,.sx circle{stroke:var(--ink);stroke-width:.9px;stroke-linejoin:round}
.sx-brass{fill:#dcb14e}
.sx-meter{fill:var(--m-mid,#5f8fd0)}
.sx-bore{fill:#86b9e6}
.sx .sx-shine{fill:#b5d7f4;stroke:none}
.sx-pocket,.sx-cavity{fill:#dfe4ee}
.sx .sx-flow{fill:none;stroke:#f4fbff;stroke-dasharray:5 7;stroke-linecap:round;vector-effect:none!important;stroke-width:.55}
.sx .sx-path{fill:none;stroke:rgba(31,42,68,.35);stroke-width:.8px;stroke-dasharray:1.5 2.5}
.sx .sx-trail{fill:none;stroke-width:${BEAM_HALF * 2};stroke-linejoin:miter;stroke-miterlimit:4;stroke-linecap:butt;vector-effect:none!important;stroke-opacity:.36}
.sx .sx-trail.sx-ds{stroke:var(--ds)}.sx .sx-trail.sx-us{stroke:var(--us)}
.sx .sx-crest{fill:none;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round}
.sx .sx-glow{fill:none;stroke:#fff;stroke-opacity:.7;stroke-width:5px;stroke-linecap:round;stroke-linejoin:round}
.sx .sx-crest.sx-ds{stroke:var(--ds)}.sx .sx-crest.sx-us{stroke:var(--us)}
.sx-steel{fill:#cfd6df}
.sx-backing{fill:#3b4252}
.sx-piezo{fill:#efe3c2;transition:fill .08s}
.sx-piezo[data-lit]{fill:var(--sun)}
.sx .sx-electrode{fill:none;stroke:#9aa6b5;stroke-width:.7px}
.sx-oring{fill:#1f2a44}
.sx .sx-wire{fill:none;stroke:#b0763c;stroke-width:1.1px}
.sx .sx-wire[data-lit]{stroke:#f2b400;filter:drop-shadow(0 0 1.5px #ffd84a)}
.sx-mirror{fill:#eef2f6}
.sx-strut,.sx-foot{fill:#9aa6b5}
.sx-window{fill:rgba(190,178,235,.85)}
.sx-pcb{fill:#4fa36c}
.sx-lcdglass{fill:#c9d8b4}
.sx-zebra{fill:#e9a3b5}
.sx-led{fill:#fffdf6}
.sx-sensor{fill:#232838}
.sx-foam{fill:#8a8f9e}
.sx-clip{fill:#cfd6df}
.sx-can{fill:#cfd6df}
.sx-label{fill:#5fb57d}
.sx .sx-labelshade{fill:#4a9566;stroke:none}
.sx .sx-labelshine{fill:#8fd1a6;stroke:none}
.sx-labelband{fill:#1f2a44}
.sx-chip{fill:#2f3445;transition:fill .15s}
.sx-chip[data-lit]{fill:#f2b400;filter:drop-shadow(0 0 2px #ffd84a)}
.sx-xtal{fill:#e8ecf1}
.sx .sx-pins{fill:none;stroke:#9aa6b5;stroke-width:.8px}
.tw{display:grid;gap:8px}
@media (max-width:600px){.bk-card{padding:2px 0 0}.bk-card .iso-svg{width:118%;margin:-5% -9% -3%}}
.tw-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px}
.tw-clock{display:grid;gap:2px;min-width:150px}
.tw-clock span{font-size:13px;font-weight:700;color:var(--ink-soft)}
.tw-clock b{font:800 24px/1.1 var(--font-mono);color:var(--ink)}
.tw-svg{width:min(350px,100%);height:auto;display:block}
.tw-zoom-svg{width:min(260px,100%);height:auto;display:block}
.tw-zoomwrap{display:grid;gap:2px}
.tw-zoomwrap span{font-size:12px;font-weight:700;color:var(--ink-soft)}
.tw-name{font-family:var(--font-ui);font-weight:800;font-size:11px;fill:var(--ink)}
.tw-track{stroke:var(--ink-faint);stroke-width:2;stroke-linecap:round}
.tw-bar{stroke-width:6;stroke-linecap:round}
.tw-bar.tw-ds,.tw-wave.tw-ds,.tw-mark.tw-ds{stroke:var(--ds)}
.tw-bar.tw-us,.tw-wave.tw-us,.tw-mark.tw-us{stroke:var(--us)}
.tw-val{font-family:var(--font-mono);font-weight:700;font-size:10.5px;fill:var(--ink)}
.tw-tick{stroke:var(--ink-soft);stroke-width:1}
.tw-axis{font-family:var(--font-mono);font-weight:700;font-size:9px;fill:var(--ink-soft)}
.tw-grid{stroke:var(--ink-faint);stroke-width:1}
.tw-wave{fill:none;stroke-width:2;stroke-linejoin:round}
.tw-mark{stroke-width:1.2;stroke-dasharray:2 2}
.tw-bracket{fill:none;stroke:var(--ink);stroke-width:1.5}
.tw-dt{font-family:var(--font-mono);font-weight:800;font-size:11px;fill:var(--ink)}
.tw-sums{display:grid;gap:3px;margin:0;padding:0;list-style:none}
.tw-sums li{font:700 13px/1.35 var(--font-mono);color:var(--ink);opacity:.18;transition:opacity .3s}
.tw-sums li[data-on]{opacity:1}
.tw p{margin:0;font-size:13px;color:var(--ink-soft);font-weight:700}
`;

const cR = M.C.toFixed(0);
const extras = `
<div class="bk-panel tw">
  <div class="tw-row">
    <div class="tw-clock"><span>Stopwatch</span><b data-clock>0.0000 µs</b><span data-clock-who>waiting for a click</span></div>
    <div data-lanes></div>
    <div class="tw-zoomwrap"><span>Arrivals, zoomed in (µs)</span><div data-zoom></div></div>
  </div>
  <ul class="tw-sums">
    <li data-sum="4">speed = head start × c² ÷ (2 × mirror gap) = ${fmt(M.ns(T.dt), 1)} ns × (${cR} m/s)² ÷ (2 × ${M.METER.pathMm} mm) = ${fmt(M.SPEED, 2)} m/s</li>
    <li data-sum="5">flow = speed × hole = ${fmt(M.SPEED, 2)} m/s × ${fmt(M.AREA_M2 * 1e6, 1)} mm² = ${fmt(M.FLOW_M3S * 1000, 3)} L every second</li>
    <li data-sum="6">total = ${M.METER.startTotalM3.toFixed(4)} m³ + ${fmt(M.ADDED_M3, 6)} m³ = ${M.END_TOTAL_M3.toFixed(4)} m³, shown as ${NEXT_DIGITS}</li>
  </ul>
  <p>The click is ${M.METER.freqHz / 1e6} MHz sound, far too high to hear: its crests are ${fmt(M.WAVELENGTH_M * 1000, 2)} mm apart, and each wiggle in the zoom is one millionth of a second. In the slow-motion pings the water stands still, because it moves only ${fmt(M.WATER_MOVES_M * 1000, 2)} mm while the click crosses.</p>
</div>
<div class="bk-extras">
  <div class="bk-swatches">Meter colour
    <button class="bk-swatch" type="button" aria-label="Blue" aria-pressed="true" data-swatch="#8fb7ea,#5f8fd0,#4370b0" style="background:#5f8fd0"></button>
    <button class="bk-swatch" type="button" aria-label="Teal" aria-pressed="false" data-swatch="#93d9c9,#4fb3a2,#378a7c" style="background:#4fb3a2"></button>
    <button class="bk-swatch" type="button" aria-label="Orange" aria-pressed="false" data-swatch="#f6b77a,#e58c43,#bf6a26" style="background:#e58c43"></button>
    <button class="bk-swatch" type="button" aria-label="Plum" aria-pressed="false" data-swatch="#cfb0e3,#a07bc0,#7c5a9c" style="background:#a07bc0"></button>
  </div>
</div>`;

const sources = [
  `Transit times on a U path with two 45° reflectors: t<sub>down</sub> = l/c + L/(c + v) + l/c and t<sub>up</sub> = l/c + L/(c − v) + l/c with l = D/2, so Δt = t<sub>up</sub> − t<sub>down</sub> = 2Lv/(c² − v²) ≈ 2Lv/c², and Q = K·v·A: <a href="https://www.ti.com/lit/pdf/snia020" target="_blank" rel="noopener">TI SNIA020, Ultrasonic Sensing for Water Flow Meters and Heat Meters</a>. The figure uses the exact form and solves it for v; it takes K = 1 (real meters calibrate K for the flow profile).`,
  `c = ${M.C.toFixed(1)} m/s: speed of sound in pure water at ${M.WATER.tempC} °C from Marczak's equation (J. Acoust. Soc. Am. 102, 1997), one of the fits on <a href="https://resource.npl.co.uk/acoustics/techguides/soundpurewater/" target="_blank" rel="noopener">NPL's speed-of-sound guide</a>. Tap water is close to this; a real meter corrects for temperature.`,
  `DN15, Q3 = 2.5 m³/h (Q4 = 3.125 m³/h), transit-time ultrasonic measurement, an optical eye on the front and a 3.65 V lithium battery for up to 16 years: Kamstrup MULTICAL 21 / flowIQ 2101 <a href="https://sik.dk/sites/default/files/2023-03/midmid_dk_0200_mi001_015_ver37.pdf" target="_blank" rel="noopener">EU type-examination certificate DK-0200-MI001-015</a>.`,
  `1 MHz transducers, one upstream and one downstream measurement per second, and absolute times of flight of 35–70 µs in typical meters: <a href="https://www.ti.com/lit/pdf/tidudn0" target="_blank" rel="noopener">TI TIDM-1019 reference design</a>. The ${fmt(M.us(T.down), 1)} µs here sits inside that range.`,
  `<b>Assumed, not from a datasheet:</b> the ${M.METER.pathMm} mm between the mirrors (chosen to fit a ~110 mm DN15 body and give a time of flight in TI's range), a round ${M.METER.boreMm} mm bore (many meters narrow the tube to speed the water up, which makes Δt bigger), a 3-cycle burst, an AA-size lithium cell, the ${M.METER.startTotalM3} m³ starting total and the shape of the received wave in the zoom. Change any of them in <code>model.mjs</code> and every number follows.`,
  `<code>${M.METER.obisVolume}</code>: the water volume register that the probe reads in Fig 1 (same caveat as there: the rest of the code and the total are invented for these figures).`,
  `The water streaks are drawn about ${Math.round((M.V * 1000) / 14)} times slower than real water so you can follow them; in the two pings they move at the true speed slowed 100000 times, which is ${fmt(M.WATER_MOVES_M * 1000, 2)} mm in a whole trip, so they stand still.`,
];

const page = bookPage({
  fig: "Fig 3",
  title: "Inside the meter",
  question: "How does a smart water meter turn flowing water into the number on its screen?",
  label: "An ultrasonic water meter cut open. Use the step buttons to play each step.",
  svg,
  extras,
  idea: "The big idea: <em>sound arrives sooner going with the water, and that tiny head start tells the meter how fast the water flows.</em>",
  sources,
  css,
  script: kitScript() + "\n" + live,
});

writeFileSync(join(HERE, "index.html"), page);
console.log("wrote index.html", (page.length / 1024).toFixed(0) + " KB", "tour", (0.9 + STEPS.reduce((s, x) => s + x.dur, 0) + 0.7 * (STEPS.length - 1) + 1.6).toFixed(2) + " s");
