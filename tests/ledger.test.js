// The twist ledger: corner twists in the holding the learner sees.
import test from "node:test";
import assert from "node:assert/strict";
import { twistLedger, signed3 } from "../js/lib/ledger.js";
import { HOLDINGS } from "../js/lib/roles.js";
import { applyMoves } from "../js/lib/cube.js";
import { parseMoves } from "../js/lib/notation.js";

const Y = HOLDINGS.yellowUp, play = (s, text) => applyMoves(s, parseMoves(text));

test("signed3 reads thirds of a turn as 0, +1 or -1", () => {
  assert.deepEqual([0, 1, 2, 3, 4, -1].map(signed3), [0, 1, -1, 0, 1, -1]);
});

test("a solved cube reads 0 everywhere, in either holding, named in words", () => {
  for (const hold of [Y, HOLDINGS.whiteUp]) {
    const l = twistLedger(hold, hold);
    assert.deepEqual(l.corners.map((c) => c.twist), [0, 0, 0, 0]);
    assert.deepEqual(l.corners.map((c) => c.name), ["front-left", "front-right", "back-right", "back-left"]);
    assert.equal(l.top, 0);
    assert.equal(l.lower, 0);
  }
});

test("(R' D' R D)2 twists the front-right corner, and the lower corners hold the rest", () => {
  const l = twistLedger(play(Y, "(R' D' R D)2"), Y);
  const ufr = l.corners.find((c) => c.name === "front-right");
  assert.ok(ufr.twist === 1 || ufr.twist === -1, `front-right reads ${ufr.twist}`);
  assert.equal(signed3(l.top + l.lower), 0);
});

test("top + lower is 0 mod 3 for every reachable state", () => {
  let s = Y;
  const seq = "R U R' U' F' D L2 B U2 R' D' R D R' D' R D x U R U' R' y' F B2 M E' S L' U D' R2 z".split(" ");
  for (const m of seq) {
    s = play(s, m);
    const l = twistLedger(s, Y);
    assert.equal(signed3(l.top + l.lower), 0, `after ${m}`);
    assert.ok(l.corners.every((c) => [-1, 0, 1].includes(c.twist)));
  }
});

test("turning the whole cube doesn't change what the learner sees held the same way", () => {
  const a = twistLedger(play(Y, "(R' D' R D)2"), Y), b = twistLedger(play(Y, "(R' D' R D)2 x y2"), Y);
  assert.deepEqual(a, b);
});

test("one twisted corner alone reads +1 or -1, and four repeats undo two", () => {
  const two = twistLedger(play(Y, "(R' D' R D)2"), Y).corners.find((c) => c.name === "front-right").twist;
  const four = twistLedger(play(Y, "(R' D' R D)4"), Y).corners.find((c) => c.name === "front-right").twist;
  assert.equal(signed3(two + four), 0, "2 repeats and 4 repeats are opposite thirds");
});
