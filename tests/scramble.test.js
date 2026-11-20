import test from "node:test";
import assert from "node:assert/strict";
import { scramble, cryptoRandom } from "../js/lib/scramble.js";
import { parse } from "../js/lib/notation.js";

const ax = (m) => "UDLRFB".indexOf(m[0]) >> 1;
const lcg = (seed) => () => (seed = (seed * 1103515245 + 12345) >>> 0);
const dice = (seed) => { const next = lcg(seed); return (n) => (next() >>> 8) % n; };

test("a scramble is 20 face turns the parser reads, never the same face twice running", () => {
  for (let seed = 1; seed < 200; seed++) {
    const text = scramble(dice(seed)), parts = text.split(" ");
    assert.equal(parts.length, 20);
    assert.equal(parse(text).moves.length, 20);
    for (let i = 0; i < 20; i++) {
      assert.match(parts[i], /^[UDLRFB]['2]?$/);
      if (i) assert.notEqual(parts[i][0], parts[i - 1][0], text);
      // no R L R: the third would merge with the first
      if (i > 1) assert.ok(!(ax(parts[i]) === ax(parts[i - 1]) && ax(parts[i - 1]) === ax(parts[i - 2])), text);
    }
  }
});

test("every face and every turn size turns up, and the length can be chosen", () => {
  const all = new Set(), r = dice(7);
  for (let i = 0; i < 50; i++) for (const m of scramble(r).split(" ")) all.add(m);
  assert.equal(all.size, 18);
  assert.equal(scramble(dice(3), 5).split(" ").length, 5);
});

test("cryptoRandom stays in range and uses every value", () => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) { const v = cryptoRandom(6); assert.ok(Number.isInteger(v) && v >= 0 && v < 6); seen.add(v); }
  assert.equal(seen.size, 6);
});
