// The painter's order of the 3D cube (js/lib/scene.js) against a per-pixel depth test:
// at every sample point, the polygon painted last must be the nearest one there. Checked
// for turns on every axis, partway through, from many camera angles, including ones
// level with the turning slab.
import test from "node:test";
import assert from "node:assert/strict";
import { buildScene, pick } from "../js/lib/scene.js";
import { solved, applyMoves } from "../js/lib/cube.js";
import { parseMoves } from "../js/lib/notation.js";

const inside = (pts, x, y) => {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
};
// 1/depth is affine in screen space for a flat polygon: fit it through three corners.
function invDepth(p, x, y) {
  const [a, b, c] = p.pts;
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  const fa = 1 / a[2], fb = 1 / b[2], fc = 1 / c[2];
  const u = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / det;
  const v = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / det;
  return fa + u * (fb - fa) + v * (fc - fa);
}

const scrambled = applyMoves(solved(), parseMoves("R U2 F' L D B2 R' U F2 D'"));
const cameras = [];
for (const yaw of [-150, -90, -40, 0, 32, 75, 135, 180]) for (const pitch of [-60, -25, 0, 28, 70]) cameras.push({ yaw: (yaw * Math.PI) / 180, pitch: (pitch * Math.PI) / 180, dist: 11, focal: 3.2 });

test("the polygon painted last is the nearest one, at every sample", () => {
  let checked = 0;
  for (const mv of ["R", "U'", "F2", "M", "E'", "S", "r", "d", "x", "L'", "B"]) {
    const move = parseMoves(mv)[0];
    for (const t of [0, 0.4, 0.8]) for (const camera of cameras) {
      const polys = buildScene(scrambled, { turn: { move, t }, camera });
      for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
        const x = -1.3 + (2.6 * i) / 24, y = -1.3 + (2.6 * j) / 24;
        let last = null, near = null, best = -Infinity;
        for (const p of polys) {
          if (p.kind !== "body" || !inside(p.pts, x, y)) continue;
          last = p;
          const d = invDepth(p, x, y);
          if (d > best + 1e-9) { best = d; near = p; }
        }
        if (!last) continue;
        checked++;
        const dl = invDepth(last, x, y);
        assert.ok(dl >= best - 1e-6, `${mv} t=${t} camera ${JSON.stringify(camera)} at (${x.toFixed(2)}, ${y.toFixed(2)}): painted ${last.id}/${last.face} over nearer ${near.id}/${near.face}`);
      }
    }
  }
  assert.ok(checked > 30000, `checked ${checked} samples`);
});

test("picking finds the sticker under a point", () => {
  const polys = buildScene(solved());
  const st = polys.filter((p) => p.kind === "sticker");
  assert.equal(st.length, 27, "three faces show, nine stickers each");
  for (const p of st) {
    const cx = p.pts.reduce((a, q) => a + q[0], 0) / 4, cy = p.pts.reduce((a, q) => a + q[1], 0) / 4;
    const hit = pick(polys, cx, cy);
    assert.equal(hit.id, p.id);
    assert.equal(hit.face, p.face);
  }
  assert.deepEqual([...new Set(st.map((p) => p.face))].sort(), ["F", "R", "U"]);
});

test("mirror panes show the three hidden faces", () => {
  const polys = buildScene(solved(), { mirrors: true });
  const m = polys.filter((p) => p.kind === "mirror");
  assert.deepEqual([...new Set(m.map((p) => p.face))].sort(), ["B", "D", "L"]);
  assert.ok(polys.findIndex((p) => p.kind === "body") > polys.findLastIndex((p) => p.kind.startsWith("mirror")), "painted before the cube");
});

// ── turn anatomy ──
import { turnGuides, rotateAbout, moveAngle, hull, DEFAULT_CAMERA } from "../js/lib/scene.js";

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test("the arrow runs the way the pieces turn, on the side of the face the move follows", () => {
  const SIDE = { R: 1, L: -1, M: -1, U: 1, D: -1, E: -1, F: 1, B: -1, S: 1, x: 1, y: 1, z: 1, r: 1, l: -1 };
  for (const text of ["R", "R'", "L", "L'", "M", "M'", "U", "D'", "E", "F", "B'", "S", "S'", "x", "y'", "z", "r", "l", "R2", "M2"]) {
    const m = parseMoves(text)[0];
    for (const camera of cameras.filter((_, i) => i % 7 === 0)) {
      const g = turnGuides(scrambled, m, 0.3, camera);
      const sign = Math.sign(moveAngle(m));
      assert.equal(g.side, SIDE[m.name], `${text}: side`);
      for (const p of g.arc3) assert.ok(Math.abs(p[m.axis] - g.side * 1.75) < 1e-9, `${text}: the arrow floats just outside the ${SIDE[m.name] > 0 ? "positive" : "negative"} face`);
      for (let i = 0; i + 1 < g.arc3.length; i++) {
        // a point advanced along the arc goes the way rotateAbout with the move's sign sends it
        const a = g.arc3[i], b = g.arc3[i + 1], r = rotateAbout(a, m.axis, sign * 0.05);
        assert.ok(dot3(sub3(r, a), sub3(b, a)) > 0, `${text}: arrow ${i} against the turn`);
      }
      assert.equal(g.heads.length, m.q === 2 ? 2 : 1, `${text}: arrowheads`);
      assert.equal(g.double, m.q === 2);
    }
  }
});

test("the slab outline covers exactly the turning layers, and the axis passes through the cube", () => {
  const g = turnGuides(solved(), parseMoves("R")[0], 0);
  const xs = g.slab.map((p) => p[0]), full = turnGuides(solved(), parseMoves("x")[0], 0).slab.map((p) => p[0]);
  assert.ok(Math.max(...xs) < Math.max(...full) + 1e-9 && Math.min(...xs) > Math.min(...full) - 1e-9, "R's slab lies inside the whole cube's outline");
  assert.equal(g.slab.length, hull(g.slab).length, "a convex outline");
  const [a, b] = g.axis, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const cubeW = Math.max(...full) - Math.min(...full);
  assert.ok(len > cubeW * 0.6, "the axis is longer than the cube is wide along it");
  // partway through, the outline has turned (it differs from the resting one)
  const mid = turnGuides(solved(), parseMoves("U")[0], 0.5, DEFAULT_CAMERA).slab.flat().join();
  assert.notEqual(mid, turnGuides(solved(), parseMoves("U")[0], 0, DEFAULT_CAMERA).slab.flat().join());
});
