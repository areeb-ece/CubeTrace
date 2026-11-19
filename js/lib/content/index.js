// Puts the content together: methods → steps → cases, each case with its parsed
// algorithm, its parts as move ranges, and the state it starts from (the step's holding
// with the algorithm undone, so a case can never disagree with its algorithm).
import { parse, format } from "../notation.js";
import { caseOf, mirrorLR, mirrorFR, keyModUAlg } from "../algebra.js";
import { HOLDINGS } from "../roles.js";
import { POS } from "../rot.js";
import { IDS, kindOf, stickerHome, reorient } from "../cube.js";
import { posIndex } from "../rot.js";
import { twistAt, flipAt } from "../pieces.js";
import { BEGINNER } from "./beginner.js";
import { CROSS, CFOP_STEPS, TWO_LOOK_PARTS } from "./cfop.js";
import { F2L, F2L_CONCEPTS } from "./f2l.js";
import { OLL, OLL_GROUPS, OCLL_NAMES, OLL_2LOOK_EDGES } from "./oll.js";
import { PLL, PLL_2LOOK } from "./pll.js";

/** A case from parts or a plain algorithm: { alg, moves, parts: [{ start, end, role, caption, pair }] }. */
function build(c, holding) {
  const parts = c.parts || TWO_LOOK_PARTS[c.alg] || null;
  const text = parts ? parts.map((x) => x.moves).join(" ") : c.alg;
  const moves = parse(text).moves;
  let at = 0;
  const ranges = parts && parts.map((x) => {
    const n = parse(x.moves).moves.length;
    const r = { start: at, end: at + n, role: x.role ?? null, caption: x.caption || "", ...(x.pair !== undefined ? { pair: x.pair } : {}) };
    at += n;
    return r;
  });
  // `from`: the case is where another algorithm's case leaves off (a dot only reaches an
  // L or a line; one corner can't be twisted on its own)
  const start = c.from ? caseOf(parse(c.from).moves, HOLDINGS[holding]) : caseOf(moves, HOLDINGS[holding]);
  return { ...c, alg: format(moves), moves, parts: ranges, start };
}

// F2L: which of five groups a case is in, read off its start state.
const PAIR = IDS.filter((id) => { const p = POS[HOLDINGS.yellowUp.pos[id]]; return kindOf(id) !== "centre" && p[0] === 1 && p[2] === 1 && p[1] < 1; });
export const F2L_GROUPS = [
  { id: "up-white-up", name: "Corner on top, white facing up", short: "White up" },
  { id: "up-white-side", name: "Corner on top, white on the side", short: "White on the side" },
  { id: "corner-slot", name: "Corner in the slot, edge on top", short: "Corner in slot" },
  { id: "edge-slot", name: "Edge in the slot, corner on top", short: "Edge in slot" },
  { id: "both-slot", name: "Both in the slot", short: "Both in slot" },
];
function f2lGroup(s) {
  const corner = PAIR.find((id) => kindOf(id) === "corner"), edge = PAIR.find((id) => kindOf(id) === "edge");
  const cTop = POS[s.pos[corner]][1] === 1, eTop = POS[s.pos[edge]][1] === 1;
  if (!cTop && !eTop) return "both-slot";
  if (!cTop) return "corner-slot";
  if (!eTop) return "edge-slot";
  return stickerHome(s, corner, "U") === "U" ? "up-white-up" : "up-white-side";
}

// Where the front-right pair is (the cube as the algorithms hold it from solved).
const PC = posIndex([1, -1, 1]), PE = posIndex([1, 0, 1]);
function pairKey(s) { s = reorient(s); return `${s.pos[PC]}.${twistAt(s, s.pos[PC])}|${s.pos[PE]}.${flipAt(s, s.pos[PE])}`; }

function f2lStep() {
  const step = CFOP_STEPS.f2l;
  const cases = F2L.map((alg, i) => build({ id: `f2l-${i + 1}`, alg }, "yellowUp"));
  for (const c of cases) c.group = f2lGroup(c.start);
  // number within each group, in the order the groups are taught
  for (const g of F2L_GROUPS) cases.filter((c) => c.group === g.id).forEach((c, i) => { c.name = `${g.short} ${i + 1}`; c.recognition = g.name + "."; });
  cases.sort((a, b) => F2L_GROUPS.findIndex((g) => g.id === a.group) - F2L_GROUPS.findIndex((g) => g.id === b.group));
  // partners through the slot's diagonal: the same pair position, mirrored
  const byKey = new Map(cases.map((c) => [keyModUAlg(c.moves, { part: pairKey }), c]));
  for (const c of cases) { const m = byKey.get(keyModUAlg(mirrorFR(c.moves), { part: pairKey })); c.diagonal = m && m !== c ? m.id : null; }
  for (const c of cases) c.mirrorAlg = format(mirrorLR(c.moves));
  return { ...step, groups: F2L_GROUPS, concepts: F2L_CONCEPTS, cases };
}

function ollStep() {
  const cases = [];
  for (const g of OLL_GROUPS) for (const n of g.cases) cases.push(build({ id: `oll-${n}`, number: n, name: OCLL_NAMES[n] ? `OLL ${n} (${OCLL_NAMES[n]})` : `OLL ${n}`, alg: OLL[n], group: g.id, recognition: g.note }, "yellowUp"));
  return { ...CFOP_STEPS.oll, groups: OLL_GROUPS.map(({ id, name }) => ({ id, name })), cases };
}
function oll2Step() {
  const edges = OLL_2LOOK_EDGES.map((c) => build({ ...c, id: `oll2-${c.id}`, group: "edges", goal: "oll-edges", also: c.same ? `oll-${c.same}` : null }, "yellowUp"));
  const corners = Object.entries(OCLL_NAMES).map(([n, name]) => build({ id: `oll2-${name.toLowerCase()}`, name, alg: OLL[n], group: "corners", also: `oll-${n}` }, "yellowUp"));
  edges.find((c) => c.id === "oll2-line").also = "yellow-cross";
  return { ...CFOP_STEPS.oll2, groups: [{ id: "edges", name: "Edges: the yellow cross" }, { id: "corners", name: "Corners" }], cases: [...edges, ...corners] };
}
function pllStep() {
  return { ...CFOP_STEPS.pll, cases: PLL.map((c) => build({ ...c, id: `pll-${c.id}`, name: `${c.id} perm`, group: c.kind }, "yellowUp")), groups: [{ id: "edges", name: "Edges only" }, { id: "corners", name: "Corners only" }, { id: "both", name: "Corners and edges" }] };
}
function pll2Step() {
  const cases = PLL_2LOOK.map((c) => build({ ...c, id: `pll2-${c.id}`, group: c.id.startsWith("corners") ? "corners" : "edges", goal: c.id.startsWith("corners") ? "pll-corners" : "solved", also: `pll-${c.same}` }, "yellowUp"));
  return { ...CFOP_STEPS.pll2, groups: [{ id: "corners", name: "Corners" }, { id: "edges", name: "Edges" }], cases };
}

export const METHODS = [
  { ...BEGINNER, steps: BEGINNER.steps.map((s) => ({ ...s, cases: s.cases.map((c) => build(c, s.holding)) })) },
  {
    id: "cfop", name: "CFOP",
    steps: [
      { ...CFOP_STEPS.cross, intro: CROSS.intro, cases: CROSS.cases.map((c) => build(c, "yellowUp")) },
      f2lStep(), oll2Step(), pll2Step(), ollStep(), pllStep(),
    ],
  },
];

/** Every case, by id, with its method and step. */
export const CASES = new Map();
for (const m of METHODS) for (const s of m.steps) for (const c of s.cases) CASES.set(c.id, { method: m, step: s, case: c });
