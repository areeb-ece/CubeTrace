// The net's turn anatomy: where a move's rim stickers go and how its corners and edges cycle.
import test from "node:test";
import assert from "node:assert/strict";
import { rimMap, cycles } from "../js/lib/anatomy.js";
import { parseMoves } from "../js/lib/notation.js";
import { solved, applyMoves, stickers } from "../js/lib/cube.js";

const mv = (t) => parseMoves(t)[0];
const faceOf = (list) => [...new Set(list.map((p) => p.face))];

test("R: the rim goes U→B, B→D, D→F, F→U, a column of three each", () => {
  const rim = rimMap(mv("R"));
  assert.equal(rim.length, 4);
  const pairs = Object.fromEntries(rim.map((t) => [faceOf(t.from)[0], faceOf(t.to)[0]]));
  assert.deepEqual(pairs, { U: "B", B: "D", D: "F", F: "U" });
  for (const t of rim) {
    assert.equal(t.from.length, 3);
    assert.equal(faceOf(t.from).length, 1);
    assert.equal(faceOf(t.to).length, 1);
    const col = (list) => [...new Set(list.map((p) => p.col))];
    // the right-hand column on U, F, D; seen from behind, B's right-hand column of the cube is its left one
    assert.deepEqual(col(t.from), [t.from[0].face === "B" ? 0 : 2]);
    assert.deepEqual(col(t.to), [t.to[0].face === "B" ? 0 : 2]);
  }
});

test("every rim sticker lands where the move really puts it", () => {
  for (const text of ["R", "L'", "U", "D2", "F", "B'", "M", "E'", "S2", "R2"]) {
    const m = mv(text), rim = rimMap(m), after = stickers(applyMoves(solved(), [m]));
    assert.equal(rim.length, 4, text);
    for (const t of rim) for (let k = 0; k < 3; k++) {
      const at = after.find((s) => s.face === t.to[k].face && s.row === t.to[k].row && s.col === t.to[k].col);
      assert.equal(at.home, t.from[k].face, `${text}: ${JSON.stringify(t.from[k])} → ${JSON.stringify(t.to[k])}`);
    }
    assert.equal(new Set(rim.flatMap((t) => t.from.map((p) => p.face + p.row + p.col))).size, 12, `${text}: 12 distinct rim stickers`);
  }
});

test("rotations and wide moves have no rim; slices have no cycles", () => {
  for (const text of ["x", "y'", "z2", "r", "Rw"]) assert.equal(rimMap(mv(text)), null, text);
  for (const text of ["M", "E", "S'", "x", "r"]) assert.equal(cycles(mv(text)), null, text);
});

// signed area on screen axes (y down): positive is clockwise
const area = (ps) => ps.reduce((a, p, i) => { const q = ps[(i + 1) % ps.length]; return a + p.col * q.row - q.col * p.row; }, 0);

test("a face turn is one 4-cycle of corners and one of edges, clockwise on the net", () => {
  for (const f of "UDLRFB") {
    const c = cycles(mv(f)), back = cycles(mv(f + "'"));
    assert.equal(c.corners.length, 4);
    assert.equal(c.edges.length, 4);
    assert.ok(c.corners.every((p) => p.face === f) && c.edges.every((p) => p.face === f), `${f}: on the turning face`);
    assert.ok(area(c.corners) > 0 && area(c.edges) > 0, `${f}: clockwise`);
    assert.ok(area(back.corners) < 0 && area(back.edges) < 0, `${f}': anticlockwise`);
    assert.equal(c.half, false);
  }
  assert.equal(cycles(mv("R2")).half, true);
  assert.equal(cycles(mv("R2")).corners.length, 4);
});
