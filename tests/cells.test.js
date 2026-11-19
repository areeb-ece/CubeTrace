import test from "node:test";
import assert from "node:assert/strict";
import { solved, applyMoves, stickers, IDS, kindOf } from "../js/lib/cube.js";
import { parseMoves } from "../js/lib/notation.js";
import { posIndex } from "../js/lib/rot.js";
import { cellsOf, refCell } from "../js/lib/cells.js";
import { facesAt } from "../js/lib/pieces.js";

const run = (text, s = solved()) => applyMoves(s, parseMoves(text));

test("a piece has one cell per sticker, and they are its own", () => {
  const s = run("R U F' L2 D B");
  for (const id of IDS) {
    const cells = cellsOf(s, id);
    assert.equal(cells.length, { centre: 1, edge: 2, corner: 3 }[kindOf(id)]);
    const own = new Set(stickers(s).filter((st) => st.id === id).map((st) => st.face + st.row + st.col));
    assert.deepEqual(new Set(cells.map((c) => c.face + c.row + c.col)), own);
  }
});

test("the reference cell shows the piece's U/D colour when it has one, wherever the piece is", () => {
  const s = run("R U F' L2 D B R' U2");
  const at = new Map(stickers(s).map((st) => [st.face + st.row + st.col, st]));
  for (const id of IDS) {
    const c = refCell(s, id), st = at.get(c.face + c.row + c.col);
    assert.equal(st.id, id);
    assert.equal(st.home, facesAt(id)[0]);
  }
});

test("a solved cube's reference cells are on the piece's own faces; a turn carries them", () => {
  const front = posIndex([1, 1, 1]);
  assert.deepEqual(refCell(solved(), front), { face: "U", row: 2, col: 2 });
  // R carries the UFR corner to UBR, turning its white sticker from U to B
  const after = refCell(run("R"), front);
  assert.equal(after.face, "B");
});

import { idAt, trail } from "../js/lib/cells.js";
import { trace } from "../js/lib/trace.js";

test("idAt names the piece under a sticker", () => {
  const s = run("R U");
  for (const st of stickers(s)) assert.equal(idAt(s, st.face, st.row, st.col), st.id);
});

test("a trail has one entry per place, and none for moves that leave the piece alone", () => {
  const moves = parseMoves("R U L2 R'");
  const { states } = trace(solved(), moves);
  const dfr = posIndex([1, -1, 1]);
  const t = trail(states, dfr);
  assert.equal(t[0].i, 0);
  assert.ok(t.every((c, k) => k === 0 || c.i > t[k - 1].i));
  assert.ok(t.length <= states.length);
  const leftCentre = posIndex([-1, 0, 0]);
  const quiet = trail(trace(solved(), parseMoves("R U R'")).states, leftCentre);
  assert.equal(quiet.length, 1, "the left centre never leaves its cell");
  // each entry is where refCell says it is at that state
  for (const c of t) assert.deepEqual({ face: c.face, row: c.row, col: c.col }, refCell(states[c.i], dfr));
});
