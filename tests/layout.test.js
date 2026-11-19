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

import { gridOf } from "../js/lib/cube.js";
import { netCells, cellAt, stepCell, llLayout, llCell, llCentre } from "../js/lib/layout2d.js";

test("a point finds the sticker under it, and arrow keys walk the net", () => {
  const cells = netCells(netLayout(900, 700));
  assert.equal(cells.length, 54);
  const f11 = cells.find((c) => c.face === "F" && c.row === 1 && c.col === 1);
  assert.equal(cellAt(cells, f11.x + f11.size / 2, f11.y + f11.size / 2), f11);
  assert.equal(cellAt(cells, -5, -5), null);
  const at = (f, r, c) => cells.find((x) => x.face === f && x.row === r && x.col === c);
  assert.equal(stepCell(cells, f11, 1, 0), at("F", 1, 2));
  assert.equal(stepCell(cells, at("F", 1, 2), 1, 0), at("R", 1, 0), "across the gap onto the next face");
  assert.equal(stepCell(cells, f11, 0, -1), at("F", 0, 1));
  assert.equal(stepCell(cells, at("F", 2, 1), 0, 1), at("D", 0, 1));
  assert.equal(stepCell(cells, at("U", 0, 0), 0, -1), at("U", 0, 0), "nothing above the top: stays");
  // every cell can be reached from the middle by arrow steps
  const seen = new Set([f11]), todo = [f11];
  while (todo.length) {
    const c = todo.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = stepCell(cells, c, dx, dy); if (!seen.has(n)) { seen.add(n); todo.push(n); } }
  }
  assert.equal(seen.size, 54);
});

test("the last-layer diagram: 21 stickers, no overlaps, inside the box, F at the bottom", () => {
  for (const [w, h] of [[300, 300], [500, 260], [260, 500], [40, 40]]) {
    const l = llLayout(w, h), rects = [];
    for (const face of "UDLRFB") for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const r = llCell(l, face, row, col);
      if (!r) continue;
      assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= w + 1e-9 && r.y + r.h <= h + 1e-9, `${face}${row}${col} outside ${w}x${h}`);
      rects.push(r);
    }
    assert.equal(rects.length, 9 + 12);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      assert.ok(a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9, `${i} and ${j} overlap`);
    }
  }
  const l = llLayout(400, 400), mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const [fx, fy] = mid(llCell(l, "F", 0, 1)), [bx, by] = mid(llCell(l, "B", 0, 1)), [rx] = mid(llCell(l, "R", 0, 1)), [lx] = mid(llCell(l, "L", 0, 1)), [ux, uy] = mid(llCell(l, "U", 1, 1));
  assert.ok(fy > uy && by < uy && rx > ux && lx < ux && Math.abs(fx - ux) < 1e-9 && Math.abs(bx - ux) < 1e-9);
  assert.equal(llCell(l, "F", 1, 0), null);
  assert.equal(llCell(l, "D", 0, 0), null);
});

test("each side strip sits beside the up-face sticker of its own piece", () => {
  const l = llLayout(400, 400);
  // the piece at grid (x, z): its up sticker, and its side sticker in the strip next to it
  const near = (x, z, face, col) => {
    const [cx, cy] = llCentre(l, x, z), s = llCell(l, face, 0, col);
    return face === "F" || face === "B" ? Math.abs(s.x + s.w / 2 - cx) < 1e-9 : Math.abs(s.y + s.h / 2 - cy) < 1e-9;
  };
  for (const face of "FRBL") for (let col = 0; col < 3; col++) {
    const [x, , z] = gridOf(face, 0, col);
    assert.ok(near(x, z, face, col), `${face}${col}`);
  }
});
