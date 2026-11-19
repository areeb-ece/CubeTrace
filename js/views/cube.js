// The cube in 3D: Canvas 2D, painted from lib/scene.js's polygons (PLAN.md D2).
// paintCube draws and nothing else; mountCube adds the canvas, dragging to orbit and the
// spring back.
import { buildScene, cameraBasis, DEFAULT_CAMERA } from "../lib/scene.js";
import { BODY, STICKERS, LETTERS, inkOn } from "../palette.js";
import { mountCanvas } from "./canvas.js";

const MARGIN = 0.92; // how much of the panel the cube and its panes may fill

// Half the width and height the drawing needs, from the default camera, so the cube
// keeps its size and place while it's turned. Mirror panes decide it when they're on.
const reach = new Map();
function extent(mirrors) {
  if (!reach.has(mirrors)) {
    let x = 0, y = 0;
    for (const p of buildScene(solvedProbe(), { camera: DEFAULT_CAMERA, mirrors })) for (const [px, py] of p.pts) { x = Math.max(x, Math.abs(px)); y = Math.max(y, Math.abs(py)); }
    reach.set(mirrors, [x, y]);
  }
  return reach.get(mirrors);
}
// Positions don't change what is reached, so one fixed state will do.
function solvedProbe() {
  const pos = new Int8Array(27), ori = new Int8Array(27);
  for (let i = 0; i < 27; i++) pos[i] = i;
  return { pos, ori };
}

function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const out = [];
    for (const q of list) {
      while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return half(p).concat(half(p.slice().reverse()));
}

function path(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/**
 * g = { ctx, w, h, pal }, o = { camera, mirrors, letters, turn }.
 */
export function paintCube(g, state, o = {}) {
  const { ctx, w, h, pal } = g;
  const mirrors = !!o.mirrors;
  const polys = buildScene(state, { camera: o.camera || DEFAULT_CAMERA, turn: o.turn, mirrors });
  const [ex, ey] = extent(mirrors);
  const k = Math.min((w / 2) * MARGIN / ex, (h / 2) * MARGIN / ey);
  const at = ([x, y]) => [w / 2 + x * k, h / 2 + y * k];
  ctx.save();
  ctx.lineJoin = "round";
  const bodyPts = [], paneFaces = {};
  // the panes' frames go on before the cube, which covers whatever of them it hides
  let framed = false;
  const frames = () => {
    framed = true;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.rule;
    ctx.lineWidth = 1;
    for (const pts of Object.values(paneFaces)) { path(ctx, hull(pts)); ctx.stroke(); }
  };
  const fillLetter = (p) => {
    const q = p.pts.map(at), cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
    const side = Math.sqrt(Math.abs((q[1][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[3][0] - q[0][0])));
    if (side < 10) return;
    ctx.fillStyle = inkOn(STICKERS[p.home]);
    ctx.font = `700 ${side * 0.55}px ${pal.mono}`;
    ctx.fillText(LETTERS[p.home], cx, cy);
  };
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of polys) {
    const pts = p.pts.map(at), mirror = p.kind === "mirror" || p.kind === "mirror-body";
    if (!mirror && !framed) frames();
    ctx.globalAlpha = mirror ? 0.85 : 1;
    if (p.kind === "body" || p.kind === "mirror-body") {
      // a hairline of the same plastic closes the seams between neighbouring cubies
      path(ctx, pts);
      ctx.fillStyle = BODY;
      ctx.fill();
      ctx.strokeStyle = BODY;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (p.kind === "body") bodyPts.push(...pts);
      else (paneFaces[p.face] ||= []).push(...pts);
    } else {
      path(ctx, pts);
      ctx.fillStyle = STICKERS[p.home];
      ctx.fill();
      if (o.letters) fillLetter(p);
    }
  }
  ctx.globalAlpha = 1;
  if (!framed) frames();
  if (bodyPts.length) { ctx.strokeStyle = pal.ink3; path(ctx, hull(bodyPts)); ctx.stroke(); }
  ctx.restore();
}

const FACE_WORD = { U: "up", D: "down", L: "left", R: "right", F: "front", B: "back" };
/** Which faces face the camera, in words: "Cube seen from the up, front and right faces". */
export function describeView(camera) {
  const eye = cameraBasis(camera).eye;
  const n = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
  const words = Object.keys(n).filter((f) => n[f].reduce((s, v, i) => s + v * eye[i], 0) > 0).map((f) => FACE_WORD[f]);
  return `Cube seen from the ${words.slice(0, -1).join(", ")}${words.length > 1 ? " and " : ""}${words.at(-1)} faces`;
}

const PITCH_MAX = (80 * Math.PI) / 180;
const SPEED = 0.008; // radians of turn per pixel dragged

// the token's duration in ms ("180ms" or ".2s"), or 0
function tokenMs(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith("ms") ? n : n * 1000) : 0;
}

export function mountCube(el, store) {
  const view = mountCanvas(el, store, (g, s) => paintCube(g, s.state, { camera: s.camera, mirrors: s.opts.mirrors, letters: s.opts.letters }), describeView(store.state.camera));
  const { canvas } = view;
  canvas.style.setProperty("touch-action", "none");
  canvas.style.setProperty("cursor", "grab");
  let raf = 0;
  const settle = () => cancelAnimationFrame(raf);

  function springBack() {
    const ms = tokenMs("--dur-3") * 2, from = store.state.camera, to = DEFAULT_CAMERA;
    if (!ms) { store.set("camera", { ...to }); return; }
    const TAU = Math.PI * 2;
    let dy = (to.yaw - from.yaw) % TAU;
    if (dy > Math.PI) dy -= TAU; else if (dy < -Math.PI) dy += TAU; // the short way round
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms), e = 1 - (1 - t) ** 3;
      store.set("camera", t >= 1 ? { ...to } : { ...from, yaw: from.yaw + dy * e, pitch: from.pitch + (to.pitch - from.pitch) * e });
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    settle();
    canvas.setPointerCapture(e.pointerId);
    canvas.style.setProperty("cursor", "grabbing");
    let x = e.clientX, y = e.clientY;
    const move = (ev) => {
      const c = store.state.camera;
      store.set("camera", { ...c, yaw: c.yaw - (ev.clientX - x) * SPEED, pitch: Math.max(-PITCH_MAX, Math.min(PITCH_MAX, c.pitch + (ev.clientY - y) * SPEED)) });
      x = ev.clientX; y = ev.clientY;
    };
    const up = () => {
      canvas.removeEventListener("pointermove", move);
      canvas.style.setProperty("cursor", "grab");
      if (store.state.opts.spring) springBack();
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up, { once: true });
    canvas.addEventListener("pointercancel", up, { once: true });
  });

  return {
    update(s, dirty) {
      if (dirty.has("camera")) view.setLabel(describeView(s.camera));
      view.draw();
    },
  };
}

export default { id: "cube", title: "Cube", mount: mountCube };
