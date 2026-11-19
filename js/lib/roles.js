// Sticker roles (PLAN.md section 6): what each piece is for in a step. Roles come from
// predicates on where a piece belongs in the step's holding (the solved cube as that step
// holds it), so a step's roles apply to any state, scrambles included.
//   focus     the pieces this step or case is about
//   kept      solved pieces the algorithm must give back
//   top-only  only the up-colour sticker matters ("is yellow facing up?")
//   ignored   pieces that don't matter yet
//   centre    centres: always in full colour, they say which face is which
import { POS } from "./rot.js";
import { IDS, kindOf, solved, applyMoves } from "./cube.js";
import { parseMoves } from "./notation.js";

/** The solved cube in each holding. */
export const HOLDINGS = {
  whiteUp: solved(),
  yellowUp: applyMoves(solved(), parseMoves("z2")), // beginner steps 3–7 and CFOP: green stays in front
};

const top = (p) => p[1] === 1, mid = (p) => p[1] === 0, bottom = (p) => p[1] === -1;
const FR_CORNER = (p) => p[0] === 1 && p[1] === -1 && p[2] === 1;
const FR_EDGE = (p) => p[0] === 1 && p[1] === 0 && p[2] === 1;
const FL_CORNER = (p) => p[0] === -1 && p[1] === -1 && p[2] === 1;
const FL_EDGE = (p) => p[0] === -1 && p[1] === 0 && p[2] === 1;

/** spec(where the piece belongs, its kind) → role, with the holding it is read in. */
export const ROLE_SETS = {
  all: { holding: "whiteUp", spec: () => "focus" },
  "white-cross": { holding: "whiteUp", spec: (p, k) => (k === "edge" && top(p) ? "focus" : "ignored") },
  "white-corners": { holding: "whiteUp", spec: (p, k) => (top(p) ? (k === "corner" ? "focus" : "kept") : "ignored") },
  "second-layer": { holding: "yellowUp", spec: (p) => (bottom(p) ? "kept" : mid(p) ? "focus" : "ignored") },
  "yellow-cross": { holding: "yellowUp", spec: (p, k) => (!top(p) ? "kept" : k === "edge" ? "top-only" : "ignored") },
  "yellow-edges": { holding: "yellowUp", spec: (p, k) => (!top(p) ? "kept" : k === "edge" ? "focus" : "ignored") },
  "yellow-corners": { holding: "yellowUp", spec: (p, k) => (!top(p) ? "kept" : k === "corner" ? "focus" : "kept") },
  cross: { holding: "yellowUp", spec: (p, k) => (k === "edge" && bottom(p) ? "focus" : "ignored") },
  f2l: { holding: "yellowUp", spec: (p) => (FR_CORNER(p) || FR_EDGE(p) ? "focus" : top(p) ? "ignored" : "kept") },
  "f2l-left": { holding: "yellowUp", spec: (p) => (FL_CORNER(p) || FL_EDGE(p) ? "focus" : top(p) ? "ignored" : "kept") },
  oll: { holding: "yellowUp", spec: (p) => (top(p) ? "top-only" : "kept") },
  pll: { holding: "yellowUp", spec: (p) => (top(p) ? "focus" : "kept") },
};

/** Role of every cubie id, as an array indexed by id (centres: "centre"). */
export function roles(name) {
  const set = ROLE_SETS[name];
  if (!set) throw new Error(`No role set "${name}"`);
  const ref = HOLDINGS[set.holding], out = [];
  for (const id of IDS) out[id] = kindOf(id) === "centre" ? "centre" : set.spec(POS[ref.pos[id]], kindOf(id));
  return out;
}

/** The home face (identity) shown up in a holding: which colour a top-only sticker keeps. */
export function upColour(name) {
  return ROLE_SETS[name].holding === "yellowUp" ? "D" : "U";
}

/**
 * Kept pieces away from home relative to `start`: { displaced: Set of ids, holes: positions
 * they left empty of a kept piece }. A ghost is drawn in each hole.
 */
export function displaced(roleOf, start, now) {
  const ids = IDS.filter((id) => roleOf[id] === "kept" && (start.pos[id] !== now.pos[id] || start.ori[id] !== now.ori[id]) && kindOf(id) !== "centre");
  return { displaced: new Set(ids), holes: ids.map((id) => ({ id, pos: start.pos[id], ori: start.ori[id] })) };
}
