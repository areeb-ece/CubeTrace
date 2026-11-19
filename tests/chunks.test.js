// The timeline's data: chunks, captions, bracket levels and the commutator note.
import test from "node:test";
import assert from "node:assert/strict";
import { parseMoves as P } from "../js/lib/notation.js";
import { inversePairs, autoChunks } from "../js/lib/structure.js";
import { chunksFor, captionFor, bracketLevels, commutatorNote, chunkAt, TRIGGER_LINES } from "../js/lib/chunks.js";
import { boundariesOf } from "../js/timing.js";

const covers = (chunks, n) => chunks.every((c, i) => c.start === (i ? chunks[i - 1].end : 0) && c.end > c.start) && (chunks.at(-1)?.end ?? 0) === n;

test("chunks cover every move in order, from the finder or from the content", () => {
  for (const text of ["F R U R' U' F'", "R U R' U R U2 R'", "U R U R' U' F", "R U R' D R U' R' D'", "R"]) {
    const m = P(text);
    assert.ok(covers(chunksFor(m), m.length), text);
    assert.deepEqual(chunksFor(m), autoChunks(m), "no parts: the automatic chunks");
  }
  const m = P("F R U R' U' F'");
  assert.deepEqual(chunksFor(m).map((c) => c.role), ["setup", "trigger", "undo"]);
  const parts = [{ start: 1, end: 3, role: "insert", caption: "mine" }, { start: 4, end: 5, role: "trigger", name: "x" }];
  const own = chunksFor(m, parts);
  assert.ok(covers(own, m.length), "gaps become null chunks");
  assert.deepEqual(own.map((c) => c.role), [null, "insert", null, "trigger", null]);
  assert.equal(own[1].caption, "mine");
  assert.ok(covers(chunksFor(m, [{ start: 0, end: 99, role: "setup" }]), m.length), "out-of-range parts are clipped");
});

test("playback stops where the timeline's chunks end", () => {
  const m = P("F R U R' U' F'"), parts = [{ start: 0, end: 4, role: "insert" }];
  assert.deepEqual(boundariesOf(m), [0, 1, 5, 6]);
  assert.deepEqual(boundariesOf(m, parts), [0, 4, 6]);
});

test("captions: written ones win, the rest come from the role and the trigger's name", () => {
  assert.equal(captionFor({ role: "trigger", name: "x", caption: "mine" }), "mine");
  assert.match(captionFor({ role: "setup" }), /^Set up: /);
  assert.match(captionFor({ role: "undo" }), /^Undo the setup/);
  assert.equal(captionFor({ role: null }), null);
  assert.equal(captionFor(null), null);
  for (const name of ["sexy move", "sledgehammer", "Sune", "Antisune", "insert"]) assert.ok(TRIGGER_LINES[name], name);
  assert.match(captionFor({ role: "trigger", name: "Sune" }), /^Sune: /);
  assert.match(captionFor({ role: "trigger", name: "sexy move" }), /^Sexy move: /);
  const cs = chunksFor(P("F R U R' U' F'"));
  assert.equal(chunkAt(cs, 2).role, "trigger");
  assert.equal(chunkAt(cs, 6).role, "undo", "at the end: the last chunk");
});

test("brackets that overlap stack, and ones that don't share a level", () => {
  const lv = (t) => Object.fromEntries(bracketLevels(inversePairs(P(t))).map((b) => [`${b.i}-${b.j}`, b.level]));
  assert.deepEqual(lv("R U R' U'"), { "0-2": 0, "1-3": 1 }, "crossing arcs stack");
  assert.deepEqual(lv("F R U R' U' F'"), { "0-5": 2, "1-3": 0, "2-4": 1 });
  assert.deepEqual(lv("R U R' U' F B F' B'"), { "0-2": 0, "1-3": 1, "4-6": 0, "5-7": 1 }, "separate groups reuse the levels");
  assert.deepEqual(lv("R R' U U'"), { "0-1": 0, "2-3": 0 });
  assert.deepEqual(bracketLevels([]), []);
});

test("the commutator note writes X and Y out; other sequences have none", () => {
  const n = commutatorNote(P("R U R' D R U' R' D'"));
  assert.deepEqual([n.x, n.y], ["R U R'", "D"]);
  assert.equal(n.xMoves.length, 3);
  assert.deepEqual([commutatorNote(P("R' D' R D")).x, commutatorNote(P("R' D' R D")).y], ["R'", "D'"]);
  assert.equal(commutatorNote(P("R U R' U R U2 R'")), null);
  assert.equal(commutatorNote(P("F R U R' U' F'")), null, "a conjugate is not shown");
});
