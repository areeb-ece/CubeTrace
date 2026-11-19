// What the views read from the roles: the chooser's names, which sets mark pieces, the
// holes, and the sentence the live region adds.
import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_SETS, HOLDINGS, roles } from "../js/lib/roles.js";
import { applyMoves } from "../js/lib/cube.js";
import { parseMoves } from "../js/lib/notation.js";
import { ROLE_NAMES, look, stickerFill, outlines } from "../js/views/stickers.js";
import { describeMoved } from "../js/announce.js";
import { STICKERS, keptColour } from "../js/palette.js";
import { posIndex } from "../js/lib/rot.js";

test("every role set has a readable name, and no name is left over", () => {
  assert.deepEqual(Object.keys(ROLE_NAMES).sort(), Object.keys(ROLE_SETS).sort());
  assert.equal(ROLE_NAMES.all, "All pieces");
  assert.equal(new Set(Object.values(ROLE_NAMES)).size, Object.keys(ROLE_NAMES).length);
});

const store = (roleSet, moves, over = {}) => {
  const start = HOLDINGS[ROLE_SETS[roleSet].holding];
  return { opts: { roleSet, full: false }, start, hover: null, track: null, now: applyMoves(start, parseMoves(moves)), ...over };
};
const pal = { kept: Object.fromEntries(Object.keys(STICKERS).map((f) => [f, "KEPT" + f])), ignored: "GREY", accent: "A", ink: "I", trail: "T" };

test("an F2L pair that is taken out leaves holes; one that comes back leaves none", () => {
  const out = store("f2l", "R U");
  assert.ok(look(out, out.now).holes.length > 0);
  assert.ok(look(out, out.now).away.size > 0);
  const back = store("f2l", "R U U' R'");
  assert.equal(look(back, back.now).holes.length, 0);
  const none = store("all", "R U");
  assert.equal(look(none, none.now).holes.length, 0, "no kept pieces, nothing to restore");
});

test("stickers are coloured by role; Full colour restores them", () => {
  const s = store("white-cross", "");
  const lk = look(s, s.now), edge = posIndex([0, 1, 1]), corner = posIndex([1, 1, 1]);
  assert.deepEqual(stickerFill(pal, lk, edge, "U"), { fill: STICKERS.U, grey: false });
  assert.deepEqual(stickerFill(pal, lk, corner, "U"), { fill: "GREY", grey: true });
  assert.equal(stickerFill(pal, lk, posIndex([0, 1, 0]), "U").fill, STICKERS.U, "centres keep their colour");
  const full = look({ ...s, opts: { ...s.opts, full: true } }, s.now);
  assert.equal(stickerFill(pal, full, corner, "U").fill, STICKERS.U);
  const kept = store("pll", ""), k = look(kept, kept.now);
  assert.equal(stickerFill(pal, k, posIndex([1, 1, 1]), "U").fill, "KEPTU", "yellow up: the white corners are at the bottom, kept");
  const oll = store("oll", ""), o = look(oll, oll.now), topCorner = posIndex([1, -1, 1]);
  // yellow up: the up face shows D's colour; a top-only piece's side stickers are ignored
  assert.equal(stickerFill(pal, o, topCorner, "D").grey, false);
  assert.equal(stickerFill(pal, o, topCorner, "F").grey, true);
});

test("outlines: focus only where something else is not, then the brushed, then the tracked piece", () => {
  const all = store("all", ""), a = look(all, all.now);
  assert.deepEqual(outlines(pal, a), []);
  const wc = store("white-cross", ""), w = look(wc, wc.now);
  assert.equal(outlines(pal, w).length, 4);
  const lk = look({ ...wc, hover: 3, track: 5 }, wc.now), list = outlines(pal, lk);
  assert.deepEqual(list.slice(-2).map((o) => [o.id, o.color]), [[3, "I"], [5, "T"]]);
  assert.ok(list.at(-1).width > list[0].width, "tracking is the heaviest");
});

test("the kept colour is quieter than the sticker's own", () => {
  assert.notEqual(keptColour(STICKERS.R, "#14161A"), STICKERS.R);
});

test("the live region names up to two focus pieces that moved, then counts the rest", () => {
  const wc = roles("white-cross"), id = (p) => posIndex(p);
  assert.equal(describeMoved([{ id: id([1, 1, 0]), from: id([1, 1, 0]), to: id([0, 1, -1]) }], wc), " The white-red edge moves from up-right to up-back.");
  const four = [[1, 1, 0], [0, 1, 1], [-1, 1, 0], [0, 1, -1]].map((p) => ({ id: id(p), from: id(p), to: id([0, 0, 1]) }));
  const said = describeMoved(four, wc);
  assert.equal(said.match(/moves from/g).length, 2);
  assert.match(said, / And 2 more\.$/);
  assert.equal(describeMoved([{ id: id([1, 1, 1]), from: id([1, 1, 1]), to: id([1, 1, -1]) }], wc), "", "a corner isn't focus in the white cross");
  assert.equal(describeMoved(four, roles("all")), "", "with everything in focus, only the move is said");
  assert.equal(describeMoved([{ id: id([1, 1, 0]), from: id([1, 1, 0]), to: id([1, 1, 0]) }], wc), "", "a piece that only flips hasn't moved");
});
