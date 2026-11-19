import test from "node:test";
import assert from "node:assert/strict";
import { netLayout, netCell, NET_FACES } from "../js/lib/layout2d.js";

const SIZES = [[320, 240], [600, 400], [1000, 300], [300, 900], [1440, 900], [40, 40]];

test("the net fits inside its box, whatever the shape", () => {
  for (const [w, h] of SIZES) {
    const l = netLayout(w, h);
    for (const face of "UDLRFB") for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const c = netCell(l, face, row, col);
      assert.ok(c.x >= -1e-9 && c.y >= -1e-9 && c.x + c.size <= w + 1e-9 && c.y + c.size <= h + 1e-9, `${face}${row}${col} outside ${w}x${h}`);
    }
  }
});

test("the net is centred", () => {
  const l = netLayout(1000, 300);
  assert.ok(Math.abs(l.x0 - (1000 - l.width) / 2) < 1e-9 && Math.abs(l.y0 - (300 - l.height) / 2) < 1e-9);
});

test("no two stickers overlap, and the faces lie as on a cross", () => {
  const l = netLayout(900, 700), all = [];
  for (const face of "UDLRFB") for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) all.push(netCell(l, face, row, col));
  assert.equal(all.length, 54);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    assert.ok(a.x + a.size <= b.x + 1e-9 || b.x + b.size <= a.x + 1e-9 || a.y + a.size <= b.y + 1e-9 || b.y + b.size <= a.y + 1e-9, `stickers ${i} and ${j} overlap`);
  }
  const at = (f) => netCell(l, f, 1, 1);
  assert.ok(at("U").y < at("F").y && at("D").y > at("F").y && Math.abs(at("U").x - at("F").x) < 1e-9);
  assert.ok(at("L").x < at("F").x && at("F").x < at("R").x && at("R").x < at("B").x);
  assert.deepEqual(Object.keys(NET_FACES).sort(), ["B", "D", "F", "L", "R", "U"]);
});
