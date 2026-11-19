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

/** How far (signed, along the axis) the turning slab is lifted at progress t: outer slabs only. */
export function liftOf(m, t) {
  if (m.layers.length >= 3 || m.layers.includes(0)) return 0;
  return LIFT * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * Math.sign(m.layers[0]);
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
  const lift = tm ? liftOf(tm, t) : 0;
  const inSlab = (id) => !!tm && tm.layers.includes(POS[s.pos[id]][tm.axis]);
  const place = (id, p) => {
    if (!inSlab(id)) return p;
    let q = rotateAbout(p, tm.axis, angle);
    if (lift) q = add(q, scale(AXES[tm.axis], lift));
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

/** Convex hull of 2D points (Andrew's monotone chain), counter-clockwise on screen axes. */
export function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const q of list) {
      while (out.length > 1 && cr(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return half(p).concat(half(p.slice().reverse()));
}

// ── turn anatomy ──
// Which side of the cube a move's arrow sits on: the face the move follows (M follows L,
// E follows D, S follows F; x like R, y like U, z like F; a wide move like its face).
const FOLLOWS = { R: 1, L: -1, U: 1, D: -1, F: 1, B: -1, M: -1, E: -1, S: 1, x: 1, y: 1, z: 1, r: 1, l: -1, u: 1, d: -1, f: 1, b: -1 };
const ARROW_SIDE = 1.75;  // the arrow's plane, just outside the face (the cube's half-width is 1.5)
const ARROW_R = 1.25;     // the arrow's radius about the axis
const ARROW_SWEEP = (260 * Math.PI) / 180;
const ARROW_HEAD = 0.32;  // radians of arc the head covers
const AXIS_REACH = 1.5 + 0.9;

/**
 * What a turn draws besides the cube, projected like buildScene's polygons:
 *   slab   the outline of the turning layers (convex hull of their box, turned and lifted as in the scene)
 *   axis   [[x, y], [x, y]]: the line the slab turns about, reaching 0.9 past the cube both ways
 *   arc    the arrow's shaft; arc3 the same in world coordinates
 *   heads  arrowhead triangles (two for a half turn); double: true for a half turn
 *   side   +1 or -1: which side of the cube the arrow is on
 * The arrow runs the way the pieces turn (rotateAbout with moveAngle's sign), and its
 * gap is turned away from the camera so the visible part is whole.
 */
export function turnGuides(state, m, t = 0, camera = DEFAULT_CAMERA) {
  const cam = cameraBasis(camera), ax = m.axis;
  const flat = (p) => projectPoint(cam, p).slice(0, 2);
  const e1 = AXES[(ax + 1) % 3], e2 = AXES[(ax + 2) % 3]; // e2 = axis × e1: positive turns go e1 → e2
  const at = (a, b, c) => { const p = [0, 0, 0]; p[ax] = a; p[(ax + 1) % 3] = b; p[(ax + 2) % 3] = c; return p; };

  const angle = moveAngle(m) * t, lift = liftOf(m, t);
  const lo = Math.min(...m.layers) - HALF, hi = Math.max(...m.layers) + HALF, W = 3 * HALF;
  const slab = hull([lo, hi].flatMap((a) => [-W, W].flatMap((b) => [-W, W].map((c) => {
    const q = rotateAbout(at(a, b, c), ax, angle);
    q[ax] += lift;
    return flat(q);
  }))));

  const axis = [-AXIS_REACH, AXIS_REACH].map((a) => flat(at(a, 0, 0)));

  const side = FOLLOWS[m.name], sgn = m.q === 3 ? -1 : 1;
  const centre = scale(AXES[ax], side * ARROW_SIDE);
  const radial = (phi) => add(scale(e1, Math.cos(phi)), scale(e2, Math.sin(phi)));
  const onRing = (phi) => add(centre, scale(radial(phi), ARROW_R));
  const away = scale(cam.eye, -1);
  const au = dot(away, e1), av = dot(away, e2);
  const gapAt = Math.hypot(au, av) < 1e-3 ? Math.PI / 2 : Math.atan2(av, au);
  const gap = 2 * Math.PI - ARROW_SWEEP;
  const phi0 = gapAt + sgn * (gap / 2), phiEnd = phi0 + sgn * ARROW_SWEEP;
  const N = 48, phiBase = phiEnd - sgn * ARROW_HEAD;
  const arc3 = [];
  for (let k = 0; k <= N; k++) arc3.push(onRing(phi0 + ((phiBase - phi0) * k) / N));
  const head = (phi) => {
    const base = phi - sgn * ARROW_HEAD, r = radial(base);
    return [onRing(phi), add(onRing(base), scale(r, 0.14)), add(onRing(base), scale(r, -0.14))].map(flat);
  };
  const heads = [head(phiEnd)];
  if (m.q === 2) heads.push(head((phi0 + phiEnd) / 2));
  return { slab, axis, arc: arc3.map(flat), arc3, heads, double: m.q === 2, side };
}

/**
 * The 12 edges of the cubie-sized box at grid position `pos` (an index, as in rot.js),
 * projected like buildScene's polygons: [{ a: [x, y], b: [x, y], visible }]. visible is
 * true for an edge on an outer face of the cube that faces the camera: the others lie
 * inside the cube, behind other pieces, and are not worth drawing. A ghost is the
 * dashed outline of where a piece was.
 */
export function ghostEdges(pos, camera = DEFAULT_CAMERA) {
  const cam = cameraBasis(camera), c = POS[pos], out = [];
  // the face of the box with normal ±axis k: on the cube's skin, and turned toward the eye
  const shows = (k, sgn) => {
    if (c[k] * sgn !== 1) return false;
    const n = [0, 0, 0];
    n[k] = sgn;
    return dot(n, sub(cam.eye, add(c, scale(n, HALF)))) > 0;
  };
  for (let k = 0; k < 3; k++) {
    const a = (k + 1) % 3, b = (k + 2) % 3;
    for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      const end = (t) => {
        const q = c.slice();
        q[k] += t * HALF; q[a] += sa * HALF; q[b] += sb * HALF;
        return projectPoint(cam, q).slice(0, 2);
      };
      out.push({ a: end(-1), b: end(1), visible: shows(a, sa) || shows(b, sb) });
    }
  }
  return out;
}
