// What the timeline shows about a sequence, as plain data: its chunks (hand-written
// ones win over what structure.js finds), the sentence for each, how the inverse-pair
// brackets stack, and the commutator note.
import { autoChunks, commutator } from "./structure.js";
import { format } from "./notation.js";

/**
 * Chunks covering moves 0..n in order with no gaps: [{ start, end, role, name?, pair?, caption? }].
 * parts (hand-written, from the content) replace the automatic ones; any move they leave
 * out becomes a null chunk, so a typo in the content can't drop a move off the timeline.
 */
export function chunksFor(moves, parts) {
  const n = moves.length;
  if (!parts || !parts.length) return autoChunks(moves);
  const out = [];
  let at = 0;
  for (const p of [...parts].sort((a, b) => a.start - b.start)) {
    const start = Math.max(at, p.start), end = Math.min(n, p.end);
    if (end <= start) continue;
    if (start > at) out.push({ start: at, end: start, role: null });
    out.push({ ...p, start, end, role: p.role ?? null });
    at = end;
  }
  if (at < n) out.push({ start: at, end: n, role: null });
  return out;
}

/** Roles with a band (and a colour); null chunks have none. */
export const BAND_LABEL = { setup: "setup", undo: "undo", trigger: "", insert: "insert" };

const ROLE_CAPTION = {
  setup: "Set up: move pieces where the next part can work on them.",
  undo: "Undo the setup, putting back what it moved.",
  insert: "Insert: carry the piece down into its slot.",
};
/** One short line for each named trigger. */
export const TRIGGER_LINES = {
  "sexy move": "a four-move trigger that many algorithms repeat.",
  sledgehammer: "a four-move trigger that many algorithms use.",
  Sune: "turns corners in the top layer and leaves the two layers below alone.",
  Antisune: "Sune backwards, turning the same corners the other way.",
  insert: "carry the piece down into its slot.",
};

/** The caption for a chunk: the hand-written one, else one made from its role (null: nothing). */
export function captionFor(chunk) {
  if (!chunk) return null;
  if (chunk.caption) return chunk.caption;
  if (chunk.role === "trigger") return TRIGGER_LINES[chunk.name] ? `${chunk.name[0].toUpperCase()}${chunk.name.slice(1)}: ${TRIGGER_LINES[chunk.name]}` : chunk.name || null;
  return ROLE_CAPTION[chunk.role] ?? null;
}

/** The chunk holding move index i (the last chunk when i is the end). */
export const chunkAt = (chunks, i) => chunks.find((c) => c.start <= i && i < c.end) ?? chunks.at(-1) ?? null;

/**
 * Brackets for inverse pairs [[i, j], …] → [{ i, j, level }]. Arcs that overlap (nested
 * or crossing) get different levels, the shorter one lower, so none draws over another.
 */
export function bracketLevels(pairs) {
  const placed = [];
  for (const [i, j] of [...pairs].sort((a, b) => a[1] - a[0] - (b[1] - b[0]) || a[0] - b[0])) {
    const taken = new Set(placed.filter((p) => p.i <= j && i <= p.j).map((p) => p.level));
    let level = 0;
    while (taken.has(level)) level++;
    placed.push({ i, j, level });
  }
  return placed.sort((a, b) => a.i - b.i);
}

/** If the whole sequence is a commutator [X, Y]: { x, y, xMoves, yMoves } (text and moves), else null. */
export function commutatorNote(moves) {
  const c = commutator(moves);
  if (!c) return null;
  const xMoves = moves.slice(0, c.a), yMoves = moves.slice(c.a, c.a + c.b);
  return { x: format(xMoves), y: format(yMoves), xMoves, yMoves };
}
