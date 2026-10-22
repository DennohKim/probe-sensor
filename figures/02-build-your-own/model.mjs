// A home-made IEC 62056-21 optical probe, as a pure model: the parts, the two resistors it needs,
// the voltages the serial chip sees, and what comes back in a mirror test. Every number the figure shows comes from here.
// Lengths in mm, currents in mA, voltages in V, resistances in ohms, irradiance in mW/cm².

export const SUPPLY = { vcc: 5.0 };

// Vishay TSAL4400 datasheet (doc 81006, rev 2.0, 2025): 3 mm T-1, 940 nm, ±25°, IF max 100 mA,
// VF 1.35 V typ at 100 mA and 2.6 V typ at 1 A, radiant intensity 36 mW/sr typ (16 min) at 100 mA.
export const LED = { part: "TSAL4400", maker: "Vishay", nm: 940, dia: 3, halfAngle: 25, ifMax: 100, vfAt100: 1.35, vfAt1A: 2.6, ieTyp100: 36, ieMin100: 16 };

// ams OSRAM SFH 309 FA datasheet (v1.3, 2018): 3 mm T-1, NPN, 900 nm peak, 730–1120 nm with the daylight filter,
// ±12°, group -4 gives 1.0–2.0 mA at Ee = 0.5 mW/cm² (950 nm, VCE 5 V), dark current 50 nA max, VCEsat 0.2 V typ,
// IC max 15 mA, chip 2.4–2.8 mm behind the dome tip. The plain SFH 309 (no filter) sees 380–1150 nm.
export const SENSOR = { part: "SFH 309 FA-4", maker: "ams OSRAM", peakNm: 900, bandFiltered: [730, 1120], bandClear: [380, 1150], halfAngle: 12, ipceMin: 1.0, ipceMax: 2.0, eeRef: 0.5, darkMax: 50e-6, vceSat: 0.2, icMax: 15, chipDepth: 2.6 };

// FTDI FT232R datasheet (FT_000053 v2.10), VCCIO = 5 V: TXD/RXD switch between 1.0 and 1.5 V, 25 mV hysteresis;
// outputs sink 2 mA at standard drive and 6 mA at high drive with VOL 0.4 V typ; 24 mA absolute maximum;
// inputs have an internal 200 kΩ pull-up to VCCIO.
export const UART = { part: "FT232RL", maker: "FTDI", vLow: 1.0, vHigh: 1.5, pullUpInternal: 200e3, sinkStandard: 2, sinkHigh: 6, sinkAbsMax: 24, volTyp: 0.4 };

// The port. 6.5 mm between LED and sensor centres: the LED and phototransistor footprints in twam's open
// IEC 62056-21 probe PCB. Ring magnet 27 × 16 × 5 mm N42: the volkszaehler.org TTL read head's parts list.
// 34 mm head: the MY015-D. The standard's own drawing was not checked.
export const PORT = { spacing: 6.5, magnet: { od: 27, id: 16, h: 5, grade: "N42" }, head: 34 };

// The printed parts and the test stand.
export const CUP = { od: 34, id: 28, h: 24, floor: 1.2, hole: 3.1 };
export const CAP = { od: 34, h: 4, boot: 7, bootR: 4.5 };
export const BOARD = { dia: 14, t: 1.0, at: 8.5 };
export const WASHER = { id: 10.5, od: 30, t: 1.5, name: "M10 fender washer" };
export const MIRROR = { dia: 20, t: 2, reflect: 0.9 };

export const DESIGN = { ledTarget: 5, pullUpMargin: 1.5, text: "HELLO", baud: 300, meterBaud: 300 };
export const METER_ID = "/WPA5WM-ULTRA-15";

// Light-ish numbers that are estimates, not datasheet values.
export const GUESS = {
  nVt: 0.05, // LED ideality × thermal voltage, n ≈ 2 at 25 °C, used to fit VF between the two datasheet points
  ledChipDepth: 2.6, // LED chip behind its dome tip, taken equal to the SFH 309 FA's 2.4–2.8 mm
  sunLumPerWatt: 100, // direct sunlight ≈ 100 klx at ≈ 1000 W/m²
  leak: 1e-3, // share of the daylight on the stand that reaches the sensor chip past the cup and washer
  share: { filtered: 0.25, clear: 0.5 }, // share of sunlight the sensor answers to, as if it were 950 nm, with and without the filter
  printRate: 3, // mm³ of plastic per second on a hobby printer
};

export const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];

export function nearestE12(ohms, mode = "nearest") {
  const list = [];
  for (let d = 1; d <= 1e6; d *= 10) for (const v of E12) list.push(v * d);
  if (mode === "up") return list.find((v) => v >= ohms) ?? list[list.length - 1];
  return list.reduce((best, v) => (Math.abs(Math.log(v / ohms)) < Math.abs(Math.log(best / ohms)) ? v : best), list[0]);
}

export function ohmsText(ohms) {
  if (ohms >= 1e6) return +(ohms / 1e6).toFixed(2) + " MΩ";
  if (ohms >= 1000) return +(ohms / 1000).toFixed(2) + " kΩ";
  return Math.round(ohms) + " Ω";
}

// Four-band colour code: two digits, multiplier, gold tolerance.
export const BAND_COLOURS = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white"];
export function bandsOf(ohms) {
  const exp = Math.floor(Math.log10(ohms)) - 1;
  const digits = Math.round(ohms / 10 ** exp);
  return [Math.floor(digits / 10), digits % 10, exp, "gold"];
}

// LED forward voltage, a diode with a series resistance fitted through the two datasheet points.
const LED_RS = (LED.vfAt1A - LED.vfAt100 - GUESS.nVt * Math.log(10)) / 0.9 / 1000;
const LED_V0 = LED.vfAt100 - GUESS.nVt * Math.log(100) - 100 * LED_RS;
export const ledVf = (mA) => (mA <= 0 ? 0 : LED_V0 + GUESS.nVt * Math.log(Math.max(mA, 1e-3)) + mA * LED_RS);
export const ledIntensity = (mA, which = "typ") => (which === "min" ? LED.ieMin100 : LED.ieTyp100) * (mA / 100);

// The TX pin pulls low through about 0.4 V / 6 mA of its own resistance (high drive, typical).
export const PIN_OHMS = UART.volTyp / (UART.sinkHigh / 1000);

// Current through LED, resistor and TX pin for a series resistor, solved by fixed-point iteration.
export function ledCurrent(rOhms) {
  let mA = 5;
  for (let k = 0; k < 40; k++) mA = Math.max(0, ((SUPPLY.vcc - ledVf(mA)) / (rOhms + PIN_OHMS)) * 1000);
  return mA;
}

// R = (5 V − VF − VOL) ÷ I, then the nearest E12 value.
export function ledResistor(targetmA = DESIGN.ledTarget) {
  const vf = ledVf(targetmA);
  const vol = (targetmA / 1000) * PIN_OHMS;
  const exact = ((SUPPLY.vcc - vf - vol) / targetmA) * 1000;
  return { vf, vol, exact, picked: nearestE12(exact) };
}

export function txVerdict(mA) {
  if (mA > UART.sinkAbsMax) return { level: "burn", text: "TX pin past its " + UART.sinkAbsMax + " mA limit: it burns" };
  if (mA > LED.ifMax) return { level: "burn", text: "LED past " + LED.ifMax + " mA: it burns" };
  if (mA > UART.sinkHigh) return { level: "warn", text: "over the pin's " + UART.sinkHigh + " mA: add a transistor" };
  return { level: "ok", text: "no transistor needed" };
}

// Relative intensity off-axis, cos^m with m set so it halves at the datasheet half angle.
const lobe = (halfDeg) => Math.log(0.5) / Math.log(Math.cos((halfDeg * Math.PI) / 180));
export const LED_M = lobe(LED.halfAngle);
export const SENSOR_M = lobe(SENSOR.halfAngle);
export const SENS_TYP = (SENSOR.ipceMin + SENSOR.ipceMax) / 2 / SENSOR.eeRef;
export const SENS_MIN = SENSOR.ipceMin / SENSOR.eeRef;

// Mirror test geometry: chips sit `depth` behind the face, the mirror `gap` below the face.
export function echoGeometry(gap) {
  const depth = SENSOR.chipDepth;
  const h = gap + depth;
  const half = PORT.spacing / 2;
  const theta = Math.atan(half / h);
  const path = 2 * Math.hypot(half, h);
  return { h, theta, path, depth };
}

// Irradiance on the sensor chip from the LED's own light off the mirror, weighted by the sensor's acceptance.
export function echoIrradiance(mA, gap, which = "typ") {
  const { theta, path } = echoGeometry(gap);
  const c = Math.cos(theta);
  const cm = path / 10;
  return (ledIntensity(mA, which) * MIRROR.reflect * c ** LED_M * c * c ** SENSOR_M) / (cm * cm);
}

// The mirror gap that gives the strongest echo, to the nearest 0.5 mm.
export function bestGap() {
  let best = 1, top = 0;
  for (let g = 0.5; g <= 40; g += 0.5) {
    const e = echoIrradiance(DESIGN.ledTarget, g);
    if (e > top) { top = e; best = g; }
  }
  return best;
}

// How much of the echo gets through the washer's hole when the probe sits off-centre:
// the return ray crosses the washer at |offset| + its own distance from the axis there, and the 3 mm dome lens
// spreads the bundle over its width.
export function clearShare(offset, gap) {
  const { h, depth } = echoGeometry(gap);
  const half = PORT.spacing / 2;
  const across = (z) => half * (1 - z / h);
  const reach = Math.abs(offset) + across(depth);
  const lens = LED.dia;
  return Math.min(1, Math.max(0, (WASHER.id / 2 - reach + lens / 2) / lens));
}

export const parallel = (a, b) => (a * b) / (a + b);

// Pull-up: big enough that the echo pulls RX below the 1.0 V the FT232R is sure to read as 0, with margin.
export function pullUp(gap) {
  const echo = SENS_TYP * echoIrradiance(DESIGN.ledTarget, gap);
  const need = (DESIGN.pullUpMargin * (SUPPLY.vcc - UART.vLow)) / (echo / 1000);
  const own = (need * UART.pullUpInternal) / (UART.pullUpInternal - need);
  return { echo, need, picked: nearestE12(own, "up") };
}

export const sunIrradiance = (lux) => lux / GUESS.sunLumPerWatt / 10;
export const luxOf = (sun) => 10 ** (4 + sun); // slider 0..1: shade (10 klx) to direct sun (100 klx)

// RX voltage for a lit and a dark bit.
export function rxVolts({ pullUp: rPu, echo, stray }) {
  const rEff = parallel(rPu, UART.pullUpInternal);
  const v = (mA) => Math.min(SUPPLY.vcc, Math.max(SENSOR.vceSat, SUPPLY.vcc - (mA / 1000) * rEff));
  return { dark: v(SENSOR.darkMax + stray), light: v(SENSOR.darkMax + stray + echo), rEff };
}

export function readAs(volts) {
  if (volts < UART.vLow) return { bit: 0, sure: true, p0: 1 };
  if (volts > UART.vHigh) return { bit: 1, sure: true, p0: 0 };
  return { bit: null, sure: false, p0: (UART.vHigh - volts) / (UART.vHigh - UART.vLow) };
}

// Start bit 0, seven data bits least significant first, even parity, stop bit 1 (7E1, as on the meter).
export function frameOf(code) {
  const data = Array.from({ length: 7 }, (_, b) => (code >> b) & 1);
  const ones = data.reduce((sum, bit) => sum + bit, 0);
  return [0, ...data, ones % 2, 1];
}
export const BITS = 10;
export const charSeconds = (baud) => BITS / baud;

const noise = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// What the phone reads back for each letter sent through the mirror.
export function echoText(text, volts) {
  const out = [];
  [...text].forEach((ch, c) => {
    const sent = frameOf(ch.charCodeAt(0));
    const got = sent.map((bit, b) => {
      const r = readAs(bit ? volts.dark : volts.light);
      return r.sure ? r.bit : noise(c + 1, b + 1) < r.p0 ? 0 : 1;
    });
    if (got[0] === 1) { out.push({ ch: "", lost: true }); return; }
    const code = got.slice(1, 8).reduce((acc, bit, j) => acc | (bit << j), 0);
    const ones = got.slice(1, 8).reduce((s, bit) => s + bit, 0);
    const ok = got[8] === ones % 2 && got[9] === 1;
    const printable = code >= 32 && code < 127;
    out.push({ ch: ok && printable ? String.fromCharCode(code) : "▒", bad: !ok || String.fromCharCode(code) !== ch });
  });
  return out;
}

// A UART at rxBaud listening to text sent at txBaud: it waits for a falling edge, then samples each bit's middle.
export function uartListen(text, txBaud, rxBaud) {
  const frames = [...text].map((ch) => frameOf(ch.charCodeAt(0)));
  const bit = 1 / txBaud, rb = 1 / rxBaud;
  const total = frames.length * BITS * bit;
  const level = (t) => {
    if (t < 0 || t >= total) return 1;
    const k = Math.floor(t / bit);
    return frames[Math.floor(k / BITS)][k % BITS];
  };
  const dt = Math.min(bit, rb) / 8;
  const out = [];
  let t = 0;
  while (t < total + BITS * rb) {
    if (level(t) === 0) {
      const at = (k) => level(t + (k + 0.5) * rb);
      if (at(0) === 0) {
        const bits = Array.from({ length: BITS }, (_, k) => at(k));
        const code = bits.slice(1, 8).reduce((acc, b, j) => acc | (b << j), 0);
        const ones = bits.slice(1, 8).reduce((s, b) => s + b, 0);
        const ok = bits[8] === ones % 2 && bits[9] === 1;
        out.push(bits[9] === 1 && code >= 32 && code < 127 ? String.fromCharCode(code) : "▒");
        t += (BITS - 0.5) * rb;
        while (t < total && level(t) === 0) t += dt;
        continue;
      }
    }
    t += dt;
  }
  return out.join("");
}

// Volume of the printed cup and cap, and how long a hobby printer takes for it.
export function printSeconds() {
  const ring = (ro, ri, h) => Math.PI * (ro * ro - ri * ri) * h;
  const cup = ring(CUP.od / 2, CUP.id / 2, CUP.h - CUP.floor) + ring(CUP.od / 2, 0, CUP.floor);
  const cap = ring(CAP.od / 2, 0, CAP.h) + ring(CAP.bootR, 2.6, CAP.boot);
  return { mm3: cup + cap, seconds: (cup + cap) / GUESS.printRate };
}

// Everything at once, for a set of slider values.
export function solve({ offset = 0, sun = 0, filter = true, rLed = null, baud = DESIGN.baud } = {}) {
  const gap = bestGap();
  const pick = ledResistor();
  const r = rLed ?? pick.picked;
  const mA = ledCurrent(r);
  const vf = ledVf(mA);
  const pu = pullUp(gap);
  const share = clearShare(offset, gap);
  const echoE = echoIrradiance(mA, gap) * share;
  const echo = SENS_TYP * echoE;
  const lux = luxOf(sun);
  const stray = SENS_TYP * sunIrradiance(lux) * GUESS.leak * (filter ? GUESS.share.filtered : GUESS.share.clear);
  const volts = rxVolts({ pullUp: pu.picked, echo, stray });
  const back = echoText(DESIGN.text, volts);
  const tx = txVerdict(mA);
  const state = tx.level === "burn" ? "burnt" : readAs(volts.dark).bit === 0 ? "flooded" : back.every((b) => b.lost) ? "dark" : back.some((b) => b.bad || b.lost) ? "garbled" : "ok";
  const word = state === "burnt" ? "" : back.map((b) => b.ch).join("");
  const meter = uartListen(METER_ID, DESIGN.meterBaud, baud);
  const geometry = echoGeometry(gap);
  return { gap, geometry, pick, r, mA, vf, tx, pu, share, echoE, echo, lux, stray, volts, back, word, state, meter, baud, filter, offset, sun };
}
