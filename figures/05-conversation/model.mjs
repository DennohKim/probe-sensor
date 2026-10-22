// The whole mode C conversation as two punched tapes. Built on figure 1's protocol model, so both figures agree.
import { LINK, FAST_BAUD, SIGN_ON, IDENT, OPTION, READOUT, BCC, TALK, frameOf, charSeconds, lengthOf, lineAt } from "../01-reading-the-meter/model.mjs";

// Each sender's messages, back to back on its own tape, in the order they go out.
export const TAPE = {
  tx: SIGN_ON + OPTION,
  rx: IDENT + READOUT,
};

// One entry per step: which transmissions play, and the slice of real time the step covers.
export const PHASES = [
  { talk: TALK.wake, from: 0, to: lengthOf(TALK.wake) },
  { talk: TALK.ident, from: 0, to: lengthOf(TALK.ident) },
  { talk: TALK.option, from: 0, to: lengthOf(TALK.option) },
  { talk: TALK.read, from: 0, to: LINK.reactionS, gears: true },
  { talk: TALK.read, from: LINK.reactionS, to: lengthOf(TALK.read) },
  { check: "parity" },
  { check: "bcc" },
];
export const realOf = (phase) => (phase.talk ? phase.to - phase.from : null);

// Where each message starts on its sender's tape, in bit positions.
const OFFSET = { [SIGN_ON]: 0, [OPTION]: SIGN_ON.length * 10, [IDENT]: 0, [READOUT]: IDENT.length * 10 };

// Bit positions each tape has moved past the lamp at step i, progress p (a fraction, so the tape glides).
export function bitsAt(dir, i, p) {
  let moved = 0;
  PHASES.forEach((phase, k) => {
    if (!phase.talk || k > i) return;
    const r = k < i ? phase.to : phase.from + p * (phase.to - phase.from);
    for (const s of phase.talk) {
      if (s.dir !== dir) continue;
      const bits = Math.min(s.text.length * 10, Math.max(0, ((r - s.at) / charSeconds(s.baud)) * 10));
      moved = Math.max(moved, OFFSET[s.text] + Math.round(bits * 1e6) / 1e6);
    }
  });
  return moved;
}

// Positions per real second for a step's sender, to blur the tape when it races.
export function speedAt(i, p) {
  const phase = PHASES[i];
  if (!phase || !phase.talk || p >= 1) return { tx: 0, rx: 0 };
  const r = phase.from + p * (phase.to - phase.from);
  const out = { tx: 0, rx: 0 };
  for (const s of phase.talk) if (r >= s.at && r < s.at + s.text.length * charSeconds(s.baud)) out[s.dir] = s.baud;
  return out;
}

// The "let me break it" flip: one bit of one letter of the readout, punched wrong.
export const BREAK = { index: READOUT.length - 2, bit: 1 };
export const BREAK_AT = IDENT.length + BREAK.index;

// The frame as it lands at the phone: the meter's frame, with the broken bit flipped when broken is on.
export function landed(code, broken, at) {
  const bits = frameOf(code);
  if (broken && at === BREAK_AT) bits[1 + BREAK.bit] ^= 1;
  return bits;
}
// The bit in the gate at real time r of a step's talk, as the phone or meter sees it (the broken hole included).
export function gateAt(talk, r, broken) {
  const line = lineAt(talk, r);
  if (!line) return null;
  const at = OFFSET[line.send.text] / 10 + line.char;
  const bits = line.dir === "rx" ? landed(line.code, broken, at) : frameOf(line.code);
  return { ...line, at, bits, value: bits[line.index], lit: bits[line.index] === 0 };
}

export const dataOf = (bits) => bits.slice(1, 8).reduce((sum, bit, b) => sum + (bit << b), 0);
export const onesOf = (bits) => bits.slice(1, 9).reduce((sum, bit) => sum + bit, 0);
export const parityOk = (bits) => onesOf(bits) % 2 === 0;

// What the phone checks over the readout: parity per letter, then the XOR of every letter after STX up to ETX.
export function checks(broken) {
  const letters = [...READOUT].map((ch, k) => landed(ch.charCodeAt(0), broken, IDENT.length + k));
  const bad = letters.map((bits, k) => (parityOk(bits) ? -1 : k)).filter((k) => k >= 0);
  const xors = [0];
  for (let k = 1; k < READOUT.length - 1; k++) xors.push(xors[k - 1] ^ dataOf(letters[k]));
  const got = dataOf(letters[READOUT.length - 1]);
  return { letters, bad, xors, sum: xors[xors.length - 1], got, match: xors[xors.length - 1] === got && bad.length === 0 };
}

// The same readout, timed at both speeds: the fact this figure proves.
export const READ_SLOW = (READOUT.length * 10) / LINK.startBaud;
export const READ_FAST = (READOUT.length * 10) / FAST_BAUD;
export const SPEEDUP = FAST_BAUD / LINK.startBaud;
export const binary7 = (value) => value.toString(2).padStart(7, "0");
export const BCC_SUM = BCC;
