// A DN15 transit-time ultrasonic water meter with a U-shaped sound path, as a pure model.
// Every number the figure shows comes from here. SI units unless a name says otherwise.

// Speed of sound in pure water at atmospheric pressure, Marczak (1997), valid 0–95 °C.
export function soundSpeed(tempC) {
  const t = tempC;
  return 1402.385 + 5.038813 * t - 5.799136e-2 * t ** 2 + 3.287156e-4 * t ** 3 - 1.398845e-6 * t ** 4 + 2.78786e-9 * t ** 5;
}

export const WATER = { tempC: 20 };

export const METER = {
  boreMm: 15,
  pathMm: 60,
  q3M3h: 2.5,
  freqHz: 1e6,
  burstCycles: 3,
  cycleS: 1,
  startTotalM3: 1234.5675,
  obisVolume: "8-0:1.0.0",
};

export const C = soundSpeed(WATER.tempC);
export const BORE_M = METER.boreMm / 1000;
export const LEG_M = BORE_M / 2;
export const PATH_M = METER.pathMm / 1000;
export const AREA_M2 = Math.PI * LEG_M * LEG_M;
export const WAVELENGTH_M = C / METER.freqHz;

export const speedOfFlow = (q3M3h) => q3M3h / 3600 / AREA_M2;
export const V = speedOfFlow(METER.q3M3h);

// Down a leg at c, along the axis with or against the water, up a leg at c (TI SNIA020, eq. 2).
export function flightTimes(v) {
  const legs = (2 * LEG_M) / C;
  const down = legs + PATH_M / (C + v);
  const up = legs + PATH_M / (C - v);
  return { down, up, dt: up - down };
}

export const TIMES = flightTimes(V);

// dt = 2Lv / (c² − v²), solved for v without cancellation.
export function speedFromHeadStart(dt) {
  return (dt * C * C) / (PATH_M + Math.sqrt(PATH_M * PATH_M + dt * dt * C * C));
}

export const SPEED = speedFromHeadStart(TIMES.dt);
export const FLOW_M3S = SPEED * AREA_M2;
export const ADDED_M3 = FLOW_M3S * METER.cycleS;
export const END_TOTAL_M3 = METER.startTotalM3 + ADDED_M3;
export const WATER_MOVES_M = V * TIMES.down;

// The register shows whole litres: three decimals of m³, never rounded up.
export const shownTotal = (m3) => (Math.floor(m3 * 1000 + 1e-9) / 1000).toFixed(3);

// The U path: a leg down, the run along the axis, a leg up. s in metres from the sending transducer.
export const PATH_LEN_M = 2 * LEG_M + PATH_M;

export function pathAt(dir, r, v = V) {
  const along = dir === "down" ? C + v : C - v;
  const t1 = LEG_M / C;
  const t2 = t1 + PATH_M / along;
  if (r <= t1) return Math.max(0, r * C);
  if (r <= t2) return LEG_M + (r - t1) * along;
  return Math.min(PATH_LEN_M + 1, LEG_M + PATH_M + (r - t2) * C);
}

// Where each crest of the burst is on the path at real time r: crest k leaves k periods after the first.
export function crestsAt(dir, r) {
  const period = 1 / METER.freqHz;
  const out = [];
  for (let k = 0; k < METER.burstCycles; k++) {
    const age = r - k * period;
    if (age < 0) continue;
    const s = pathAt(dir, age);
    if (s <= PATH_LEN_M) out.push({ k, s });
  }
  return out;
}

// The received wave as the meter's receiver sees it: silent until the first crest lands, then rings up.
export function received(t, arrival) {
  const u = t - arrival;
  if (u <= 0) return 0;
  const envelope = 1 - Math.exp((-u * METER.freqHz) / 0.9);
  return envelope * Math.sin(2 * Math.PI * METER.freqHz * u);
}

export const us = (s) => s * 1e6;
export const ns = (s) => s * 1e9;
