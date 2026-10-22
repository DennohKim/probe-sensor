const svg = document.querySelector(".bk-card svg");
const all = (name) => [...svg.querySelectorAll('[data-part="' + name + '"]')];
const shown = (name) => [...svg.querySelectorAll('[data-show="' + name + '"]')];
const each = (els, fn) => els.forEach(fn);
const fade = (els, a) => { const v = a.toFixed(3); els.forEach((el) => { if (el.style.opacity !== v) el.style.opacity = v; }); };
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (t) => Math.min(1, Math.max(0, t));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const shift = (by) => translateAlong(P, by);
const after = (i, p, step, at) => i > step || (i === step && p >= at);

const R_LIST = [];
for (const d of [10, 100, 1000]) for (const v of E12) { const r = v * d / 10; if (r >= 47 && r <= 2200) R_LIST.push(r); }
const BAUDS = [300, 600, 1200, 2400, 4800, 9600, 19200];
const PICK = ledResistor().picked;
const ui = { offset: 0, sun: 0, rled: R_LIST.indexOf(PICK), baud: 0, filter: true };
let cache = null, cacheKey = "";
function current() {
  const key = [ui.offset, ui.sun, ui.rled, ui.baud, ui.filter].join("|");
  if (key !== cacheKey) {
    cache = solve({ offset: ui.offset, sun: ui.sun, filter: ui.filter, rLed: R_LIST[ui.rled], baud: BAUDS[ui.baud] });
    cacheKey = key;
  }
  return cache;
}

// Printing: the cup and cap grow layer by layer on the print sheet.
const printCup = all("print-cup")[0], printCap = all("print-cap")[0];
let lastCup = -1, lastCap = -1;
function plainSvg(cx, cy, z, h, kind) {
  if (h <= 0.05) return "";
  const r0 = GEO.CUPR.ro;
  let out = '<g class="c-pla">' + solidSvg(cylinder(cx, cy, r0, z, h, P, 56, 0.6), { tone: "hi" }) + "</g>";
  const lines = [];
  for (let zz = 2.4; zz < h - 0.6; zz += 2.4) lines.push(sideArc(cx, cy, r0, z + zz, P, 32));
  if (lines.length) out += lineSvg(lines.join(""), { tone: "faint" });
  if (kind === "cup" && h > GEO.CUPR.floor + 0.2) out += '<path class="bx-inside" d="' + pathOf(circleRing(cx, cy, GEO.CUPR.ri, 48).map((q) => iso([q[0], q[1], z + h], P)), true) + '"/>';
  return out;
}
function printing(i, p) {
  const cupH = i < 0 ? 0 : i === 0 && p < 0.8 ? GEO.CUPR.h * smooth(seg(p, 0.04, 0.7)) : 0;
  const capH = i < 0 ? 0 : i === 0 ? GEO.CAPH * smooth(seg(p, 0.04, 0.5)) : after(i, p, 5, 0.06) ? 0 : GEO.CAPH;
  const ch = Math.round(cupH * 10), kh = Math.round(capH * 10);
  if (ch !== lastCup) { printCup.innerHTML = plainSvg(GEO.PRINT.cup[0], GEO.PRINT.cup[1], GEO.SHEET_Z, cupH, "cup"); lastCup = ch; }
  if (kh !== lastCap) { printCap.innerHTML = plainSvg(GEO.PRINT.cap[0], GEO.PRINT.cap[1], GEO.SHEET_Z, capH, "cap"); lastCap = kh; }
}

// Where the probe is, as an offset from its place on the stand.
function probeOffset(i, p, s) {
  const onStand = [s.offset, 0, 0];
  if (i < 0) return { at: [-GEO.CUP_MOVE[0], -GEO.CUP_MOVE[1], -GEO.CUP_MOVE[2]], seen: 0 };
  if (i === 0) {
    const u = smooth(seg(p, 0.8, 1));
    const from = [-GEO.CUP_MOVE[0], -GEO.CUP_MOVE[1], -GEO.CUP_MOVE[2]];
    const pos = lerp3(from, onStand, u);
    pos[2] += 36 * Math.sin(Math.PI * u);
    return { at: pos, seen: p >= 0.8 ? 1 : 0 };
  }
  if (i === 6) {
    const u = smooth(seg(p, 0.3, 0.5));
    const pos = lerp3(onStand, GEO.HOVER, u);
    pos[2] += 26 * Math.sin(Math.PI * u);
    return { at: pos, seen: 1 };
  }
  if (i === 7) {
    const u = seg(p, 0, 0.2);
    const e = u < 0.8 ? 0.94 * smooth(u / 0.8) : 0.94 + 0.06 * ((u - 0.8) / 0.2) ** 2;
    const pos = lerp3(GEO.HOVER, onStand, e);
    pos[2] += 20 * Math.sin(Math.PI * Math.min(1, u / 0.8));
    return { at: pos, seen: 1 };
  }
  return { at: onStand, seen: 1 };
}

// Parts flying from the tray into the cup: up, over, and down; the LED and sensor turn over on the way.
function flight(name, u, to, flip) {
  const f = GEO.FLY[name];
  const d = sub(add(f.to, to), f.from);
  const pos = [d[0] * smooth(u), d[1] * smooth(u), d[2] * smooth(u) + 44 * Math.sin(Math.PI * u)];
  const els = all("fly-" + name);
  each(els, (el) => {
    el.setAttribute("transform", shift(pos));
    el.style.opacity = u >= 1 ? "0" : "1";
    if (!flip) return;
    const c = iso(f.from, P);
    const w = u < 0.35 || u > 0.65 ? 1 : Math.abs(Math.cos(((u - 0.35) / 0.3) * Math.PI));
    const t = "translate(" + c[0].toFixed(2) + " " + c[1].toFixed(2) + ") scale(1 " + w.toFixed(3) + ") translate(" + (-c[0]).toFixed(2) + " " + (-c[1]).toFixed(2) + ")";
    const up = el.querySelector('[data-face="up"]'), down = el.querySelector('[data-face="down"]');
    up.setAttribute("transform", t); down.setAttribute("transform", t);
    up.style.opacity = u < 0.5 ? "1" : "0"; down.style.opacity = u < 0.5 ? "0" : "1";
  });
}

// The soldering iron: its tip visits each joint, then goes home to the stand.
const JOINTS = {
  board: [[GEO.ST.x + GEO.LEDX - 1.27, GEO.ST.y + 1.5, GEO.FACE + 10.6], [GEO.ST.x + GEO.PTX + 1.27, GEO.ST.y + 1.5, GEO.FACE + 10.6], [GEO.ST.x - 5.6, GEO.ST.y + 1.5, GEO.FACE + 10.4]],
  wires: [[GEO.ST.x, GEO.ST.y + 1.5, GEO.FACE + 10.6], [GEO.ST.x + GEO.LEDX + 1.27, GEO.ST.y + 1.5, GEO.FACE + 10.8]],
  ft: [[GEO.FT.x + 2.6, GEO.FT.y + 4.9, GEO.FTZ + 2.4], [GEO.FT.x + 2.6, GEO.FT.y + 12.1, GEO.FTZ + 2.4]],
};
function tour(p, legs) {
  for (const [a, b, from, to] of legs) if (p < b) {
    if (p < a) return from;
    const u = smooth((p - a) / (b - a));
    const pos = lerp3(from, to, u);
    const far = Math.hypot(to[0] - from[0], to[1] - from[1]);
    pos[2] += Math.min(40, far * 0.4) * Math.sin(Math.PI * u);
    return pos;
  }
  return legs[legs.length - 1][3];
}
function ironTip(i, p, s) {
  const home = GEO.IRON_REST;
  const sx = [s.offset, 0, 0];
  const j = (list, n) => add(list[n], sx);
  if (i === 2) return tour(p, [[0.3, 0.48, home, j(JOINTS.board, 0)], [0.55, 0.62, j(JOINTS.board, 0), j(JOINTS.board, 1)], [0.68, 0.75, j(JOINTS.board, 1), j(JOINTS.board, 2)], [0.82, 1, j(JOINTS.board, 2), home]]);
  if (i === 3) return tour(p, [[0.08, 0.22, home, j(JOINTS.wires, 0)], [0.3, 0.36, j(JOINTS.wires, 0), j(JOINTS.wires, 1)], [0.42, 0.55, j(JOINTS.wires, 1), JOINTS.ft[0]], [0.6, 0.64, JOINTS.ft[0], JOINTS.ft[1]], [0.7, 0.86, JOINTS.ft[1], home]]);
  return home;
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
function stroke(group, route, r, shine = true) {
  const [outer, inner, glint] = group.children;
  const d = pathOf(catmull(route).map((q) => iso(q, P)));
  const w = 2 * r * SCALE;
  outer.setAttribute("d", d); outer.style.strokeWidth = (w + 1.6).toFixed(2);
  inner.setAttribute("d", d); inner.style.strokeWidth = Math.max(0.6, w - 1).toFixed(2);
  if (shine && glint) { glint.setAttribute("d", d); glint.style.strokeWidth = (w * 0.24).toFixed(2); }
}
const cableEl = all("cable")[0], otgEl = all("otg-cable")[0], cordEl = all("cord")[0];
const R0 = GEO.CABLE_R;
const FT_END = [GEO.FT.x - 13, GEO.FT.y + GEO.FT.d / 2, GEO.FTZ + 3.2];
const BENCH_END = [GEO.ST.x - 34, GEO.ST.y + 30, GEO.Z0 + R0];
function cableRoute(top, wired) {
  const R = GEO.Z0 + R0;
  const rise = [top[0], top[1], top[2] + 10];
  const mid = [lerp(top[0], -60, 0.5), lerp(top[1], 34, 0.5), Math.max(R, top[2] * 0.5)];
  const placed = [top, rise, mid, [-70, 45, R], [-124, 47, R], [-136, 58, R], [FT_END[0] - 5, FT_END[1], FT_END[2] - 1], FT_END];
  const lying = [BENCH_END, [BENCH_END[0] - 8, BENCH_END[1] + 6, R], [-58, 28, R], [-70, 45, R], [-124, 47, R], [-136, 58, R], [FT_END[0] - 5, FT_END[1], FT_END[2] - 1], FT_END];
  return lying.map((q, n) => lerp3(q, placed[n], wired));
}

// The phone screen.
const rows = [...svg.querySelectorAll('[data-part="screen"] text')];
const screenEl = svg.querySelector(".pb-screen");
const camView = all("camera-view"), cvGlow = all("cv-glow"), cvCore = all("cv-core");
const HEADER = (baud) => "ProbeTest · FT232R · " + baud + " 7E1";
const STATUS = {
  ok: "echo ✓ every letter came back",
  garbled: "echo ✗ letters garbled",
  dark: "echo ✗ nothing came back",
  flooded: "echo ✗ sensor flooded: all light",
  burnt: "✗ TX pin burnt out",
};

function bitAt(text, baud, r) {
  const bit = 1 / baud;
  const k = Math.floor(r / bit);
  if (r < 0 || k >= text.length * BITS) return null;
  const c = Math.floor(k / BITS), b = k % BITS;
  return { c, b, value: frameOf(text.charCodeAt(c))[b] };
}

let lastNote = "";
const noteEl = document.querySelector("[data-note]");
const outs = Object.fromEntries([...document.querySelectorAll("[data-out]")].map((el) => [el.dataset.out, el]));
const bomR = document.querySelector("[data-bom='rled']");

function noteOf(s) {
  const low = "the FT232R is only sure of a 0 below " + UART.vLow.toFixed(1) + " V";
  if (s.state === "burnt") return "At " + ohmsText(s.r) + " the LED pulls " + s.mA.toFixed(0) + " mA through the TX pin, past its " + UART.sinkAbsMax + " mA absolute limit, so the pin burns out and nothing more is sent. The LED alone could take " + LED.ifMax + " mA.";
  if (s.state === "flooded") return "Sunlight floods the sensor: even with the LED dark, RX sits at " + s.volts.dark.toFixed(2) + " V, under the " + UART.vHigh.toFixed(1) + " V the chip needs to be sure of a 1, so every bit reads as light." + (s.filter ? "" : " Turn the daylight filter back on.");
  if ((s.state === "dark" || s.state === "garbled") && s.share < 0.9) return "The probe is " + s.offset.toFixed(1) + " mm off-centre: the washer's edge blocks " + Math.round((1 - s.share) * 100) + "% of the echo, so RX falls only to " + s.volts.light.toFixed(2) + " V, and " + low + (s.state === "dark" ? ": the letters are lost." : ": some letters come back garbled.");
  if (s.state === "dark" || s.state === "garbled") return "Only " + s.mA.toFixed(1) + " mA through " + ohmsText(s.r) + ": the flash is too dim, RX falls only to " + s.volts.light.toFixed(2) + " V, and " + low + ". A meter's sensor would miss it too.";
  if (s.tx.level === "warn") return s.mA.toFixed(1) + " mA is more than the " + UART.sinkHigh + " mA the TX pin is rated for: it still works, but drive the LED through a transistor.";
  if (s.baud !== DESIGN.meterBaud) return "The mirror echoes at any speed, because the phone only talks to itself. A meter starts at 300 baud, so at " + s.baud + " the phone would read its name as noise.";
  if (s.sun > 0.5) return "With the daylight filter the sensor only answers to 730–1120 nm, so even " + Math.round(s.lux / 1000) + " klx leaves RX at " + s.volts.dark.toFixed(2) + " V in the dark bits.";
  return "Move a slider to break the probe. The model re-runs and the phone shows what comes back.";
}

function pose(i, p) {
  const s = current();
  printing(i, p);

  const probe = probeOffset(i, p, s);
  each(all("probe"), (el) => { el.setAttribute("transform", shift(probe.at)); el.style.opacity = String(probe.seen); });
  const hover = i === 6 ? smooth(seg(p, 0.4, 0.5)) : i === 7 ? 1 - seg(p, 0, 0.08) : 0;
  fade(all("hover-shadow"), hover * 0.22);

  // Parts appear in the cut once they land.
  fade(shown("led"), after(i, p, 1, 0.55) ? 1 : 0);
  fade(shown("sensor"), after(i, p, 1, 0.8) ? 1 : 0);
  fade(shown("board"), after(i, p, 2, 0.45) ? 1 : 0);
  fade(shown("solder"), after(i, p, 2, 0.75) ? 1 : 0);
  fade(shown("wires"), after(i, p, 3, 0.3) ? 1 : 0);
  fade(shown("magnet"), after(i, p, 4, 0.62) ? 1 : 0);
  each([...svg.querySelectorAll('[data-show-ft="wires"]')], (el) => { el.style.opacity = after(i, p, 3, 0.5) ? "1" : "0"; });
  each([...svg.querySelectorAll('[data-show-ft="solder"]')], (el) => { el.style.opacity = after(i, p, 3, 0.6) ? "1" : "0"; });

  const onStand = [s.offset, 0, 0];
  flight("led", i < 1 ? 0 : i === 1 ? seg(p, 0.05, 0.55) : 1, onStand, true);
  flight("sensor", i < 1 ? 0 : i === 1 ? seg(p, 0.3, 0.8) : 1, onStand, true);
  flight("board", i < 2 ? 0 : i === 2 ? seg(p, 0.02, 0.45) : 1, onStand, false);
  flight("magnet", i < 4 ? 0 : i === 4 ? seg(p, 0.05, 0.62) : 1, onStand, false);

  const capU = i < 5 ? 0 : i === 5 ? seg(p, 0.06, 0.62) : 1;
  const capPos = lerp3([-GEO.CAP_MOVE[0], -GEO.CAP_MOVE[1], -GEO.CAP_MOVE[2]], [0, 0, 0], smooth(capU));
  capPos[2] += 40 * Math.sin(Math.PI * capU);
  each(all("cap"), (el) => { el.setAttribute("transform", shift(capPos)); el.style.opacity = after(i, p, 5, 0.06) ? "1" : "0"; });

  const tip = ironTip(i, p, s);
  const ironShift = shift(sub(tip, GEO.IRON_REST));
  each(all("iron"), (el) => el.setAttribute("transform", ironShift));
  const tail = add(GEO.IRON_TAIL, sub(tip, GEO.IRON_REST));
  stroke(cordEl, [tail, add(tail, [8, -4, -10]), [tail[0] + 10, Math.min(tail[1] - 10, -100), 40], [150, -112, 18], [158, -116, 0]], 1.4, false);

  const shrinkU = i < 3 ? 0 : i === 3 ? seg(p, 0.72, 0.9) : 1;
  each(all("shrink-loose"), (el) => { el.setAttribute("transform", shift([-14 * (1 - smooth(shrinkU)), 0, 0])); el.style.opacity = after(i, p, 3, 0.94) ? "0" : "1"; });
  fade(all("shrink-tight"), after(i, p, 3, 0.94) ? 1 : 0);

  const wired = i < 3 ? 0 : i === 3 ? smooth(seg(p, 0.1, 0.32)) : 1;
  const top = add([GEO.ST.x, GEO.ST.y, GEO.BOOT_TOP], probe.at);
  stroke(cableEl, cableRoute(top, wired), R0);

  const plugIn = i < 6 ? 0 : i === 6 ? smooth(seg(p, 0.04, 0.22)) : 1;
  const dx = GEO.OTG.unplug * (1 - plugIn);
  each(all("otg-plug"), (el) => el.setAttribute("transform", shift([dx, 0, 0])));
  const o = GEO.OTG;
  stroke(otgEl, [[o.x0 + 12, o.y, o.z], [o.x0 + 19, o.y + 5, o.z - 1], [o.x0 + 22 + dx * 0.3, o.y + 17, 1.6 + GEO.Z0], [o.x1 - 30 + dx * 0.8, o.y + 15, 1.6 + GEO.Z0], [o.x1 - 25 + dx, o.y + 4, o.z - 1], [o.x1 - 18.6 + dx, o.y, o.z]], 1.5);

  // Light: which bit is on the LED now, at the real baud, slowed to the step's speed.
  const powered = after(i, p, 6, 0.22);
  const sending = i === 6 ? seg(p, 0.42, 0.42 + SEND_SHARE[6]) : i === 7 ? seg(p, 0.3, 0.3 + SEND_SHARE[7]) : 0;
  const live = (i === 6 || i === 7) && sending > 0 && sending < 1;
  const sendS = DESIGN.text.length * charSeconds(s.baud);
  const bit = live ? bitAt(DESIGN.text, s.baud, sending * sendS) : null;
  const lit = !!bit && bit.value === 0 && s.state !== "burnt";
  const glow = lit ? Math.min(1, 0.35 + s.mA / 8) : 0;
  fade(all("glow-led"), glow);
  each(all("led-body"), (el) => el.toggleAttribute("data-lit", lit));
  fade(all("flow-tx"), lit ? 1 : 0);
  each(all("flow-tx"), (el) => { el.style.strokeDashoffset = (-p * 90).toFixed(2); });

  const onStandNow = i === 7 && p > 0.2;
  const echoLit = lit && onStandNow;
  const rxLow = s.volts.light < UART.vHigh;
  const flooded = s.state === "flooded" && onStandNow;
  const sensorLit = (echoLit && rxLow) || flooded;
  each(all("sensor-body"), (el) => el.toggleAttribute("data-lit", sensorLit));
  fade(all("flow-rx"), sensorLit ? 1 : 0);
  each(all("flow-rx"), (el) => { el.style.strokeDashoffset = (-p * 90).toFixed(2); });
  each(svg.querySelectorAll('[data-wire="white"]'), (el) => el.toggleAttribute("data-lit", lit));
  each(svg.querySelectorAll('[data-wire="green"]'), (el) => el.toggleAttribute("data-lit", sensorLit));
  each(all("ft-tx"), (el) => el.classList.toggle("is-on", lit));
  each(all("ft-rx"), (el) => el.classList.toggle("is-on", sensorLit));
  each(all("ft-chip"), (el) => el.classList.toggle("is-hot", s.tx.level === "burn" && powered));

  each(all("beam"), (el) => {
    if (!echoLit) { if (el.innerHTML) el.innerHTML = ""; return; }
    const x0 = GEO.ST.x + s.offset + GEO.LEDX, x1 = GEO.ST.x + s.offset + GEO.PTX, xm = GEO.ST.x + s.offset;
    const zc = -(GEO.FACE + GEO.CHIP), zm = -GEO.MIRZ;
    const a = Math.min(1, 0.3 + s.mA / 7);
    el.innerHTML = '<path class="bx-beam" style="opacity:' + a.toFixed(2) + '" d="M' + x0 + " " + zc + "L" + xm + " " + zm + '"/>' +
      '<path class="bx-beam" style="opacity:' + (a * s.share).toFixed(2) + '" d="M' + xm + " " + zm + "L" + x1 + " " + zc + '"/>' +
      '<circle class="bx-spot" cx="' + xm + '" cy="' + zm + '" r="1.6" style="opacity:' + a.toFixed(2) + '"/>';
  });

  // Bands on the resistors follow the values.
  const paint = (name, ohms) => bandsOf(ohms).forEach((v, n) => {
    const fill = GEO.BAND_FILL[typeof v === "number" ? BAND_COLOURS[v] : v];
    each(svg.querySelectorAll('[data-band="' + name + "-" + n + '"]'), (el) => { if (el.style.fill !== fill) el.style.fill = fill; });
  });
  paint("rled", s.r);
  paint("rpu", s.pu.picked);

  // Phone.
  screenEl.toggleAttribute("data-on", powered);
  const camera = i === 6 && p > 0.3;
  fade(camView, camera ? 1 : 0);
  fade(cvGlow, camera && lit ? glow : 0);
  fade(cvCore, camera && lit ? 1 : 0);
  const lines = ["", "", "", "", "", ""];
  if (powered) lines[0] = camera ? "Front camera" : HEADER(s.baud);
  if (i === 7 || (i === 6 && !camera && powered)) {
    const sentChars = i === 7 ? (sending >= 1 ? DESIGN.text.length : Math.floor((sending * sendS) / charSeconds(s.baud))) : 0;
    lines[1] = "> " + DESIGN.text.slice(0, sentChars);
    if (i === 7 && sending > 0) {
      const back = s.back.slice(0, sentChars).map((b) => b.ch).join("");
      lines[2] = "< " + back;
    }
    if (i === 7 && sending >= 1) {
      lines[3] = STATUS[s.state];
      if (p > 0.95) { lines[4] = "a meter at 300 baud would say:"; lines[5] = s.meter.slice(0, 26) + (s.meter === METER_ID ? " ✓" : ""); }
    }
  }
  rows.forEach((row, n) => { if (row.textContent !== lines[n]) row.textContent = lines[n]; });
  rows[3].classList.toggle("is-bad", s.state !== "ok");

  each(all("sun"), (el) => { el.style.opacity = (ui.sun * 0.22).toFixed(3); });

  outs.offset.textContent = ui.offset.toFixed(1) + " mm";
  outs.sun.textContent = Math.round(s.lux / 1000) + " klx";
  outs.rled.textContent = ohmsText(s.r);
  outs.baud.textContent = s.baud + " baud";
  if (bomR) bomR.textContent = ohmsText(s.r);
  const note = noteOf(s);
  if (note !== lastNote) { noteEl.textContent = note; lastNote = note; }
}

function chips(i, p) {
  const s = current();
  const pick = ledResistor();
  const done = i === 7 && p >= 0.95;
  return [
    { k: "LED resistor", v: "(5 − " + pick.vf.toFixed(2) + " − " + pick.vol.toFixed(2) + ") V ÷ " + DESIGN.ledTarget + " mA = " + Math.round(pick.exact) + " Ω → " + ohmsText(s.r), hot: i === 2 || s.r !== pick.picked },
    { k: "TX pin", v: s.mA.toFixed(1) + " of " + UART.sinkHigh + " mA (high drive) · " + s.tx.text, hot: s.tx.level !== "ok" },
    { k: "Pull-up", v: ohmsText(s.pu.picked), hot: i === 2 },
    { k: "RX dark", v: s.volts.dark.toFixed(2) + " V → " + (readAs(s.volts.dark).sure ? readAs(s.volts.dark).bit : "?"), hot: readAs(s.volts.dark).bit !== 1 },
    { k: "RX lit", v: s.volts.light.toFixed(2) + " V → " + (readAs(s.volts.light).sure ? readAs(s.volts.light).bit : "?"), hot: readAs(s.volts.light).bit !== 0 },
    { k: "LED ↔ sensor", v: PORT.spacing + " mm", hot: i === 1 },
    { k: "Magnet", v: PORT.magnet.od + " × " + PORT.magnet.id + " × " + PORT.magnet.h + " mm", hot: i === 4 },
    { k: "Mirror test", v: done || ui.offset || ui.sun || s.r !== pick.picked ? (s.word || "—") + (s.state === "ok" ? " ✓" : " ✗") : "—", hot: i === 7 },
    { k: "Meter @300", v: s.baud === DESIGN.meterBaud ? "speeds match" : "noise at " + s.baud, hot: s.baud !== DESIGN.meterBaud },
  ];
}

const OUTRO = {
  ok: "Done! The light went out, bounced off the mirror and came back as the same letters.",
  garbled: "The light only half reached the sensor, so some letters came back wrong. Put the sliders back to fix it.",
  dark: "No echo: too little light came back to pull RX low. Put the sliders back to fix it.",
  flooded: "Sunlight drowned the echo: every bit read as light. Turn the filter back on, or shade the probe.",
  burnt: "Too much current: the TX pin burnt out. A bigger resistor keeps it safe.",
};
const stepperConfig = {
  key: "probe-fig2",
  svg,
  steps: STEPS,
  intro: "Press step 1 to start. Then watch the probe come together on the bench.",
  outro: OUTRO.ok,
  pose: (i, p) => { stepperConfig.outro = OUTRO[current().state]; pose(i, p); },
  chips,
};
const stepper = mountStepper(stepperConfig);

const sliders = [...document.querySelectorAll("[data-slider]")];
const filterEl = document.querySelector("[data-filter]");
function readUi() {
  for (const el of sliders) ui[el.dataset.slider] = +el.value;
  ui.filter = filterEl.checked;
  stepper.render();
}
sliders.forEach((el) => el.addEventListener("input", readUi));
filterEl.addEventListener("change", readUi);
document.querySelector("[data-slider-reset]").addEventListener("click", () => {
  for (const el of sliders) el.value = el.dataset.slider === "rled" ? String(R_LIST.indexOf(PICK)) : "0";
  filterEl.checked = true;
  readUi();
});
for (const el of sliders) if (el.dataset.slider === "rled") { el.max = String(R_LIST.length - 1); el.value = String(R_LIST.indexOf(PICK)); }
readUi();
