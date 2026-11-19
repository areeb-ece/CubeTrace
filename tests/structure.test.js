// Algorithm structure (inverse pairs, conjugates, commutators, triggers, chunks) and
// sticker roles.
import test from "node:test";
import assert from "node:assert/strict";
import { parseMoves as P } from "../js/lib/notation.js";
import { inversePairs, conjugate, commutator, findTriggers, autoChunks, overlap } from "../js/lib/structure.js";
import { roles, displaced, HOLDINGS } from "../js/lib/roles.js";
import { solved, applyMoves, IDS, kindOf } from "../js/lib/cube.js";
import { posIndex } from "../js/lib/rot.js";
import { slotName } from "../js/lib/pieces.js";

test("inverse pairs join a move to the later move that undoes it", () => {
  assert.deepEqual(inversePairs(P("R U R' U'")), [[0, 2], [1, 3]]);
  assert.deepEqual(inversePairs(P("F R U R' U' F'")), [[0, 5], [1, 3], [2, 4]]);
  assert.deepEqual(inversePairs(P("R R'")), [[0, 1]]);
  assert.deepEqual(inversePairs(P("R R R'")), [[1, 2]], "the nearer R is the one undone");
  assert.deepEqual(inversePairs(P("R2 U R2")), [[0, 2]], "a half turn undoes itself");
});

test("conjugates and commutators", () => {
  assert.deepEqual(conjugate(P("F R U R' U' F'")), { k: 1 });
  assert.deepEqual(conjugate(P("R U R'")), { k: 1 });
  assert.equal(conjugate(P("R U R' U'")), null);
  assert.deepEqual(commutator(P("R U R' U'")), { a: 1, b: 1 });
  assert.deepEqual(commutator(P("R' D' R D")), { a: 1, b: 1 });
  assert.deepEqual(commutator(P("R U R' D R U' R' D'")), { a: 3, b: 1 });
  assert.equal(commutator(P("R U R' U R U2 R'")), null);
});

test("triggers, mirrors included", () => {
  const names = (t) => findTriggers(P(t)).map((x) => x.name);
  assert.deepEqual(names("F R U R' U' F'"), ["sexy move"]);
  assert.deepEqual(names("R U R' U R U2 R' U"), ["Sune"]);
  assert.deepEqual(names("L' U' L U"), ["sexy move"], "the left-hand mirror");
  assert.deepEqual(names("U R U' R' U' F' U F"), ["insert", "insert"]);
});

test("chunks: setup and undo around the middle", () => {
  const c = autoChunks(P("F R U R' U' F'"));
  assert.deepEqual(c.map((x) => [x.start, x.end, x.role]), [[0, 1, "setup"], [1, 5, "trigger"], [5, 6, "undo"]]);
  const all = autoChunks(P("R U R' U R U2 R' U"));
  assert.equal(all[0].role, "trigger");
  assert.equal(all[all.length - 1].end, 8, "chunks cover every move");
});

test("a commutator's overlap is where the two parts meet", () => {
  const o = overlap(P("R"), P("U")).map(slotName).sort();
  assert.deepEqual(o, ["UBR", "UFR", "UR"]);
});

test("roles: the white cross focuses the white edges, F2L the pair", () => {
  const r = roles("white-cross");
  assert.equal(IDS.filter((id) => r[id] === "focus").length, 4);
  const f = roles("f2l");
  const focus = IDS.filter((id) => f[id] === "focus").map((id) => slotName(HOLDINGS.yellowUp.pos[id])).sort();
  assert.deepEqual(focus, ["DFR", "FR"]);
  assert.equal(IDS.filter((id) => f[id] === "ignored").length, 8, "the last layer");
  const o = roles("oll");
  assert.equal(IDS.filter((id) => o[id] === "top-only").length, 8);
  assert.equal(IDS.filter((id) => r[id] === "centre").length, 6);
});

test("displaced kept pieces and the holes they leave", () => {
  const f = roles("f2l");
  const start = HOLDINGS.yellowUp;
  const mid = applyMoves(start, P("R U"));
  const { displaced: d, holes } = displaced(f, start, mid);
  assert.ok(d.size > 0);
  assert.ok(holes.every((h) => kindOf(h.id) !== "centre"));
  const back = applyMoves(start, P("R U U' R'"));
  assert.equal(displaced(f, start, back).displaced.size, 0);
});
