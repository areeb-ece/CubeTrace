// The numbers behind Save image: the layout of views on the sheet, and the frames of a GIF.
import test from "node:test";
import assert from "node:assert/strict";
import { layoutPicture, gifPlan, pixelSize, shapeOf, LAYOUT_WIDTH, PAD, GAP, FOOT, HOLD } from "../js/lib/picture.js";

const three = [{ id: "cube", shape: shapeOf("cube") }, { id: "net", shape: shapeOf("net") }, { id: "ll", shape: shapeOf("ll") }];

test("views sit side by side, in order, all one height, inside the sheet", () => {
  const l = layoutPicture({ views: three });
  assert.deepEqual(l.cells.map((c) => c.id), ["cube", "net", "ll"]);
  for (const c of l.cells) {
    assert.equal(c.h, l.cells[0].h);
    assert.ok(c.x >= PAD - 1e-9 && c.x + c.w <= l.width - PAD + 1e-9, "inside the side margins");
    assert.ok(c.y + c.h <= l.height);
  }
  for (let i = 1; i < l.cells.length; i++) assert.ok(l.cells[i].x - (l.cells[i - 1].x + l.cells[i - 1].w) >= GAP - 1e-9, "a gap between views");
  // they fill the width
  const last = l.cells.at(-1);
  assert.ok(Math.abs(last.x + last.w - (l.width - PAD)) < 1e-6);
});

test("each view is as wide as its shape says", () => {
  const l = layoutPicture({ views: three });
  l.cells.forEach((c, i) => assert.ok(Math.abs(c.w / c.h - three[i].shape) < 1e-9));
});

test("one view alone is capped in height and centred", () => {
  const l = layoutPicture({ views: [three[0]] });
  assert.ok(l.cells[0].h <= LAYOUT_WIDTH * 0.62 + 1e-9);
  const left = l.cells[0].x, right = l.width - (l.cells[0].x + l.cells[0].w);
  assert.ok(Math.abs(left - right) < 1e-6);
});

test("a title block pushes the views down and the credit sits under them", () => {
  const bare = layoutPicture({ views: three }), titled = layoutPicture({ views: three, titleH: 60 });
  assert.equal(titled.title.h, 60);
  assert.ok(titled.cells[0].y >= titled.title.y + 60 + GAP - 1e-9);
  assert.equal(bare.title, null);
  assert.ok(Math.abs(titled.height - bare.height - (60 + GAP)) <= 1);
  assert.ok(titled.credit.y >= titled.cells[0].y + titled.cells[0].h);
  assert.ok(titled.credit.y + FOOT <= titled.height);
});

test("no views is an empty sheet, not an error", () => {
  const l = layoutPicture({ views: [] });
  assert.deepEqual(l.cells, []);
});

test("pixel sizes are even and keep the shape", () => {
  const l = layoutPicture({ views: three });
  const p = pixelSize(l, 1441);
  assert.equal(p.width % 2, 0);
  assert.equal(p.height % 2, 0);
  assert.ok(Math.abs(p.width / p.height - l.width / l.height) < 0.01);
});

test("a GIF holds at both ends and passes through every move", () => {
  const plan = gifPlan(4);
  assert.deepEqual(plan[0], { index: 0, t: 0, delay: HOLD });
  assert.equal(plan.at(-1).index, 4);
  assert.equal(plan.at(-1).t, 0);
  assert.ok(plan.at(-1).delay > plan[1].delay);
  for (let i = 0; i < 4; i++) {
    const turning = plan.filter((f) => f.index === i && f.t > 0);
    assert.ok(turning.length >= 2, "a few frames a turn");
    assert.ok(turning.every((f, k) => f.t < 1 && (k === 0 || f.t > turning[k - 1].t)), "the turn only goes forward");
  }
});

test("a long algorithm gets fewer frames a turn, and an empty one a single still", () => {
  assert.ok(gifPlan(40).length < 40 * 7);
  assert.ok(gifPlan(40).length <= 200);
  assert.equal(gifPlan(0).length, 1);
});
