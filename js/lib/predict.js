// Predict mode's logic, without the page: how the algorithm is cut into the steps the
// learner predicts, which piece to ask about, and whether an answer is right. A slot is a
// grid position (rot.js): the learner names the place, not the piece, so a click on a
// sticker means the position of its cubie before the move. Pure.
import { IDS, kindOf } from "./cube.js";
import { pieceName, slotWords } from "./pieces.js";

/** The runs of moves to predict, [from, to] move indices: one move each, or one chunk each. */
export function units(chunks, n, by = "move") {
  if (!n) return [];
  if (by === "chunk") return chunks.length ? chunks.map((c) => [c.start, c.end]) : [[0, n]];
  return Array.from({ length: n }, (_, i) => [i, i + 1]);
}

/** The pieces whose place differs between two states. */
export const movers = (a, b) => IDS.filter((id) => a.pos[id] !== b.pos[id]);

/**
 * The piece to ask about for the run from state a to state b, or null when nothing
 * moves. A focus piece (roleOf, from roles.js) that moves is the first choice, then any
 * piece that moves; centres only when nothing else does. `salt` (the run's number) varies
 * the pick from run to run without a dice roll.
 */
export function pickTarget(a, b, roleOf, salt = 0) {
  const moved = movers(a, b);
  const pools = [moved.filter((id) => roleOf[id] === "focus" && kindOf(id) !== "centre"), moved.filter((id) => kindOf(id) !== "centre"), moved];
  const pool = pools.find((p) => p.length);
  return pool ? pool[salt % pool.length] : null;
}

/** The slot a click on a sticker of piece `id` names: where that piece is now. */
export const slotOfPiece = (state, id) => state.pos[id];

/** Was the learner's slot where the target went? → { right, answer } (answer: the grid position). */
export function judge(after, target, chosen) {
  const answer = after.pos[target];
  return { right: chosen === answer, answer };
}

/** The sentence the live region says. */
export const verdict = (right, target, answer) => `${right ? "Right" : "Not quite"}: the ${pieceName(target)} went to ${slotWords(answer)}.`;

/** The question, in words. */
export const question = (target) => `Where will the ${pieceName(target)} go?`;
