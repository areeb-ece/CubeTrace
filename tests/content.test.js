// The content is only as good as these checks (PLAN.md section 10): every algorithm
// parses and round-trips, reaches its goal from its case, touches only what its step
// may touch, the case sets cover every case exactly once, mirrors are mirrors, and the
// beginner method's rules hold.
import test from "node:test";
import assert from "node:assert/strict";
import { METHODS, CASES } from "../js/lib/content/index.js";
import { parse, format } from "../js/lib/notation.js";
import { applyMoves, solved, reorient, IDS, kindOf, stickerHome, occupant } from "../js/lib/cube.js";
import { inverse, mirrorLR, mirrorFR, keyModUAlg, sameEffect, isIdentity } from "../js/lib/algebra.js";
import { GOALS, pieceSolved, piecesWhere, colourFacing } from "../js/lib/goals.js";
import { HOLDINGS } from "../js/lib/roles.js";
import { POS, posIndex } from "../js/lib/rot.js";
import { twistAt, flipAt, slotName } from "../js/lib/pieces.js";
import { netChange } from "../js/lib/trace.js";
import { sameMove } from "../js/lib/moves.js";

const steps = METHODS.flatMap((m) => m.steps.map((s) => ({ m, s })));
const step = (id) => steps.find((x) => x.s.id === id).s;

test("every algorithm parses and round-trips through the formatter", () => {
  for (const [id, { case: c }] of CASES) {
    assert.equal(format(parse(c.alg).moves), c.alg, id);
    assert.ok(c.moves.length > 0, id);
  }
});

test("every case reaches its goal", () => {
  for (const { s } of steps) for (const c of s.cases) {
    const goal = GOALS[c.goal || s.goal];
    assert.ok(goal, `${c.id}: goal ${c.goal || s.goal}`);
    assert.ok(goal(applyMoves(c.start, c.moves)), `${c.id} (${c.alg}) doesn't reach ${c.goal || s.goal}`);
    assert.ok(!goal(c.start) || c.moves.length === 0, `${c.id} starts already at its goal`);
  }
});

// What each step's algorithms may touch: applied to the solved cube in the step's
// holding, the pieces outside `may` must stay solved.
const where = (h, f) => piecesWhere(h, f);
const MAY = {
  "white-corners": { h: "whiteUp", keep: (p, k) => p[1] === 1 && !(p[0] === 1 && p[2] === 1 && k === "corner") },
  "second-layer": { h: "yellowUp", keep: (p, k) => p[1] === -1 || (p[1] === 0 && !(p[0] === 1 && p[2] === 1) && !(p[0] === -1 && p[2] === 1)) },
  "yellow-cross": { h: "yellowUp", keep: (p) => p[1] < 1 },
  "yellow-edges": { h: "yellowUp", keep: (p) => p[1] < 1 },
  "yellow-corners": { h: "yellowUp", keep: (p, k) => p[1] < 1 || k === "edge" },
  // R' D' R D borrows the lower two layers; a whole step (yt-two) is checked by its goal
  "yellow-twist": { h: "yellowUp", keep: (p, k) => p[1] === 1 && k === "edge" },
  f2l: { h: "yellowUp", keep: (p) => p[1] < 1 && !(p[0] === 1 && p[2] === 1) },
  oll2: { h: "yellowUp", keep: (p) => p[1] < 1 },
  oll: { h: "yellowUp", keep: (p) => p[1] < 1 },
  pll2: { h: "yellowUp", keep: (p) => p[1] < 1 },
  pll: { h: "yellowUp", keep: (p) => p[1] < 1 },
};
test("preservation: an algorithm touches only what its step may", () => {
  for (const [sid, { h, keep }] of Object.entries(MAY)) {
    const ids = where(h, keep);
    for (const c of step(sid).cases) {
      const s = applyMoves(HOLDINGS[h], c.moves);
      for (const id of ids) assert.ok(pieceSolved(s, id), `${c.id} (${c.alg}) disturbs the ${slotName(HOLDINGS[h].pos[id])} piece`);
    }
  }
});

test("a setup and its undo are inverses", () => {
  for (const [id, { case: c }] of CASES) {
    if (!c.parts) continue;
    assert.equal(c.parts[c.parts.length - 1].end, c.moves.length, `${id}: parts cover the algorithm`);
    for (const a of c.parts.filter((x) => x.role === "setup")) {
      const b = c.parts.find((x) => x.role === "undo" && x.pair === a.pair);
      assert.ok(b, `${id}: setup without undo`);
      const X = c.moves.slice(a.start, a.end), Y = c.moves.slice(b.start, b.end);
      assert.ok(Y.length === X.length && inverse(X).every((m, i) => sameMove(m, Y[i])), `${id}: undo isn't the setup's inverse`);
    }
  }
});

// ── coverage, computed ──
const TOP = [[1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1], [0, 1, 1], [-1, 1, 0], [0, 1, -1], [1, 1, 0]].map(posIndex);
const llOri = (s) => { s = reorient(s); return TOP.map((p, i) => (i < 4 ? twistAt(s, p) : flipAt(s, p))).join(""); };
const llPerm = (s) => { s = reorient(s); const at = occupant(s); return TOP.map((p) => at[p]).join(",") + "|" + llOri(s); };

test("OLL: 57 algorithms, every non-solved orientation pattern exactly once", () => {
  const cases = step("oll").cases, keys = new Set();
  for (const c of cases) {
    const k = keyModUAlg(c.moves, { part: llOri });
    assert.ok(!keys.has(k), `${c.id} repeats a case`);
    keys.add(k);
  }
  assert.equal(cases.length, 57);
  assert.ok(!keys.has(keyModUAlg([], { part: llOri })), "no algorithm for the solved pattern");
  // 216 patterns (twists summing to 0 mod 3, flips to 0 mod 2) make 58 classes up to U
  const classes = new Set();
  for (let c = 0; c < 81; c++) for (let e = 0; e < 16; e++) {
    const co = [0, 1, 2, 3].map((i) => Math.floor(c / 3 ** i) % 3), eo = [0, 1, 2, 3].map((i) => (e >> i) & 1);
    if (co.reduce((a, b) => a + b) % 3 || eo.reduce((a, b) => a + b) % 2) continue;
    classes.add([0, 1, 2, 3].map((r) => [...co.slice(r), ...co.slice(0, r), ...eo.slice(r), ...eo.slice(0, r)].join("")).sort()[0]);
  }
  assert.equal(classes.size, 58);
});

test("OLL groups have the shapes they are named for", () => {
  const LLE = piecesWhere("yellowUp", (p, k) => p[1] === 1 && k === "edge"), LLC = piecesWhere("yellowUp", (p, k) => p[1] === 1 && k === "corner");
  const up = (s, ids) => ids.filter((id) => colourFacing(s, id, "D"));
  for (const c of step("oll").cases) {
    const e = up(c.start, LLE), corners = up(c.start, LLC).length;
    if (c.group === "dot") assert.equal(e.length, 0, c.id);
    if (c.group === "cross") assert.equal(e.length, 4, c.id);
    if (c.group === "corners") assert.equal(corners, 4, c.id);
    if (c.group === "line") {
      const [a, b] = e.map((id) => POS[c.start.pos[id]]);
      assert.ok(e.length === 2 && a[0] === -b[0] && a[2] === -b[2] && corners === 0, c.id);
    }
    if (["square", "lightning", "fish", "knight", "awkward", "p", "w", "c", "l", "big-lightning", "t"].includes(c.group)) assert.equal(e.length, 2, c.id);
  }
});

test("PLL: 21 algorithms, every non-solved permutation exactly once (U before and after)", () => {
  const cases = step("pll").cases, keys = new Set();
  for (const c of cases) {
    const k = keyModUAlg(c.moves, { after: true, part: llPerm });
    assert.match(k, /\|00000000$/, `${c.id} changes orientation`);
    assert.ok(!keys.has(k), `${c.id} repeats a case`);
    keys.add(k);
  }
  assert.equal(cases.length, 21);
  assert.ok(!keys.has(keyModUAlg([], { after: true, part: llPerm })));
});

test("PLL kinds: edges-only and corners-only cases move only those", () => {
  // an algorithm may finish with the top layer turned, so try each final U
  const ends = ["", "U", "U2", "U'"].map((t) => parse(t).moves);
  for (const c of step("pll").cases) {
    const want = { edges: ["edge"], corners: ["corner"], both: ["corner", "edge"] }[c.group].join();
    const got = ends.map((u) => {
      const net = netChange(solved(), reorient(applyMoves(solved(), [...c.moves, ...u])));
      return [...new Set(net.changed.filter((x) => kindOf(x.id) !== "centre").map((x) => kindOf(x.id)))].sort().join();
    });
    assert.ok(got.includes(want), `${c.id}: moves ${got}`);
  }
});

test("F2L: 41 cases, distinct up to U; with solved, all 42 positions of a pair", () => {
  const cases = step("f2l").cases, keys = new Set();
  const C = posIndex([1, -1, 1]), E = posIndex([1, 0, 1]);
  const pair = (s) => { s = reorient(s); return `${s.pos[C]}.${twistAt(s, s.pos[C])}|${s.pos[E]}.${flipAt(s, s.pos[E])}`; };
  for (const c of cases) {
    const k = keyModUAlg(c.moves, { part: pair });
    assert.ok(!keys.has(k), `${c.id} repeats a case`);
    keys.add(k);
  }
  keys.add(keyModUAlg([], { part: pair }));
  // every position: corner in a top corner or its slot (3 twists), edge in a top edge or its slot (2 flips)
  const cPos = [[1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1], [1, -1, 1]].map(posIndex), ePos = [[0, 1, 1], [-1, 1, 0], [0, 1, -1], [1, 1, 0], [1, 0, 1]].map(posIndex);
  const turnU = (p, k) => { if (POS[p][1] !== 1) return p; let [x, y, z] = POS[p]; for (let i = 0; i < k; i++) [x, z] = [-z, x]; return posIndex([x, y, z]); };
  const classes = new Set();
  for (const cp of cPos) for (let ct = 0; ct < 3; ct++) for (const ep of ePos) for (let ef = 0; ef < 2; ef++) {
    classes.add([0, 1, 2, 3].map((k) => `${turnU(cp, k)}.${ct}|${turnU(ep, k)}.${ef}`).sort()[0]);
  }
  assert.equal(classes.size, 42);
  assert.deepEqual([...keys].sort(), [...classes].sort());
});

test("F2L groups and mirrors", () => {
  const cases = step("f2l").cases;
  const count = (g) => cases.filter((c) => c.group === g).length;
  assert.deepEqual(["up-white-up", "up-white-side", "corner-slot", "edge-slot", "both-slot"].map(count), [count("up-white-up"), count("up-white-side"), 6, 6, 5]);
  assert.equal(count("up-white-up") + count("up-white-side"), 24);
  const byId = new Map(cases.map((c) => [c.id, c]));
  for (const c of cases) {
    if (c.diagonal) assert.equal(byId.get(c.diagonal).diagonal, c.id, `${c.id}: diagonal partner is mutual`);
    // the left slot's algorithm solves the mirror image of the case
    const left = applyMoves(HOLDINGS.yellowUp, inverse(mirrorLR(c.moves)));
    assert.ok(GOALS.f2l(applyMoves(left, mirrorLR(c.moves))));
  }
  assert.ok(cases.filter((c) => c.diagonal).length >= 30, "most cases have a partner through the diagonal");
});

test("mirror pairs are mirrors", () => {
  for (const [id, { case: c }] of CASES) if (c.mirror) {
    const other = CASES.get(c.mirror).case;
    assert.equal(format(mirrorLR(c.moves)), other.alg, `${id} ↔ ${c.mirror}`);
  }
});

test("links to other cases resolve", () => {
  for (const [id, { case: c }] of CASES) if (c.also && c.also !== "yellow-cross") assert.ok(CASES.has(c.also), `${id}: ${c.also}`);
  assert.ok(steps.some(({ s }) => s.id === "yellow-cross"));
});

// ── the beginner method's rules (brief §4.1) ──
const UFR = posIndex([1, 1, 1]), DFR = posIndex([1, -1, 1]);
const whiteFacing = (s, id) => "UDLRFB".split("").find((f) => stickerHome(s, id, f) === "U");
test("step 2: the corner below its slot needs 1, 3 or 5 repeats as white faces R, D or F", () => {
  const want = { "wco-right": ["R", 1], "wco-down": ["D", 3], "wco-front": ["F", 5] };
  for (const c of step("white-corners").cases) {
    const [face, n] = want[c.id];
    assert.equal(c.start.pos[UFR], DFR, `${c.id}: below its slot`);
    assert.equal(whiteFacing(c.start, UFR), face, c.id);
    assert.equal(c.moves.length, 4 * n, c.id);
  }
  assert.ok(isIdentity(parse("(R' D' R D)6").moves));
});

test("step 4: line once, L twice, dot then an L or a line", () => {
  const top = (s) => { const at = occupant(s); return [[0, 1, -1], [-1, 1, 0], [0, 1, 1], [1, 1, 0]].map((p) => stickerHome(s, at[posIndex(p)], "U") === "D"); };
  const cs = step("yellow-cross").cases;
  assert.deepEqual(top(cs.find((c) => c.id === "yc-line").start), [false, true, false, true], "line left to right");
  assert.deepEqual(top(cs.find((c) => c.id === "yc-l").start), [true, true, false, false], "L at the back and left");
  assert.deepEqual(top(cs.find((c) => c.id === "yc-dot").start), [false, false, false, false], "dot");
});

test("step 5 swaps the front and left edges; step 6 keeps the front-right corner", () => {
  const net = netChange(HOLDINGS.yellowUp, applyMoves(HOLDINGS.yellowUp, step("yellow-edges").cases[0].moves));
  const edges = net.cycles.filter((cy) => kindOf(occupant(HOLDINGS.yellowUp)[cy[0]]) === "edge").map((cy) => cy.map(slotName).sort().join(" "));
  assert.deepEqual(edges, ["UF UL"]);
  const s6 = applyMoves(HOLDINGS.yellowUp, step("yellow-corners").cases[0].moves);
  assert.equal(occupant(s6)[UFR], occupant(HOLDINGS.yellowUp)[UFR], "front-right corner stays");
});

test("step 7: two repeats for yellow facing right, four for front", () => {
  for (const [id, face, n] of [["yt-right", "R", 2], ["yt-front", "F", 4]]) {
    const c = step("yellow-twist").cases.find((x) => x.id === id);
    const at = occupant(c.start);
    assert.equal("UDLRFB".split("").find((f) => stickerHome(c.start, at[UFR], f) === "D"), face, id);
    assert.equal(c.moves.length, 4 * n, id);
  }
});

test("the beginner method turns the cube over with z2: green stays in front", () => {
  assert.equal(step("second-layer").turnOver, "z2");
  assert.ok(sameEffect(parse("x2 y2").moves, parse("z2").moves));
});
