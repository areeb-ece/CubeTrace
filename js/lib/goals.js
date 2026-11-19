// What each step is trying to reach, as predicates on a state. Pieces are judged against
// the centres around them, not against fixed positions, so a goal holds in any holding
// and after any whole-cube rotation.
import { POS, posIndex } from "./rot.js";
import { IDS, kindOf, stickerHome, occupant, NORMALS } from "./cube.js";
import { HOLDINGS } from "./roles.js";

const FACES = "UDLRFB";
function centreColours(s) {
  const at = occupant(s), out = {};
  for (const f of FACES) out[f] = stickerHome(s, at[posIndex(NORMALS[f])], f);
  return out;
}
const stickersOf = (s, id) => [...FACES].map((f) => [f, stickerHome(s, id, f)]).filter(([, h]) => h);

/** Every sticker of the piece matches the centre of the face it is on. */
export function pieceSolved(s, id, c = centreColours(s)) {
  return stickersOf(s, id).every(([f, h]) => c[f] === h);
}
/** The piece is in its place, whichever way it is turned. */
export function piecePlaced(s, id, c = centreColours(s)) {
  const now = new Set(stickersOf(s, id).map(([f]) => c[f]));
  return stickersOf(s, id).every(([, h]) => now.has(h));
}
/** The piece's sticker of colour `home` faces the centre of that colour. */
export function colourFacing(s, id, home, c = centreColours(s)) {
  return stickersOf(s, id).some(([f, h]) => h === home && c[f] === home);
}

/** Pieces chosen by where they belong in a holding: pred([x, y, z], kind). */
export const piecesWhere = (holding, pred) => IDS.filter((id) => kindOf(id) !== "centre" && pred(POS[HOLDINGS[holding].pos[id]], kindOf(id)));

const W = (pred) => piecesWhere("whiteUp", pred), Y = (pred) => piecesWhere("yellowUp", pred);
const WHITE_EDGES = W((p, k) => p[1] === 1 && k === "edge");
const WHITE_LAYER = W((p) => p[1] === 1);
const F2L = Y((p) => p[1] < 1);
const LL = Y((p) => p[1] === 1);
const LL_EDGES = Y((p, k) => p[1] === 1 && k === "edge");
const LL_CORNERS = Y((p, k) => p[1] === 1 && k === "corner");
const CROSS = Y((p, k) => p[1] === -1 && k === "edge");
const all = (ids, f) => (s) => { const c = centreColours(s); return ids.every((id) => f(s, id, c)); };
const both = (...fs) => (s) => fs.every((f) => f(s));

/** step goal id → predicate. */
export const GOALS = {
  "white-cross": all(WHITE_EDGES, pieceSolved),
  "white-corners": all(WHITE_LAYER, pieceSolved),
  "second-layer": all(F2L, pieceSolved),
  "yellow-cross": both(all(F2L, pieceSolved), all(LL_EDGES, (s, id, c) => colourFacing(s, id, "D", c))),
  /** a dot gets as far as an L or a line: two yellow edges up */
  "yellow-two": both(all(F2L, pieceSolved), (s) => { const c = centreColours(s); return LL_EDGES.filter((id) => colourFacing(s, id, "D", c)).length >= 2; }),
  "yellow-edges": both(all(F2L, pieceSolved), all(LL_EDGES, pieceSolved)),
  "corners-placed": both(all(F2L, pieceSolved), all(LL_EDGES, pieceSolved), all(LL_CORNERS, piecePlaced)),
  "corner-ufr": (s) => { const at = occupant(s); return colourFacing(s, at[posIndex([1, 1, 1])], "D"); },
  solved: all([...F2L, ...LL], pieceSolved),
  cross: all(CROSS, pieceSolved),
  f2l: all(F2L, pieceSolved),
  "oll-edges": both(all(F2L, pieceSolved), all(LL_EDGES, (s, id, c) => colourFacing(s, id, "D", c))),
  oll: both(all(F2L, pieceSolved), all(LL, (s, id, c) => colourFacing(s, id, "D", c))),
  "pll-corners": both(all(F2L, pieceSolved), all(LL_CORNERS, piecePlaced), all(LL_CORNERS, (s, id, c) => colourFacing(s, id, "D", c))),
};
