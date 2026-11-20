// Where a piece's stickers are on the flat net, in a given state. Positions only
// ({ face, row, col }); the views place them on their own layouts. Pure.
import { stickers, stickerHome, occupant, gridOf } from "./cube.js";
import { slotOf } from "./anatomy.js";
import { facesAt } from "./pieces.js";
import { POS, posIndex } from "./rot.js";

/** Every sticker of piece id in state s, as { face, row, col, home }. */
export function cellsOf(s, id) {
  return stickers(s).filter((st) => st.id === id).map(({ face, row, col, home }) => ({ face, row, col, home }));
}

/**
 * The cell of the piece's reference sticker: the one whose colour is the piece's first
 * home face (U or D for corners and edges that have one; the F/B or R/L colour otherwise).
 * It is the sticker whose place says how the piece is turned.
 */
export function refCell(s, id) {
  const ref = facesAt(id)[0], p = s.pos[id];
  for (const face of facesAt(p)) if (stickerHome(s, id, face) === ref) return slotOf(p, face);
  return null; // unreachable for a real state: the reference sticker is always on one of the slot's faces
}

/** Is grid position p in the top layer (the world's up side)? */
export const inTopLayer = (p) => POS[p][1] === 1;

/** The id of the piece under sticker (face, row, col) in state s. */
export const idAt = (s, face, row, col) => occupant(s)[posIndex(gridOf(face, row, col))];

/**
 * Where piece id's reference sticker is through a trace's states: [{ face, row, col, i }],
 * one entry per place it sits in, i the first state it arrives there (so a piece that
 * sits still through a move adds nothing).
 */
export function trail(states, id) {
  const out = [];
  states.forEach((s, i) => {
    const c = refCell(s, id), last = out[out.length - 1];
    if (!last || last.face !== c.face || last.row !== c.row || last.col !== c.col) out.push({ ...c, i });
  });
  return out;
}

const cellsAtMemo = new Map();
/** The net cells of grid position p, { face, row, col } (a slot, whatever piece is in it). */
export function cellsAtPos(p) {
  if (!cellsAtMemo.has(p)) {
    const out = [];
    for (const face of "UDLRFB") for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) if (posIndex(gridOf(face, row, col)) === p) out.push({ face, row, col });
    cellsAtMemo.set(p, out);
  }
  return cellsAtMemo.get(p);
}
