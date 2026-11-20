// What the accessibility pass can check without a browser: the words canvases are named
// with, and that no local CSS paints text in --ink-4 (the master keeps it for hairlines
// and placeholders, below the 4.5:1 text contrast).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { positionWords, canvasName } from "../js/lib/describe.js";

test("a position is described in words, at rest and mid-turn", () => {
  assert.equal(positionWords(0, 0, 7), "before the first move");
  assert.equal(positionWords(2, 0, 7), "before move 3 of 7");
  assert.equal(positionWords(2, 0.4, 7), "turning move 3 of 7");
  assert.equal(positionWords(7, 0, 7), "after the last move");
  assert.equal(positionWords(0, 0, 0), "no moves yet");
});

test("a canvas name says the view, the case and the position", () => {
  assert.equal(canvasName("Cube", "Edge goes right", 2, 0, 7), "Cube: Edge goes right, before move 3 of 7.");
  assert.equal(canvasName("Net", "", 7, 0, 7, "Arrow keys move."), "Net: after the last move. Arrow keys move.");
});

test("no local CSS uses --ink-4 for anything but its own definition", () => {
  const css = fs.readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
  const uses = [...css.matchAll(/var\(--ink-4\)/g)];
  assert.equal(uses.length, 0, "--ink-4 is not a text colour");
});
