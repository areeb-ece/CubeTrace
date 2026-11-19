// Operations on move sequences: inverse, the two mirrors, U adjustments and comparing
// states up to them.
import { inverseMove, reflectMove, MIRROR_LR, MIRROR_FR, move } from "./moves.js";
import { solved, applyMoves, equal, turn, clone, reorient } from "./cube.js";
import { describe } from "./pieces.js";

export const inverse = (moves) => moves.slice().reverse().map(inverseMove);
/** Left ↔ right: the algorithm for the mirror-image case (FR slot → FL slot). */
export const mirrorLR = (moves) => moves.map((m) => reflectMove(m, MIRROR_LR));
/** Front ↔ right, through the FR edge's diagonal plane: maps the FR slot onto itself. */
export const mirrorFR = (moves) => moves.map((m) => reflectMove(m, MIRROR_FR));

export const U = [move("U", 1)];
export const Uk = (k) => { k = ((k % 4) + 4) % 4; return k ? [move("U", k === 2 ? 2 : k === 1 ? 1 : -1)] : []; };

/** Do two sequences have the same effect on a solved cube? */
export const sameEffect = (a, b) => equal(reorient(applyMoves(solved(), a)), reorient(applyMoves(solved(), b)));
export const isIdentity = (moves) => equal(applyMoves(solved(), moves), solved());

/** The case an algorithm solves: a solved cube with the algorithm undone. */
export const caseOf = (alg, start = solved()) => applyMoves(start, inverse(alg));

/** A string that is the same for two states exactly when they are equal. */
export function key(s) {
  const d = describe(reorient(s));
  return `${d.cp}|${d.co}|${d.ep}|${d.eo}`;
}

/** The smallest key of s over U turns applied to it: equal for the same case up to a first U. */
export function keyModU(s, part = key) {
  const t = clone(s);
  let best = null;
  for (let a = 0; a < 4; a++) {
    const k = part(t);
    if (best === null || k < best) best = k;
    turn(t, U[0]);
  }
  return best;
}

/**
 * Key of the case alg solves, modulo U before it and, if `after`, U after it (a solver
 * may finish with a U turn): the cases of alg·U^b for every b, each up to a first U.
 */
export function keyModUAlg(alg, { after = false, part = key, start = solved() } = {}) {
  let best = null;
  for (let b = 0; b < (after ? 4 : 1); b++) {
    const t = caseOf([...alg, ...Uk(b)], start);
    for (let a = 0; a < 4; a++) {
      const k = part(t);
      if (best === null || k < best) best = k;
      turn(t, U[0]);
    }
  }
  return best;
}
