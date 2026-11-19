// Every duration the page uses, in one place. CSS durations come from the shared
// tokens; JS reads them here so the Animations switch and reduced motion (which zero
// --dur-3) reach the cube with no extra code path.
import { autoChunks } from "./lib/structure.js";

/** A turn lasts this many times --dur-3 at 1×. */
export const TURN_FACTOR = 2;
/** With motion off, playing advances one move per this long (ms at 1×): long enough to read the guides. */
export const DWELL = 700;
/** Typing in the moves box waits this long before it is read. */
export const TYPING_DEBOUNCE = 150;
/** The live region is cleared this long before a sentence goes in, so the same sentence is read twice. */
export const ANNOUNCE_GAP = 40;

/** A turn's length in ms for a --dur-3 of durMs; 0 means "don't animate". */
export const turnMsFor = (durMs, speed) => (durMs > 0 ? (durMs * TURN_FACTOR) / speed : 0);
export const dwellMs = (speed) => DWELL / speed;

/** A token's duration in ms ("180ms" or ".2s"), or 0. */
export function tokenMs(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith("ms") ? n : n * 1000) : 0;
}
export const turnMs = (speed = 1) => turnMsFor(tokenMs("--dur-3"), speed);

export const ease = (u) => u * u * (3 - 2 * u);

/** Calls step(eased, linear) every frame for ms, then done(). Returns a cancel function (done is not called). */
export function tween(ms, step, done) {
  let raf = 0;
  const t0 = performance.now();
  const frame = (now) => {
    const u = Math.min(1, (now - t0) / ms);
    if (u >= 1) { raf = 0; done(); return; }
    step(ease(u), u);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
}

/**
 * The pause rule: playback stops at every chunk boundary, so a sequence is stepped
 * through a chunk at a time. → sorted indices 0..n that include every chunk start and end.
 */
export function boundaries(chunks, n) {
  const set = new Set([0, n]);
  for (const c of chunks) { set.add(c.start); set.add(c.end); }
  return [...set].filter((i) => i >= 0 && i <= n).sort((a, b) => a - b);
}
export const boundariesOf = (moves) => boundaries(autoChunks(moves), moves.length);
/** The first stop after index i (or the last one). */
export const nextStop = (stops, i) => stops.find((s) => s > i) ?? stops[stops.length - 1];
/** The last stop before index i (or the first one). */
export const prevStop = (stops, i) => [...stops].reverse().find((s) => s < i) ?? stops[0];
