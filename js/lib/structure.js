// Algorithms as structure, not strings (PLAN.md section 5): which moves undo which,
// conjugates X Y X', commutators [X, Y] = X Y X' Y', named triggers, and the chunks the
// timeline shows. Hand-written chunks in the content override what is found here.
import { inverseMove, sameMove, sameLayer } from "./moves.js";
import { parseMoves } from "./notation.js";
import { inverse, mirrorLR, mirrorFR } from "./algebra.js";
import { solved, applyMoves, IDS } from "./cube.js";

const seqEq = (a, b) => a.length === b.length && a.every((m, i) => sameMove(m, b[i]));

/**
 * Inverse pairs: move i pairs with the nearest later j that undoes it, with nothing in
 * between turning the same layer. Each move pairs at most once. → [[i, j], …]
 */
export function inversePairs(moves) {
  const used = new Set(), out = [];
  for (let i = 0; i < moves.length; i++) {
    if (used.has(i)) continue;
    const want = inverseMove(moves[i]);
    for (let j = i + 1; j < moves.length; j++) {
      if (sameLayer(moves[j], moves[i])) {
        if (!used.has(j) && sameMove(moves[j], want)) { out.push([i, j]); used.add(i); used.add(j); }
        break;
      }
    }
  }
  return out;
}

/** The longest setup X with moves = X Y X' (Y not empty) → { k } (X is moves[0..k)), or null. */
export function conjugate(moves) {
  const n = moves.length;
  for (let k = Math.floor((n - 1) / 2); k >= 1; k--) {
    if (seqEq(moves.slice(n - k), inverse(moves.slice(0, k)))) return { k };
  }
  return null;
}

/** moves = X Y X' Y' → { a, b } (lengths of X and Y), or null. */
export function commutator(moves) {
  const n = moves.length;
  for (let a = 1; 2 * a < n; a++) {
    const b = (n - 2 * a) / 2;
    if (!Number.isInteger(b) || b < 1) continue;
    const X = moves.slice(0, a), Y = moves.slice(a, a + b);
    if (seqEq(moves.slice(a + b, 2 * a + b), inverse(X)) && seqEq(moves.slice(2 * a + b), inverse(Y))) return { a, b };
  }
  return null;
}

/** Named triggers and their mirrors. kind: "trigger" or "insert". */
const BASE_TRIGGERS = [
  ["sexy move", "R U R' U'", "trigger"],
  ["sledgehammer", "R' F R F'", "trigger"],
  ["Sune", "R U R' U R U2 R'", "trigger"],
  ["Antisune", "R U2 R' U' R U' R'", "trigger"],
  ["insert", "R U R'", "insert"],
  ["insert", "R U' R'", "insert"],
  ["insert", "F' U' F", "insert"],
  ["insert", "F' U F", "insert"],
];
export const TRIGGERS = (() => {
  const out = [];
  const add = (name, moves, kind) => { if (!out.some((t) => seqEq(t.moves, moves))) out.push({ name, moves, kind }); };
  for (const [name, text, kind] of BASE_TRIGGERS) {
    const m = parseMoves(text);
    add(name, m, kind);
    add(name, mirrorLR(m), kind);
    add(name, mirrorFR(m), kind);
    add(name, mirrorLR(mirrorFR(m)), kind);
  }
  return out.sort((a, b) => b.moves.length - a.moves.length);
})();

/** Greedy, longest first: [{ start, end, name, kind }] for every trigger found. */
export function findTriggers(moves, from = 0, to = moves.length) {
  const out = [];
  for (let i = from; i < to;) {
    const t = TRIGGERS.find((t) => i + t.moves.length <= to && seqEq(moves.slice(i, i + t.moves.length), t.moves));
    if (t) { out.push({ start: i, end: i + t.moves.length, name: t.name, kind: t.kind }); i += t.moves.length; }
    else i++;
  }
  return out;
}

/**
 * Chunks for the timeline: [{ start, end, role, name? }] covering the moves in order.
 * role: "setup" | "undo" | "trigger" | "insert" | null. A conjugate's setup and undo
 * share a pair number so they take one colour.
 */
export function autoChunks(moves) {
  const out = [];
  const fill = (from, to) => {
    let i = from;
    for (const t of findTriggers(moves, from, to)) {
      if (t.start > i) out.push({ start: i, end: t.start, role: null });
      out.push({ start: t.start, end: t.end, role: t.kind, name: t.name });
      i = t.end;
    }
    if (i < to) out.push({ start: i, end: to, role: null });
  };
  // a conjugate whose middle isn't itself one trigger (else the trigger reads better)
  const c = conjugate(moves);
  if (c && !(findTriggers(moves).length === 1 && findTriggers(moves)[0].end - findTriggers(moves)[0].start === moves.length)) {
    out.push({ start: 0, end: c.k, role: "setup", pair: 0 });
    fill(c.k, moves.length - c.k);
    out.push({ start: moves.length - c.k, end: moves.length, role: "undo", pair: 0 });
  } else fill(0, moves.length);
  return out;
}

/** Positions whose piece a sequence moves or turns (from solved). */
export function support(moves) {
  const s = applyMoves(solved(), moves), out = new Set();
  for (const id of IDS) if (s.pos[id] !== id || s.ori[id] !== 0) out.add(id);
  return out;
}
/** For [X, Y]: the pieces both X and Y move, where the commutator does its work. */
export function overlap(X, Y) {
  const a = support(X), b = support(Y);
  return [...a].filter((id) => b.has(id));
}
