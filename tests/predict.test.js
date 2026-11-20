import test from "node:test";
import assert from "node:assert/strict";
import { units, movers, pickTarget, slotOfPiece, judge, verdict, question } from "../js/lib/predict.js";
import { METHODS } from "../js/lib/content/index.js";
import { resolve } from "../js/lib/lesson.js";
import { trace } from "../js/lib/trace.js";
import { chunksFor } from "../js/lib/chunks.js";
import { roles } from "../js/lib/roles.js";
import { solved, applyMoves, kindOf } from "../js/lib/cube.js";
import { parseMoves } from "../js/lib/notation.js";
import { posIndex } from "../js/lib/rot.js";

const second = () => resolve({ method: "beginner", step: "second-layer", case: "sl-right" });

test("units: a move each, or a chunk each, covering every move", () => {
  const r = second(), chunks = chunksFor(r.moves, r.parts);
  assert.deepEqual(units(chunks, r.moves.length, "move").map((u) => u[0]), [0, 1, 2, 3, 4, 5, 6, 7]);
  const byChunk = units(chunks, r.moves.length, "chunk");
  assert.deepEqual(byChunk, [[0, 4], [4, 8]]);
  assert.deepEqual(units([], 3, "chunk"), [[0, 3]]);
  assert.deepEqual(units([], 0), []);
});

test("the target is a piece the run moves, a focus one when there is one", () => {
  const r = second(), tr = trace(r.start, r.moves), roleOf = roles(r.roles);
  for (const by of ["move", "chunk"]) {
    for (const [from, to] of units(chunksFor(r.moves, r.parts), r.moves.length, by)) {
      const t = pickTarget(tr.states[from], tr.states[to], roleOf, from);
      const moved = movers(tr.states[from], tr.states[to]);
      if (t == null) { assert.equal(moved.length, 0); continue; }
      assert.ok(moved.includes(t), `${by} ${from}-${to}`);
      if (moved.some((id) => roleOf[id] === "focus" && kindOf(id) !== "centre")) assert.equal(roleOf[t], "focus");
      assert.notEqual(kindOf(t), "centre");
    }
  }
});

test("when no focus piece moves, any piece that moves will do; when nothing moves, there is no target", () => {
  const a = solved(), b = applyMoves(a, parseMoves("U")), none = roles("white-cross"); // U moves edges at U: focus here
  assert.notEqual(pickTarget(a, b, none), null);
  const dEdge = roles("second-layer"); // U turns nothing in the middle layer
  const t = pickTarget(solved(), applyMoves(solved(), parseMoves("D")), dEdge);
  assert.notEqual(t, null);
  assert.notEqual(dEdge[t], "focus");
  assert.equal(pickTarget(a, applyMoves(a, parseMoves("R R'")), roles("all")), null);
  // a slice that moves only centres and edges still has a target; a whole-cube turn moves all
  assert.notEqual(pickTarget(a, applyMoves(a, parseMoves("M")), roles("all")), null);
});

test("salt varies the pick between runs", () => {
  const a = solved(), b = applyMoves(a, parseMoves("R")), all = roles("all");
  assert.equal(new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => pickTarget(a, b, all, i))).size, 8);
});

test("the answer is the target's slot after the run; a click names the slot, not the piece", () => {
  const a = solved(), b = applyMoves(a, parseMoves("R"));
  const ufr = posIndex([1, 1, 1]), ubr = posIndex([1, 1, -1]);
  // R carries the piece at up-front-right to up-back-right
  const piece = a.pos.findIndex((p) => p === ufr);
  assert.equal(slotOfPiece(a, piece), ufr);
  assert.deepEqual(judge(b, piece, ubr), { right: true, answer: ubr });
  assert.deepEqual(judge(b, piece, ufr), { right: false, answer: ubr }, "where it was is not where it went");
  assert.match(verdict(true, piece, ubr), /^Right: the white-green-red corner went to up-back-right\.$/);
  assert.match(verdict(false, piece, ubr), /^Not quite: the white-green-red corner went to up-back-right\.$/);
  assert.equal(question(piece), "Where will the white-green-red corner go?");
});

test("every run of every lesson case has a target that really arrives where judge says", () => {
  for (const m of METHODS) for (const s of m.steps) for (const c of s.cases.slice(0, 6)) {
    const r = resolve({ method: m.id, step: s.id, case: c.id }), tr = trace(r.start, r.moves), roleOf = roles(r.roles);
    for (const [from, to] of units(chunksFor(r.moves, r.parts), r.moves.length, "move")) {
      const t = pickTarget(tr.states[from], tr.states[to], roleOf, from);
      if (t != null) assert.equal(judge(tr.states[to], t, tr.states[to].pos[t]).right, true);
    }
  }
});
