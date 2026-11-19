// Every move is an axis, the layers it turns on that axis, and a number of quarter turns.
// Face turns, slices, wide moves and whole-cube rotations are all the same operation.
// Directions are the WCA's: a face turns clockwise as seen from outside that face;
// M follows L, E follows D, S follows F; x follows R, y follows U, z follows F.

const ALL = [-1, 0, 1];
/** name → [axis, layers, sign of its rotation (+1 = +90° about the axis)] */
export const BASE = {
  R: [0, [1], -1], L: [0, [-1], 1], U: [1, [1], -1], D: [1, [-1], 1], F: [2, [1], -1], B: [2, [-1], 1],
  M: [0, [0], 1], E: [1, [0], 1], S: [2, [0], -1],
  x: [0, ALL, -1], y: [1, ALL, -1], z: [2, ALL, -1],
  r: [0, [0, 1], -1], l: [0, [-1, 0], 1], u: [1, [0, 1], -1], d: [1, [-1, 0], 1], f: [2, [0, 1], -1], b: [2, [-1, 0], 1],
};
export const FACES = "UDLRFB";
export const WIDE = "udlrfb";

/**
 * A move. name: a key of BASE; amount: 1, 2, -1 (prime) or -2 (written 2');
 * w: a wide move written as Rw rather than r.
 */
export function move(name, amount = 1, w = false) {
  const [axis, layers, sign] = BASE[name];
  return { name, amount, w: w && WIDE.includes(name), axis, layers, q: (((sign * amount) % 4) + 4) % 4 };
}

export function moveText(m) {
  const n = m.w ? m.name.toUpperCase() + "w" : m.name;
  return n + ({ 1: "", 2: "2", "-1": "'", "-2": "2'" })[m.amount];
}

const sameLayers = (a, b) => a.length === b.length && a.every((v) => b.includes(v));

/** The move with this axis, layer set and quarter turns (1..3), named as standard notation does. */
export function moveFrom(axis, layers, q, w = false) {
  q = ((q % 4) + 4) % 4;
  if (!q) return null;
  for (const [name, [ax, ls, sign]] of Object.entries(BASE)) {
    if (ax !== axis || !sameLayers(ls, layers)) continue;
    const amount = q === 2 ? 2 : q === (sign > 0 ? 1 : 3) ? 1 : -1;
    return move(name, amount, w);
  }
  return null; // a layer set no single move turns (e.g. both outer faces)
}

export const inverseMove = (m) => move(m.name, -m.amount, m.w);
export const sameMove = (a, b) => a.axis === b.axis && sameLayers(a.layers, b.layers) && a.q === b.q;
/** Turns the same layers on the same axis (so the two can't be told apart by order). */
export const sameLayer = (a, b) => a.axis === b.axis && sameLayers(a.layers, b.layers);

/**
 * Reflect a move through a mirror plane. P maps each axis to [axis', s]: e.g. the M plane
 * sends x to -x. Conjugating a rotation by a reflection reverses its sense, so
 * θ' = -s·θ, and layer l lands on s·l.
 */
export function reflectMove(m, P) {
  const [axis, s] = P[m.axis];
  const r = moveFrom(axis, m.layers.map((l) => s * l), -s * (m.q === 3 ? -1 : m.q === 2 ? 2 : 1), m.w);
  // keep a half turn written 2' as 2' (both are the same turn)
  if (m.amount === -2 && r.amount === 2) return move(r.name, -2, r.w);
  return r;
}
/** Left ↔ right: through the M plane. */
export const MIRROR_LR = [[0, -1], [1, 1], [2, 1]];
/** Front ↔ right: through the plane holding the U–D axis and the FR edge (x ↔ z). */
export const MIRROR_FR = [[2, 1], [1, 1], [0, 1]];
