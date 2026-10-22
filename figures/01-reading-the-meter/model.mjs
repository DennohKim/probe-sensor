// The optical read-out of a meter over IEC 62056-21 mode C, as a pure model.
// Every number the figure shows comes from here.

export const LINK = {
  wavelengthNm: 940,
  startBaud: 300,
  dataBits: 7,
  parityBits: 1,
  stopBits: 1,
  reactionS: 0.2,
  usbVolts: 5,
};

export const BAUD_OF = { 0: 300, 1: 600, 2: 1200, 3: 2400, 4: 4800, 5: 9600, 6: 19200 };

export const STX = "\x02";
export const ETX = "\x03";
export const ACK = "\x06";

export const METER = {
  maker: "WPA",
  model: "WM-ULTRA-15",
  speedCode: "5",
  serial: "WP000123",
  totalM3: 1234.567,
  obisVolume: "8-0:1.0.0",
};

export const bitsPerChar = () => 1 + LINK.dataBits + LINK.parityBits + LINK.stopBits;
export const charSeconds = (baud) => bitsPerChar() / baud;

// Start bit 0, seven data bits least significant first, even parity, stop bit 1.
export function frameOf(code) {
  const data = Array.from({ length: LINK.dataBits }, (_, b) => (code >> b) & 1);
  const ones = data.reduce((sum, bit) => sum + bit, 0);
  return [0, ...data, ones % 2, 1];
}

export function bccOf(text) {
  let x = 0;
  for (const ch of text) x ^= ch.charCodeAt(0);
  return x;
}

export const SIGN_ON = "/?!\r\n";
export const IDENT = "/" + METER.maker + METER.speedCode + METER.model + "\r\n";
export const OPTION = ACK + "0" + METER.speedCode + "0\r\n";
export const FAST_BAUD = BAUD_OF[METER.speedCode];
export const TOTAL_TEXT = METER.totalM3.toFixed(3).padStart(10, "0");
export const DATA_LINES = [`0.0.0(${METER.serial})`, `${METER.obisVolume}(${TOTAL_TEXT}*m3)`, "F.F(00000000)", "!"];
const BLOCK = DATA_LINES.map((line) => line + "\r\n").join("") + ETX;
export const BCC = bccOf(BLOCK);
export const READOUT = STX + BLOCK + String.fromCharCode(BCC);

// Each transmission: who sends (tx = phone through the probe LED, rx = meter LED), text, speed, start in real seconds.
export const TALK = {
  wake: [{ dir: "tx", text: SIGN_ON, baud: LINK.startBaud, at: 0 }],
  ident: [{ dir: "rx", text: IDENT, baud: LINK.startBaud, at: LINK.reactionS }],
  option: [{ dir: "tx", text: OPTION, baud: LINK.startBaud, at: 0 }],
  read: [{ dir: "rx", text: READOUT, baud: FAST_BAUD, at: LINK.reactionS }],
};

export const lengthOf = (sends) => Math.max(...sends.map((s) => s.at + s.text.length * charSeconds(s.baud)));

// What is on the light path at real time r: who is sending, which character and bit, and whether the LED is lit.
export function lineAt(sends, r) {
  for (const s of sends) {
    const bit = charSeconds(s.baud) / bitsPerChar();
    const k = Math.floor((r - s.at) / bit);
    if (k < 0 || k >= s.text.length * bitsPerChar()) continue;
    const char = Math.floor(k / bitsPerChar());
    const index = k % bitsPerChar();
    const code = s.text.charCodeAt(char);
    const value = frameOf(code)[index];
    return { dir: s.dir, char, index, code, value, lit: value === 0, baud: s.baud, send: s };
  }
  return null;
}

// Share of the interval [r0, r1] that each LED spends lit, so fast bits blur into a steady glow instead of flickering.
export function glowBetween(sends, r0, r1, samples = 24) {
  const glow = { tx: 0, rx: 0 };
  for (let j = 0; j < samples; j++) {
    const line = lineAt(sends, r0 + ((j + 0.5) / samples) * (r1 - r0));
    if (line && line.lit) glow[line.dir] += 1 / samples;
  }
  return glow;
}

// Characters fully sent by real time r.
export function sentBy(send, r) {
  return Math.max(0, Math.min(send.text.length, Math.floor((r - send.at) / charSeconds(send.baud))));
}

export const show = (text) =>
  [...text].map((ch) => ({ "\r": "␍", "\n": "␊", "\x02": "␂", "\x03": "␃", "\x06": "␆" })[ch] ?? (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) > 126 ? "·" : ch)).join("");

export const hex = (code) => "0x" + code.toString(16).toUpperCase().padStart(2, "0");
