// Pieces by identity: their names in words, the names of the slots they sit in, and the
// usual cp/co/ep/eo description of a state (for tests and analysis).
import { POS, posIndex } from "./rot.js";
import { IDS, kindOf, NORMALS, stickerHome, occupant } from "./cube.js";

/** Colour words for each home face in the standard holding (white U, green F, red R). */
export const COLOUR_NAME = { U: "white", D: "yellow", F: "green", B: "blue", R: "red", L: "orange" };
const FACE_WORD = { U: "up", D: "down", F: "front", B: "back", R: "right", L: "left" };

/** The faces a grid position touches, U/D first, then F/B, then R/L. */
export function facesAt(p) {
  const [x, y, z] = POS[p], out = [];
  if (y) out.push(y > 0 ? "U" : "D");
  if (z) out.push(z > 0 ? "F" : "B");
  if (x) out.push(x > 0 ? "R" : "L");
  return out;
}
/** "UFR", "FR", "U" … for a grid position. */
export const slotName = (p) => facesAt(p).join("");
/** "up-front-right" … */
export const slotWords = (p) => facesAt(p).map((f) => FACE_WORD[f]).join("-");
/** "the white-green-red corner" style name, from the piece's home faces. */
export const pieceName = (id) => `${facesAt(id).map((f) => COLOUR_NAME[f]).join("-")} ${kindOf(id)}`;

export const CORNERS = IDS.filter((id) => kindOf(id) === "corner");
export const EDGES = IDS.filter((id) => kindOf(id) === "edge");
export const CENTRES = IDS.filter((id) => kindOf(id) === "centre");

// Corner faces in clockwise order seen from outside the corner, starting from U or D.
const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
export function cornerFaces(p) {
  const [ud, fb, rl] = facesAt(p);
  return det3(NORMALS[ud], NORMALS[rl], NORMALS[fb]) < 0 ? [ud, rl, fb] : [ud, fb, rl];
}

/**
 * Twist of the corner at position p: 0 when its U/D-coloured sticker faces U or D, 1 when
 * it sits one step clockwise from there, 2 one step anticlockwise.
 */
export function twistAt(s, p) {
  const at = occupant(s), id = at[p];
  const faces = cornerFaces(p);
  return faces.findIndex((f) => "UD".includes(stickerHome(s, id, f)));
}
/**
 * Flip of the edge at position p: 0 when its reference sticker (U/D colour, or F/B for a
 * middle-layer edge) is on the slot's reference face (U/D, or F/B in the middle layer).
 */
export function flipAt(s, p) {
  const at = occupant(s), id = at[p];
  const ref = (faces) => faces[0];
  const homeRefFace = ref(facesAt(id));
  const slotRef = ref(facesAt(p));
  return stickerHome(s, id, slotRef) === homeRefFace ? 0 : 1;
}

/** cp, co, ep, eo as arrays over CORNERS / EDGES positions (piece at each slot, by index). */
export function describe(s) {
  const at = occupant(s);
  return {
    cp: CORNERS.map((p) => CORNERS.indexOf(at[p])),
    co: CORNERS.map((p) => twistAt(s, p)),
    ep: EDGES.map((p) => EDGES.indexOf(at[p])),
    eo: EDGES.map((p) => flipAt(s, p)),
  };
}

export const posOf = (face) => posIndex(NORMALS[face]);
