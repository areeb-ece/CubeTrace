// A random scramble of face turns, for Explore. Pure: the caller supplies the dice
// (random(n) → a whole number 0..n-1), so the page can use crypto and tests can use fixed ones.
import { FACES } from "./moves.js";

const SUFFIX = ["", "'", "2"];
const axisOf = (f) => FACES.indexOf(f) >> 1; // U D, L R, F B share an axis

/**
 * n face turns as notation text. A face never follows itself, and a third turn on an axis
 * that the last two turns shared (R L R) is left out, since it would merge into one turn.
 */
export function scramble(random, n = 20) {
  const out = [];
  while (out.length < n) {
    const f = FACES[random(FACES.length)], a = out.at(-1)?.[0], b = out.at(-2)?.[0];
    if (f === a) continue;
    if (a && b && axisOf(a) === axisOf(b) && axisOf(f) === axisOf(a)) continue;
    out.push(f + SUFFIX[random(SUFFIX.length)]);
  }
  return out.join(" ");
}

/** random(n) from the browser's crypto, without modulo bias. */
export function cryptoRandom(n) {
  const limit = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}
