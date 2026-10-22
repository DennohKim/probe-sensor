// The FT232R in the probe's plug, as a pure model: USB packets in, serial bits out, and back.
// Every number the figure shows comes from here.

export const USB = {
  bitRate: 12e6,
  frameS: 1e-3,
  maxPacket: 64,
  syncBits: 8,
  pidBits: 8,
  crcBits: 16,
  eopBits: 3,
  stuffAfter: 6,
};

export const PID = { DATA0: 0xc3, DATA1: 0x4b };

export const CHIP = {
  name: "FT232R",
  outBuffer: 128,
  inBuffer: 256,
  refHz: 48e6,
  baseHz: 3e6,
  fractionSteps: 8,
  latencyS: 0.016,
  status: [0x01, 0x60],
};

export const LINE = { baud: 300, fastBaud: 9600, dataBits: 7, parityBits: 1, stopBits: 1, reactionS: 0.2 };

export const MESSAGE = "/?!\r\n";
export const REPLY = "/WPA5WM-ULTRA-15\r\n";

export const bitsPerChar = () => 1 + LINE.dataBits + LINE.parityBits + LINE.stopBits;
export const charSeconds = (baud) => bitsPerChar() / baud;
export const bitSeconds = (baud) => 1 / baud;

// The baud generator divides 3 MHz (48 MHz / 16) by n + x, with x in eighths.
export const divisorOf = (baud) => Math.round((CHIP.baseHz / baud) * CHIP.fractionSteps) / CHIP.fractionSteps;
export const baudOf = (divisor) => CHIP.baseHz / divisor;

// Start bit 0, seven data bits least significant first, even parity, stop bit 1.
export function frameOf(code) {
  const data = Array.from({ length: LINE.dataBits }, (_, b) => (code >> b) & 1);
  const ones = data.reduce((sum, bit) => sum + bit, 0);
  return [0, ...data, ones % 2, 1];
}

export const codesOf = (text) => [...text].map((ch) => ch.charCodeAt(0));

// CRC-16 of a USB data packet: polynomial 0x8005 reflected, start 0xFFFF, sent inverted, low byte first.
export function crc16usb(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc ^ 0xffff;
}

const lsbFirst = (byte) => Array.from({ length: 8 }, (_, b) => (byte >> b) & 1);

// Bits of one data packet on the wire before NRZI: SYNC, PID, payload, CRC16, with a 0 stuffed after six 1s.
export function packetOf(pid, bytes) {
  const crc = crc16usb(bytes);
  const raw = [...lsbFirst(0x80), ...lsbFirst(pid), ...bytes.flatMap(lsbFirst), ...lsbFirst(crc & 0xff), ...lsbFirst(crc >> 8)];
  let run = 0, stuffed = 0;
  for (const bit of raw) {
    run = bit ? run + 1 : 0;
    if (run === USB.stuffAfter) { stuffed++; run = 0; }
  }
  const bits = raw.length + stuffed + USB.eopBits;
  return { pid, bytes, crc, raw: raw.length, stuffed, bits, seconds: bits / USB.bitRate };
}

export const DIVISOR = divisorOf(LINE.baud);
export const FAST_DIVISOR = divisorOf(LINE.fastBaud);
export const BIT_S = bitSeconds(LINE.baud);
export const CHAR_S = charSeconds(LINE.baud);

export const OUT_PACKET = packetOf(PID.DATA0, codesOf(MESSAGE));
export const IN_PACKET = packetOf(PID.DATA1, [...CHIP.status, REPLY.charCodeAt(0)]);

// One timeline in real seconds, from the first bit of the phone's packet.
export const T = (() => {
  const outEnd = OUT_PACKET.seconds;
  const txStart = outEnd;
  const txEnd = txStart + MESSAGE.length * CHAR_S;
  const rxStart = txEnd + LINE.reactionS;
  const rxEnd = rxStart + CHAR_S;
  const fire = rxEnd + CHIP.latencyS;
  const inEnd = fire + IN_PACKET.seconds;
  return { outEnd, txStart, txEnd, rxStart, rxEnd, fire, inEnd };
})();

// Each step covers one stretch of the timeline; real is that stretch in seconds, or null when no time passes.
export const SPANS = [
  [0, T.outEnd],
  [T.outEnd, T.outEnd],
  [T.txStart, T.txStart + BIT_S],
  [T.txStart + BIT_S, T.txEnd],
  [T.rxStart, T.rxEnd],
  [T.rxEnd, T.fire],
  [T.fire, T.inEnd],
];
export const realOf = (i) => (SPANS[i][1] > SPANS[i][0] ? SPANS[i][1] - SPANS[i][0] : null);
export const timeAt = (i, p) => (i < 0 ? 0 : SPANS[i][0] + (SPANS[i][1] - SPANS[i][0]) * p);

// What the TX or RX line carries at real time r: letter, bit and level. Light on = 0, so the line rests at 1.
export function lineAt(r) {
  const at = (start, text, dir) => {
    const k = Math.floor((r - start) / BIT_S);
    if (k < 0 || k >= text.length * bitsPerChar()) return null;
    const char = Math.floor(k / bitsPerChar());
    const index = k % bitsPerChar();
    const code = text.charCodeAt(char);
    const into = (r - start) / BIT_S - k;
    return { dir, char, index, code, value: frameOf(code)[index], into };
  };
  return at(T.txStart, MESSAGE, "tx") || at(T.rxStart, REPLY.slice(0, 1), "rx");
}

// The baud counter: 3 MHz ticks counted up to the divisor, once per bit, from the first bit sent.
export const countAt = (r) => (r < T.txStart ? 0 : Math.floor(((r - T.txStart) * CHIP.baseHz) % DIVISOR));
export const turnsAt = (r) => (r < T.txStart ? 0 : (r - T.txStart) / BIT_S);

export const framesAt = (r) => Math.floor(r / USB.frameS);
export const lettersSent = (r) => Math.max(0, Math.min(MESSAGE.length, Math.floor((r - T.txStart) / CHAR_S)));

// How much the line can carry in the time USB needs for one packet, and the other way round.
export const BITS_PER_FRAME = LINE.baud * USB.frameS;
export const SLOWER = (MESSAGE.length * CHAR_S) / OUT_PACKET.seconds;
export const FULL_PACKET_LINE_S = USB.maxPacket * CHAR_S;
export const DRAWER_DRAIN_S = CHIP.outBuffer * CHAR_S;
export const LATENCY_RATE = (USB.maxPacket - CHIP.status.length) / CHIP.latencyS;

export const show = (text) =>
  [...text].map((ch) => ({ "\r": "␍", "\n": "␊" })[ch] ?? ch).join("");

export const hex = (code) => code.toString(16).toUpperCase().padStart(2, "0");

export const fmtTime = (s) =>
  s === 0 ? "0 s" : s < 1e-3 ? (s * 1e6).toFixed(2) + " µs" : s < 1 ? (s * 1e3).toFixed(s < 0.01 ? 2 : 1) + " ms" : s.toFixed(3) + " s";
