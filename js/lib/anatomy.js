// What a turn does on the flat net: which rim stickers ride to which faces, and which
// corners and edges swap places on the turning face. Positions only (face, row, col as
// on the net), so they hold in any state. Pure.
import { solved, applyMoves, IDS, NORMALS, stickerHome, gridOf, kindOf } from "./cube.js";
import { POS, posIndex } from "./rot.js";
import { move } from "./moves.js";
import { netChange } from "./trace.js";

const FACES = "UDLRFB";
// (grid position, face) → the net position of that sticker
const SLOT = new Map();
for (const face of FACES) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) SLOT.set(posIndex(gridOf(face, row, col)) + face, { face, row, col });
const slotOf = (p, face) => SLOT.get(p + face);
const faceAxis = (face) => NORMALS[face].findIndex((v) => v);

/**
 * For a face or slice move (not wide, not a rotation): the 12 rim stickers it carries as
 * four triplets { from: [{ face, row, col } ×3], to: [… ×3] }; to[k] is where from[k]
 * goes. Stickers on the turning face itself are not rim. Others: null.
 */
export function rimMap(m) {
  if (!"UDLRFBMES".includes(m.name)) return null;
  const s = applyMoves(solved(), [m]), byFace = {};
  for (const id of IDS) {
    if (!m.layers.includes(POS[id][m.axis])) continue;
    for (const f of FACES) {
      if (!POS[id][faceAxis(f)] || POS[id][faceAxis(f)] !== NORMALS[f][faceAxis(f)]) continue; // no sticker here at rest
      if (faceAxis(f) === m.axis) continue;
      const f2 = FACES.split("").find((g) => stickerHome(s, id, g) === f);
      (byFace[f] ||= []).push({ from: slotOf(id, f), to: slotOf(s.pos[id], f2) });
    }
  }
  return FACES.split("").filter((f) => byFace[f]).map((f) => {
    const pairs = byFace[f].sort((a, b) => a.from.row - b.from.row || a.from.col - b.from.col);
    return { from: pairs.map((p) => p.from), to: pairs.map((p) => p.to) };
  });
}

/**
 * For a face turn: the 4-cycle of corners and the 4-cycle of edges it makes, as net
 * positions on the turning face in the order the pieces travel (each goes to the next,
 * the last to the first). half: true for a half turn, where each piece really goes to the
 * opposite one (the cycle order is the quarter turn's). Slices, wide moves, rotations: null.
 */
export function cycles(m) {
  if (!"UDLRFB".includes(m.name) || m.w) return null;
  const quarter = move(m.name, m.amount === -1 ? -1 : 1);
  const { cycles: cs } = netChange(solved(), applyMoves(solved(), [quarter]));
  const on = (kind) => cs.find((c) => kindOf(c[0]) === kind).map((p) => slotOf(p, m.name));
  return { corners: on("corner"), edges: on("edge"), half: m.q === 2 };
}
