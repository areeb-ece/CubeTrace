// The engine: the rotation group, moves in WCA directions, group sanity, inverse and
// mirrors, the piece description, and the notation parser's answers and refusals.
import test from "node:test";
import assert from "node:assert/strict";
import { ROTS, MUL, INV } from "../js/lib/rot.js";
import { solved, applyMoves, equal, stickers, centres, isSolved, IDS } from "../js/lib/cube.js";
import { parseMoves, parse, format, NotationError } from "../js/lib/notation.js";
import { inverse, mirrorLR, mirrorFR, sameEffect, isIdentity, caseOf } from "../js/lib/algebra.js";
import { describe, slotName, pieceName, posOf } from "../js/lib/pieces.js";
import { trace, netChange } from "../js/lib/trace.js";
import { posIndex } from "../js/lib/rot.js";

const P = parseMoves;
const after = (alg) => applyMoves(solved(), P(alg));
/** The colour (home face) on sticker (row, col) of a face, as drawn on the net. */
const at = (s, face, row, col) => stickers(s).find((t) => t.face === face && t.row === row && t.col === col).home;
const faceStr = (s, face) => stickers(s).filter((t) => t.face === face).map((t) => t.home).join("");

test("24 rotations, closed under products, each with an inverse", () => {
  assert.equal(ROTS.length, 24);
  for (let a = 0; a < 24; a++) { assert.equal(MUL[a][INV[a]], 0); for (let b = 0; b < 24; b++) assert.ok(MUL[a][b] >= 0); }
});

test("26 cubies, 54 stickers, solved is solved", () => {
  assert.equal(IDS.length, 26);
  const s = solved();
  assert.equal(stickers(s).length, 54);
  for (const f of "UDLRFB") assert.equal(faceStr(s, f), f.repeat(9));
  assert.ok(isSolved(s));
});

test("each face turns clockwise as seen from outside it", () => {
  // R carries the front's right column up onto U
  assert.equal(faceStr(after("R"), "U"), "UUFUUFUUF");
  // U carries the front's top row to the left face
  assert.equal(at(after("U"), "L", 0, 1), "F");
  // F carries U's bottom row onto R
  assert.equal(at(after("F"), "R", 1, 0), "U");
  // L carries U's left column onto F
  assert.equal(at(after("L"), "F", 1, 0), "U");
  // D carries the front's bottom row to the right face
  assert.equal(at(after("D"), "R", 2, 1), "F");
  // B carries U's top row onto L
  assert.equal(at(after("B"), "L", 1, 0), "U");
});

test("slices, wide moves and rotations follow the WCA", () => {
  assert.ok(sameEffect(P("M"), P("L' R x'")) || equal(after("M x"), after("L' R")), "M turns like L");
  assert.ok(equal(after("r"), after("R M'")), "r = R M'");
  assert.ok(equal(after("Rw"), after("r")));
  assert.ok(equal(after("x"), after("R M' L'")), "x = R M' L'");
  assert.ok(equal(after("y"), after("U E' D'")), "y = U E' D'");
  assert.ok(equal(after("z"), after("F S B'")), "z = F S B'");
  assert.equal(centres(after("x")).U, "F", "after x, green is on top");
  assert.equal(centres(after("z2")).U, "D", "after z2, yellow is on top");
  assert.equal(centres(after("z2")).F, "F", "and green is still in front");
  assert.equal(centres(after("z2")).R, "L", "so orange is on the right");
});

test("group sanity", () => {
  for (const f of "UDLRFBMESxyz") assert.ok(isIdentity(P(`${f}4`.replace(/(\w)4/, "($1)4"))), `${f}^4`);
  assert.ok(isIdentity(P("(R U)105")), "(R U)^105");
  assert.ok(!isIdentity(P("(R U)35")) && !isIdentity(P("(R U)63")));
  assert.ok(isIdentity(P("(R U R' U')6")));
  assert.ok(isIdentity(P("(R' D' R D)6")));
  assert.ok(isIdentity(P("R2' R2")));
});

test("inverse undoes; mirrors are involutions and commute with inverse", () => {
  const algs = ["R U R' U'", "F R U R' U' F'", "r U R' U' r' F R F'", "M2 U M2 U2 M2 U M2", "x y z R2' E S'", "Rw U2 Lw' D"];
  for (const a of algs) {
    const m = P(a);
    assert.ok(isIdentity([...m, ...inverse(m)]), a);
    for (const mir of [mirrorLR, mirrorFR]) {
      assert.equal(format(mir(mir(m))), format(m), `${mir.name} twice: ${a}`);
      assert.equal(format(mir(inverse(m))), format(inverse(mir(m))), `${mir.name} and inverse: ${a}`);
    }
  }
  assert.equal(format(mirrorLR(P("U R U' R' U' F' U F"))), "U' L' U L U F U' F'");
  assert.equal(format(mirrorFR(P("R U' R'"))), "F' U F");
  assert.equal(format(mirrorFR(P("M"))), "S");
  assert.equal(format(mirrorLR(P("r x M"))), "l' x M");
});

test("the mirror of an algorithm's effect is the mirror image of the cube", () => {
  // stickers of the L/R-mirrored alg = stickers of the original seen in a mirror
  const a = after("R U R' U'"), b = after(format(mirrorLR(P("R U R' U'"))));
  const swap = { L: "R", R: "L" };
  for (const t of stickers(a)) {
    const face = swap[t.face] || t.face;
    const col = "UDFB".includes(t.face) ? 2 - t.col : 2 - t.col;
    assert.equal(at(b, face, t.row, col), swap[t.home] || t.home);
  }
});

test("orientation sums stay valid", () => {
  for (const a of ["R", "F", "R U R' U'", "F R U R' U' F'", "(R U)7 F2 D' L B'", "x R y U z F M E S"]) {
    const d = describe(after(a.replace(/[xyzMES]\s*/g, "")));
    assert.equal(d.co.reduce((x, y) => x + y) % 3, 0, a);
    assert.equal(d.eo.reduce((x, y) => x + y) % 2, 0, a);
  }
  // R, L, U, D don't flip edges; F and B do
  assert.deepEqual(describe(after("R U L D")).eo, Array(12).fill(0));
  assert.equal(describe(after("F")).eo.reduce((x, y) => x + y), 4);
  // R twists corners, U doesn't
  assert.deepEqual(describe(after("U")).co, Array(8).fill(0));
  assert.notDeepEqual(describe(after("R")).co, Array(8).fill(0));
});

test("names of pieces and slots", () => {
  assert.equal(pieceName(posIndex([1, 1, 1])), "white-green-red corner");
  assert.equal(pieceName(posIndex([1, 0, 1])), "green-red edge");
  assert.equal(slotName(posIndex([1, 0, 1])), "FR");
  assert.equal(slotName(posIndex([-1, -1, -1])), "DBL");
  assert.equal(slotName(posOf("U")), "U");
});

test("trace: every quarter turn is a 4-cycle of corners and one of edges", () => {
  for (const f of "UDLRFB") {
    const { steps } = trace(solved(), P(f));
    const { cycles } = netChange(solved(), after(f));
    assert.equal(steps[0].length, 8, f);
    assert.deepEqual(cycles.map((c) => c.length), [4, 4], f);
  }
  const { cycles, twists } = netChange(solved(), after("(R' D' R D)2"));
  assert.ok(cycles.length + twists.length > 0);
});

test("case of an algorithm: the algorithm solves it", () => {
  const alg = P("R U R' U R U2 R'");
  assert.ok(isSolved(applyMoves(caseOf(alg), alg)));
});

test("parser: notation it reads", () => {
  assert.equal(format(P("R U R' U'")), "R U R' U'");
  assert.equal(format(P("RUR'U'")), "R U R' U'");
  assert.equal(format(P("R’ U2' Rw r // a comment\n M E S x y z")), "R' U2' Rw r M E S x y z");
  assert.equal(P("(R U R' U')3").length, 12);
  assert.equal(P("(R (U)2)2").length, 6);
  const { spans } = parse("R  U'");
  assert.deepEqual(spans, [[0, 1], [3, 5]]);
  for (const t of ["F R U R' U' F'", "R2' r2 Lw' (M' U)4 // x", "x2 y' z2'"]) assert.equal(format(P(format(P(t)))), format(P(t)), t);
});

test("parser: refusals say where and what to type", () => {
  const bad = { "R Q": 2, "R'2": 0, "R3": 1, "(R U": 4, "R U)": 3, "X": 0, "m": 0, "Mw": 0, "[R, U]": 0, "()": 0, "(R U)'": 5, "(R)0": 0 };
  for (const [t, where] of Object.entries(bad)) {
    assert.throws(() => P(t), (e) => e instanceof NotationError && e.at === where && e.message.length > 20, t);
  }
  assert.throws(() => P("R'2"), /R2/);
  assert.throws(() => P("X"), /lower case/);
});
