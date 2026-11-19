// The 3D cube as flat polygons in painting order, for a Canvas 2D view (PLAN.md D2).
// Pure: no DOM. A view paints the list from first to last and gets a correct picture:
//   - faces turned away from the camera are dropped (every cubie is a convex box);
//   - during a turn the cube is split into slabs by planes across the turning axis, and
//     those planes don't move as the slab turns, so the slabs are painted far to near
//     exactly; inside a slab, cubies are painted far to near by their centres.
// tests/scene.test.js checks the order against a per-pixel depth test.
import { POS } from "./rot.js";
import { IDS, NORMALS, stickerHome } from "./cube.js";

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const HALF = 0.5;     // half a cubie
const INSET = 0.07;   // the plastic left round a sticker
const RAISE = 0.004;  // stickers sit just above the body
export const LIFT = 0.12; // how far a turning outer slab rises off the cube

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => scale(a, 1 / Math.hypot(...a));

/** Rotate v by angle (radians, right-handed) about axis 0, 1 or 2. */
export function rotateAbout(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), [x, y, z] = v;
  if (axis === 0) return [x, y * c - z * s, y * s + z * c];
  if (axis === 1) return [x * c + z * s, y, -x * s + z * c];
  return [x * c - y * s, x * s + y * c, z];
}

/** The signed angle of a whole move, in radians. */
export const moveAngle = (m) => (m.q === 3 ? -1 : m.q) * (Math.PI / 2);

/** Camera: yaw (from the front towards the right), pitch (above the horizon), distance, focal length. */
export const DEFAULT_CAMERA = { yaw: (32 * Math.PI) / 180, pitch: (28 * Math.PI) / 180, dist: 11, focal: 3.2 };

export function cameraBasis(cam) {
  const eye = [Math.cos(cam.pitch) * Math.sin(cam.yaw), Math.sin(cam.pitch), Math.cos(cam.pitch) * Math.cos(cam.yaw)].map((v) => v * cam.dist);
  const fwd = norm(scale(eye, -1));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  return { eye, fwd, right, up, focal: cam.focal };
}
/** World point → [x, y, depth], x right and y down, in units where the cube is about 2 wide. */
export function projectPoint(b, p) {
  const v = sub(p, b.eye), z = dot(v, b.fwd);
  return [(dot(v, b.right) / z) * b.focal, (-dot(v, b.up) / z) * b.focal, z];
}

/**
 * The polygons of state s, painted in order.
 * opts.turn: { move, t } to draw move partway (t from 0 to 1), lifted off the rest.
 * opts.camera, opts.mirrors (draw the hidden faces reflected beside the cube).
 * Each polygon: { pts (2D), id (cubie), face (world face at rest), kind: "body" |
 * "sticker" | "mirror", home (the sticker's home face, for its colour), normal, centre }.
 */
export function buildScene(s, opts = {}) {
  const cam = cameraBasis(opts.camera || DEFAULT_CAMERA);
  const tm = opts.turn?.move, t = opts.turn?.t ?? 0;
  const angle = tm ? moveAngle(tm) * t : 0;
  const lift = tm && tm.layers.length < 3 && !tm.layers.includes(0) ? LIFT * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) : 0;
  const inSlab = (id) => !!tm && tm.layers.includes(POS[s.pos[id]][tm.axis]);
  const place = (id, p) => {
    if (!inSlab(id)) return p;
    let q = rotateAbout(p, tm.axis, angle);
    if (lift) q = add(q, scale(AXES[tm.axis], lift * Math.sign(tm.layers[0])));
    return q;
  };
  const dir = (id, n) => (inSlab(id) ? rotateAbout(n, tm.axis, angle) : n);

  const cubies = [];
  for (const id of IDS) {
    const c = POS[s.pos[id]];
    const polys = [];
    for (const face of "UDLRFB") {
      const n = NORMALS[face];
      const nw = dir(id, n);
      const fc = place(id, add(c, scale(n, HALF)));
      if (dot(nw, sub(cam.eye, fc)) <= 0) continue; // faces away
      const [u, v] = faceAxes(n);
      const quad = (h, raise) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => place(id, add(add(c, scale(n, HALF + raise)), add(scale(u, a * h), scale(v, b * h)))));
      const project = (pts) => pts.map((p) => projectPoint(cam, p));
      polys.push({ kind: "body", id, face, pts: project(quad(HALF, 0)), normal: nw, centre: fc });
      const home = stickerHome(s, id, face);
      if (home) polys.push({ kind: "sticker", id, face, home, pts: project(quad(HALF - INSET, RAISE)), normal: nw, centre: fc });
    }
    if (polys.length) cubies.push({ id, centre: place(id, c), far: tm ? slabDistance(tm, c[tm.axis], cam.eye[tm.axis]) : 0, polys });
  }

  // Slabs far to near (the eye's distance from the slab along the axis), then cubies.
  const d = (p) => Math.hypot(...sub(p, cam.eye));
  cubies.sort((a, b) => (a.far !== b.far ? b.far - a.far : d(b.centre) - d(a.centre)));

  const out = opts.mirrors ? mirrorPolys(s, cam) : [];
  for (const c of cubies) out.push(...c.polys);
  return out;
}

// Runs of layers: a slab turning layers {0, 1} is one run, layer -1 another; a turning
// middle slice makes three. Planes between runs stay put as the slab turns, so a run the
// eye is further from (along the axis) can never cover a nearer one.
function slabDistance(m, layer, eye) {
  const runs = [];
  for (const l of [-1, 0, 1]) {
    const on = m.layers.includes(l);
    if (!runs.length || runs[runs.length - 1].on !== on) runs.push({ on, ls: [] });
    runs[runs.length - 1].ls.push(l);
  }
  const r = runs.find((r) => r.ls.includes(layer));
  const lo = Math.min(...r.ls) - HALF - LIFT, hi = Math.max(...r.ls) + HALF + LIFT;
  return eye < lo ? lo - eye : eye > hi ? eye - hi : 0;
}

/** Two unit vectors spanning a face with normal n. */
function faceAxes(n) {
  if (n[0]) return [[0, 0, 1], [0, 1, 0]];
  if (n[1]) return [[1, 0, 0], [0, 0, 1]];
  return [[1, 0, 0], [0, 1, 0]];
}

// The faces the camera can't see, reflected in a mirror placed beyond each of them, so
// they show beside the cube. Painted before the cube (they are further away).
const MIRROR_GAP = 3.3;
// The back pane would sit straight behind the cube from the usual camera, so it slides
// out to the right, past the cube's edge (the side and bottom panes are clear already).
const MIRROR_SHIFT = { B: [3.1, 0.4, 0] };
function mirrorPolys(s, cam) {
  const out = [];
  for (const face of "UDLRFB") {
    const n = NORMALS[face];
    if (dot(n, cam.eye) > 0) continue; // visible already
    const k = n.findIndex((v) => v !== 0), side = n[k];
    const shift = MIRROR_SHIFT[face] || [0, 0, 0];
    const reflect = (p) => { const q = p.slice(); q[k] = 2 * side * MIRROR_GAP - q[k]; return add(q, shift); };
    const [u, v] = faceAxes(n);
    for (const id of IDS) {
      const c = POS[s.pos[id]];
      if (c[k] !== side) continue;
      const home = stickerHome(s, id, face);
      if (!home) continue;
      const quad = (h) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => projectPoint(cam, reflect(add(add(c, scale(n, HALF)), add(scale(u, a * h), scale(v, b * h))))));
      out.push({ kind: "mirror-body", id, face, pts: quad(HALF), normal: scale(n, -1), centre: reflect(add(c, scale(n, HALF))) });
      out.push({ kind: "mirror", id, face, home, pts: quad(HALF - INSET), normal: scale(n, -1), centre: reflect(add(c, scale(n, HALF))) });
    }
  }
  return out;
}

/** The topmost polygon under 2D point [x, y] (same units as pts), or null. */
export function pick(polys, x, y, kinds = ["sticker", "body"]) {
  for (let i = polys.length - 1; i >= 0; i--) {
    const p = polys[i];
    if (kinds.includes(p.kind) && inside(p.pts, x, y)) return p;
  }
  return null;
}
export function inside(pts, x, y) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
