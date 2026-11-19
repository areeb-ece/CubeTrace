// The 24 rotations of a cube, as 3×3 integer matrices (row-major arrays of 9), and the
// tables that make turning cheap: their products, inverses and what each does to the
// 27 grid positions. Axes: x to the right (R), y up (U), z towards the viewer (F).

/** Quarter turn by +90° (counter-clockwise looking down the axis at the origin). */
const QUARTER = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0], // about x
  [0, 0, 1, 0, 1, 0, -1, 0, 0], // about y
  [0, -1, 0, 1, 0, 0, 0, 0, 1], // about z
];
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a, b) {
  const c = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) c[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return c;
}
export const apply = (m, v) => [0, 1, 2].map((i) => m[i * 3] * v[0] + m[i * 3 + 1] * v[1] + m[i * 3 + 2] * v[2]);
const key = (m) => m.join(",");

/** ROTS[0] is the identity; the rest in the order closure finds them. */
export const ROTS = [I];
{
  const seen = new Set([key(I)]);
  for (let i = 0; i < ROTS.length; i++) for (const q of QUARTER) {
    const m = mul(q, ROTS[i]);
    if (!seen.has(key(m))) { seen.add(key(m)); ROTS.push(m); }
  }
}
const INDEX = new Map(ROTS.map((m, i) => [key(m), i]));
export const rotIndex = (m) => INDEX.get(key(m));

/** MUL[a][b] = index of ROTS[a] · ROTS[b]. */
export const MUL = ROTS.map((a) => ROTS.map((b) => rotIndex(mul(a, b))));
export const INV = ROTS.map((_, a) => MUL[a].indexOf(0));

/** Index of the rotation by q quarter turns (+90° each) about axis 0, 1 or 2. */
export const TURN = [0, 1, 2].map((ax) => [0, 1, 2, 3].map((q) => {
  let m = I;
  for (let i = 0; i < q; i++) m = mul(QUARTER[ax], m);
  return rotIndex(m);
}));

// Grid positions 0..26 ↔ coordinates in {-1, 0, 1}³.
export const posIndex = (v) => (v[0] + 1) * 9 + (v[1] + 1) * 3 + (v[2] + 1);
export const POS = Array.from({ length: 27 }, (_, i) => [Math.floor(i / 9) - 1, (Math.floor(i / 3) % 3) - 1, (i % 3) - 1]);
/** PERM[r][p] = where rotation r takes position p. */
export const PERM = ROTS.map((m) => POS.map((v) => posIndex(apply(m, v))));
