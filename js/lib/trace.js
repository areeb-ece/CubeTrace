// What moves did: per move, which pieces went where and how their twist or flip changed;
// for a whole sequence, the net change as cycles of positions.
import { IDS, kindOf, clone, turn } from "./cube.js";
import { twistAt, flipAt } from "./pieces.js";
import { POS } from "./rot.js";

/** One piece's change: { id, from, to, twist } (twist: corners 0/1/2, edges 0/1, after − before). */
function diff(a, b, ids = IDS) {
  const out = [];
  for (const id of ids) {
    const k = kindOf(id);
    if (k === "centre") { if (a.pos[id] !== b.pos[id]) out.push({ id, from: a.pos[id], to: b.pos[id], twist: 0 }); continue; }
    const tw = k === "corner" ? (twistAt(b, b.pos[id]) - twistAt(a, a.pos[id]) + 3) % 3 : (flipAt(b, b.pos[id]) - flipAt(a, a.pos[id]) + 2) % 2;
    if (a.pos[id] !== b.pos[id] || tw) out.push({ id, from: a.pos[id], to: b.pos[id], twist: tw });
  }
  return out;
}

/**
 * Play moves from start. Returns states[0..n] (states[i] is before move i) and steps[i],
 * the pieces move i changed.
 */
export function trace(start, moves) {
  const states = [clone(start)], steps = [];
  let s = clone(start);
  for (const m of moves) {
    const before = clone(s);
    turn(s, m);
    states.push(clone(s));
    steps.push(diff(before, s));
  }
  return { states, steps };
}

/**
 * The net change from a to b: the pieces that differ, grouped into cycles of positions
 * (a piece's position in a → its position in b), plus twists of pieces that stayed.
 */
export function netChange(a, b) {
  const changed = diff(a, b);
  const byFrom = new Map(changed.map((c) => [c.from, c]));
  const cycles = [], seen = new Set();
  for (const c of changed) {
    if (c.from === c.to || seen.has(c.from)) continue;
    const cyc = [];
    let p = c.from;
    while (!seen.has(p) && byFrom.has(p)) { seen.add(p); cyc.push(p); p = byFrom.get(p).to; }
    cycles.push(cyc);
  }
  return { changed, cycles, twists: changed.filter((c) => c.from === c.to && c.twist) };
}

/**
 * What a whole sequence does to the top layer, from state a to b: the cycles that stay in
 * it ({ kind, ps }: positions, each piece going to the next, the last to the first) and
 * the twisted corners and flipped edges ({ pos, kind, twist }: pos is where the piece was,
 * twist 1 or 2 thirds clockwise for a corner, 1 for an edge). Cycles and pieces that leave
 * the layer are left out: they belong to the layers below.
 */
export function topLayerChange(a, b) {
  const { changed, cycles } = netChange(a, b), top = (p) => POS[p][1] === 1;
  return {
    cycles: cycles.filter((c) => c.every(top)).map((ps) => ({ kind: kindOf(ps[0]), ps })),
    marks: changed.filter((c) => c.twist && top(c.from) && top(c.to)).map((c) => ({ pos: c.from, kind: kindOf(c.id), twist: c.twist })),
  };
}
