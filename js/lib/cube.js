// A cube state: 26 cubies (8 corners, 12 edges, 6 centres), each named by its home
// position on the grid and carrying where it is now and how it is turned (an index into
// the 24 rotations). A move rotates every cubie in its layers, the same way for faces,
// slices, wide moves and rotations, so centres move too and which colour is on top is
// read from the state, never assumed.
import { POS, PERM, MUL, INV, TURN, posIndex, ROTS, apply as rotate } from "./rot.js";

/** Cubie ids: every grid position but the core (13). */
export const IDS = POS.map((_, i) => i).filter((i) => i !== 13);
export const kindOf = (id) => ["core", "centre", "edge", "corner"][POS[id].filter((v) => v !== 0).length];

export function solved() {
  const pos = new Int8Array(27), ori = new Int8Array(27);
  for (let i = 0; i < 27; i++) pos[i] = i;
  return { pos, ori };
}
export const clone = (s) => ({ pos: s.pos.slice(), ori: s.ori.slice() });

/** Apply one move (from moves.js) to a state, in place. */
export function turn(s, m) {
  if (!m.q) return s;
  const r = TURN[m.axis][m.q];
  for (const id of IDS) {
    const p = s.pos[id];
    if (!m.layers.includes(POS[p][m.axis])) continue;
    s.pos[id] = PERM[r][p];
    s.ori[id] = MUL[r][s.ori[id]];
  }
  return s;
}
/** A new state: s with the moves applied. */
export function applyMoves(s, moves) {
  const t = clone(s);
  for (const m of moves) turn(t, m);
  return t;
}

/** Which cubie sits at each grid position. */
export function occupant(s) {
  const at = new Int8Array(27).fill(-1);
  for (const id of IDS) at[s.pos[id]] = id;
  return at;
}

// Face normals, in the order U D L R F B (as FACES in moves.js).
export const NORMALS = { U: [0, 1, 0], D: [0, -1, 0], L: [-1, 0, 0], R: [1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
const faceOf = (n) => Object.keys(NORMALS).find((f) => NORMALS[f].every((v, i) => v === n[i]));

/**
 * The home face (U D L R F B) of the sticker cubie id shows towards world face `face`,
 * or null if it has no sticker there. Colours follow from home faces (palette.js).
 */
export function stickerHome(s, id, face) {
  const home = rotate(ROTS[INV[s.ori[id]]], NORMALS[face]);
  const h = POS[id];
  const f = faceOf(home);
  return h[0] * home[0] + h[1] * home[1] + h[2] * home[2] === 1 ? f : null;
}

/** The 54 stickers: { face, row, col, id, home } with row 0 at the top of the face as drawn on a net. */
export function stickers(s) {
  const at = occupant(s), out = [];
  for (const face of "UDLRFB") {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const p = posIndex(gridOf(face, row, col));
      const id = at[p];
      out.push({ face, row, col, id, pos: p, home: stickerHome(s, id, face) });
    }
  }
  return out;
}

/**
 * The grid position behind sticker (row, col) of a face, laid out as on the standard
 * net: U seen from above with B at its top, D seen from below with F at its top, and
 * L F R B seen from outside with U at their top.
 */
export function gridOf(face, row, col) {
  const a = col - 1, b = 1 - row; // a: left → right, b: bottom → top
  switch (face) {
    case "U": return [a, 1, -b];
    case "D": return [a, -1, b];
    case "F": return [a, b, 1];
    case "B": return [-a, b, -1];
    case "R": return [1, b, -a];
    case "L": return [-1, b, a];
  }
}

/** The colour (as home face) on each face's centre: which colour is up, in front… */
export function centres(s) {
  const at = occupant(s), out = {};
  for (const f of "UDLRFB") out[f] = stickerHome(s, at[posIndex(NORMALS[f])], f);
  return out;
}

export const equal = (a, b) => IDS.every((id) => a.pos[id] === b.pos[id] && (kindOf(id) === "centre" || a.ori[id] === b.ori[id]));
/** Solved in any orientation of the whole cube. */
export function isSolved(s) {
  const at = occupant(s);
  return stickers(s).every((st) => st.home === centreHome(s, at, st.face));
}
const centreHome = (s, at, face) => stickerHome(s, at[posIndex(NORMALS[face])], face);
