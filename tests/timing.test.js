import test from "node:test";
import assert from "node:assert/strict";
import { turnMsFor, dwellMs, boundaries, boundariesOf, nextStop, prevStop, DWELL } from "../js/timing.js";
import { parseMoves } from "../js/lib/notation.js";

test("a turn lasts twice --dur-3, over the speed; none when motion is off", () => {
  assert.equal(turnMsFor(260, 1), 520);
  assert.equal(turnMsFor(260, 2), 260);
  assert.equal(turnMsFor(260, 0.25), 2080);
  assert.equal(turnMsFor(0, 1), 0);
  assert.equal(dwellMs(1), DWELL);
  assert.equal(dwellMs(2), DWELL / 2);
});

test("playback stops at every chunk boundary", () => {
  const moves = parseMoves("U R U R' U' F");     // a lone move, the sexy move's R U R' U', a lone move
  const stops = boundariesOf(moves);
  assert.ok(stops.includes(0) && stops.includes(moves.length));
  assert.deepEqual(stops, [...new Set(stops)].sort((a, b) => a - b));
  assert.equal(nextStop(stops, 0) > 0, true);
  assert.equal(nextStop(stops, moves.length), moves.length);
  assert.equal(prevStop(stops, 0), 0);
  assert.equal(prevStop(stops, moves.length) < moves.length, true);
  assert.deepEqual(boundaries([{ start: 0, end: 2 }, { start: 2, end: 5 }], 5), [0, 2, 5]);
  assert.equal(nextStop([0, 2, 5], 2), 5);
  assert.equal(prevStop([0, 2, 5], 5), 2);
  assert.equal(prevStop([0, 2, 5], 3), 2);
});
