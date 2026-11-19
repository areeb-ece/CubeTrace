// The cube in 3D: Canvas 2D, painted from lib/scene.js's polygons (PLAN.md D2).
// paintCube draws and nothing else; mountCube adds the canvas, dragging to orbit and the
// spring back.
import { buildScene, cameraBasis, turnGuides, hull, DEFAULT_CAMERA } from "../lib/scene.js";
import { move, moveText } from "../lib/moves.js";
import { BODY, STICKERS, LETTERS, inkOn } from "../palette.js";
import { tokenMs } from "../timing.js";
import { mountCanvas } from "./canvas.js";

const MARGIN = 0.92; // how much of the panel the cube and its panes may fill

// Half the width and height the drawing needs, from the default camera, so the cube
// keeps its size and place while it's turned. Mirror panes decide it when they're on.
const reach = new Map();
function extent(mirrors) {
  if (!reach.has(mirrors)) {
    let x = 0, y = 0;
    const grow = (pts) => { for (const [px, py] of pts) { x = Math.max(x, Math.abs(px)); y = Math.max(y, Math.abs(py)); } };
    for (const p of buildScene(solvedProbe(), { camera: DEFAULT_CAMERA, mirrors })) grow(p.pts);
    // the turn guides reach past the cube, and must not be cut off by the panel
    for (const name of "RLUDFBMES") { const g = turnGuides(null, move(name), 0, DEFAULT_CAMERA); grow(g.axis); grow(g.arc); }
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

function path(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// The turn anatomy: the turning slab outlined over a wash of the accent, the axis it
// turns about, and an arrow showing the way (haloed so it reads over plastic and sky).
// faint is the next move shown while paused.
function drawGuides(ctx, pal, tg, at, faint) {
  const k = faint ? 0.45 : 1;
  const poly = (pts) => { path(ctx, pts.map(at)); };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  poly(tg.slab);
  ctx.fillStyle = pal.alpha("accent", 0.18 * k);
  ctx.fill();
  ctx.strokeStyle = pal.alpha("accent", k);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  tg.axis.map(at).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = pal.alpha("ink3", 0.9 * k);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  const shaft = () => { ctx.beginPath(); tg.arc.map(at).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
  for (const [color, width, a] of [[pal.alpha("bg", 0.75 * k), 6, 1], [pal.alpha("ink", k), 2.5, 1]]) {
    shaft();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    for (const hd of tg.heads) { path(ctx, hd.map(at)); ctx.fillStyle = color; ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}

/**
 * g = { ctx, w, h, pal }, o = { camera, mirrors, letters, turn, guide }.
 * guide: { move, t, faint } draws the turn anatomy of that move over the cube.
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
  if (o.guide) drawGuides(ctx, pal, turnGuides(state, o.guide.move, o.guide.t, o.camera || DEFAULT_CAMERA), at, o.guide.faint);
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

export function mountCube(el, store) {
  const view = mountCanvas(el, store, (g, s) => paintCube(g, s.shown.state, { camera: s.camera, mirrors: s.opts.mirrors, letters: s.opts.letters, turn: s.shown.turn, guide: s.guide }), describeView(store.state.camera));
  const { canvas } = view;
  canvas.style.setProperty("touch-action", "none");
  canvas.style.setProperty("cursor", "grab");
  // The panel takes the keys (milestone 4): focus it, with a ring, and a click gives it focus.
  el.tabIndex = 0;
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Cube. Keys U D L R F B M E S x y z turn it; Space plays.");
  canvas.addEventListener("pointerdown", () => el.focus({ preventScroll: true }));
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
      // which move's anatomy is up, for anything that wants to know (and the browser check)
      canvas.dataset.guide = s.guide ? moveText(s.guide.move) : "";
      canvas.toggleAttribute("data-faint", !!s.guide?.faint);
      view.draw();
    },
  };
}

export default { id: "cube", title: "Cube", mount: mountCube };
