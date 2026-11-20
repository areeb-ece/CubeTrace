// The cube flattened into its cross net: every sticker at once, nothing hidden.
// paintNet draws and nothing else.
import { stickers, gridOf } from "../lib/cube.js";
import { rimMap, cycles } from "../lib/anatomy.js";
import { moveText } from "../lib/moves.js";
import { netLayout, netCell, netCells, cellAt, stepCell } from "../lib/layout2d.js";
import { posIndex } from "../lib/rot.js";
import { BODY } from "../palette.js";
import { mountCanvas } from "./canvas.js";
import { arrow } from "./draw.js";
import { look, paintStickers, asking, guideOf } from "./stickers.js";
import { trail, idAt } from "../lib/cells.js";

const round = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// What the move does on the net: each rim triplet's arrow to where it goes, and the
// turning face's corner and edge cycles (corners solid, edges dashed).
const memo = new Map();
function anatomy(m) {
  const key = moveText(m);
  if (!memo.has(key)) memo.set(key, { rim: rimMap(m), cyc: cycles(m) });
  return memo.get(key);
}
function drawAnatomy(ctx, pal, l, m, faint) {
  const { rim, cyc } = anatomy(m);
  const mid = (p) => { const c = netCell(l, p.face, p.row, p.col); return [c.x + c.size / 2, c.y + c.size / 2]; };
  const alpha = faint ? 0.5 : 1, shy = l.cell * 0.55;
  const pull = (a, b, k) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / d) * k, a[1] + ((b[1] - a[1]) / d) * k]; };
  for (const tri of rim || []) {
    const a = mid(tri.from[1]), b = mid(tri.to[1]);
    arrow(ctx, pal, pull(a, b, shy), pull(b, a, shy), { bend: 0.18, alpha, head: Math.max(6, l.cell * 0.28) });
  }
  if (!cyc) return;
  const swap = cyc.half;
  for (const [ring, dash] of [[cyc.corners, false], [cyc.edges, true]]) {
    const pts = ring.map(mid), k = ring.length;
    for (let i = 0; i < (swap ? k / 2 : k); i++) {
      const a = pts[i], b = pts[swap ? i + k / 2 : (i + 1) % k];
      arrow(ctx, pal, pull(a, b, l.cell * 0.36), pull(b, a, l.cell * 0.36), { dash, both: swap, width: 2, head: Math.max(4.5, l.cell * 0.17), alpha, color: pal.ink2 });
    }
  }
}

// Where a tracked piece has been: a dotted path through the cells of its reference
// sticker, one hop per place it sat in, ending in an arrowhead where it is now. What it
// has yet to do is fainter. path is trail()'s list, cur the index of the state shown.
function drawTrail(ctx, pal, l, path, cur) {
  const mid = (c) => { const r = netCell(l, c.face, c.row, c.col); return [r.x + r.size / 2, r.y + r.size / 2]; };
  const at = path.reduce((k, c, j) => (c.i <= cur ? j : k), 0);
  for (let j = 0; j + 1 < path.length; j++) {
    const done = j + 1 <= at;
    arrow(ctx, pal, mid(path[j]), mid(path[j + 1]), { bend: 0.15, dots: true, width: 2.5, head: Math.max(5, l.cell * 0.22), alpha: done ? 1 : 0.4, color: pal.trail, noHead: j + 1 !== at });
  }
}

/**
 * g = { ctx, w, h, pal }, o = { look, letters, guide, trail, cursor }.
 * look: stickers.js's look() of this state. guide { move, faint } draws the move's rim and
 * cycle arrows. trail { path, cur } draws a tracked piece's path. cursor { face, row, col }
 * rings the sticker the keyboard is on.
 */
export function paintNet(g, state, o = {}) {
  const { ctx, w, h, pal } = g;
  const l = netLayout(w, h);
  ctx.save();
  // each face sits on its own piece of plastic, as on a real cube
  const pad = l.gap * 0.6, side = 3 * l.cell + 2 * l.gap;
  for (const face of "UDLRFB") {
    const a = netCell(l, face, 0, 0);
    round(ctx, a.x - pad, a.y - pad, side + 2 * pad, side + 2 * pad, l.cell * 0.2);
    ctx.fillStyle = BODY;
    ctx.fill();
  }
  const rect = (face, row, col) => { const c = netCell(l, face, row, col); return { x: c.x, y: c.y, w: c.size, h: c.size }; };
  paintStickers(g, state, o.look, rect, stickers(state), { letters: o.letters });
  // the face names are a key to the net, so they stay if there is room for them
  if (l.faceGap >= 9) {
    ctx.fillStyle = pal.ink3;
    ctx.font = `700 ${Math.min(14, l.faceGap * 0.7)}px ${pal.mono}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    for (const face of "UDLRFB") {
      const a = netCell(l, face, 0, 0);
      ctx.fillText(face, a.x - pad, a.y - pad - l.faceGap * 0.1);
    }
  }
  if (o.trail) drawTrail(ctx, pal, l, o.trail.path, o.trail.cur);
  if (o.guide) drawAnatomy(ctx, pal, l, o.guide.move, o.guide.faint);
  if (o.cursor) {
    const r = rect(o.cursor.face, o.cursor.row, o.cursor.col);
    ctx.strokeStyle = pal.alpha("bg", 0.8);
    ctx.lineWidth = 5;
    round(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, r.w * 0.2);
    ctx.stroke();
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
  }
  ctx.restore();
}

/** The tracked piece's path through the moves, or null. */
const trailOf = (s) => {
  if (s.track == null) return null;
  const path = trail(s.trace.states, s.track);
  return path.length > 1 ? { path, cur: s.trace.states.indexOf(s.state) } : null;
};
/** What the page draws for store state s (cursor: the keyboard's sticker, if the net has focus). */
export const netProps = (s, cursor = null) => ({ look: look(s, s.state), letters: s.opts.letters, guide: guideOf(s), trail: asking(s) ? null : trailOf(s), cursor });

const NET_LABEL = "Net of the cube, unfolded: U above F, with L, F, R, B in a row and D below. Arrow keys move between stickers; Enter follows the piece, or in Predict chooses the slot.";

/** api: { answer(pos, el) } names a slot (Predict). */
export function mountNet(el, store, api = {}) {
  let cursor = null, focused = false;
  const view = mountCanvas(el, store, (g, s) => paintNet(g, s.state, netProps(s, focused ? cursor : null)), NET_LABEL);
  const { canvas } = view;
  // a canvas with its own keys: tell assistive tech it isn't a picture
  canvas.setAttribute("role", "application");
  canvas.tabIndex = 0;
  const cells = () => netCells(netLayout(canvas.clientWidth, canvas.clientHeight));
  const idUnder = (c) => (c ? idAt(store.state.state, c.face, c.row, c.col) : null);
  const brush = (id) => { if (store.state.hover !== id) store.set("hover", id); };
  const toggle = (id) => { if (id != null) store.set("track", store.state.track === id ? null : id); };
  // Predict: a click or Enter names the slot under it; otherwise it follows the piece
  const choose = (c) => {
    const s = store.state;
    if (s.mode === "predict" && s.predict?.phase === "ask") api.answer?.(posIndex(gridOf(c.face, c.row, c.col)), canvas);
    else toggle(idUnder(c));
  };
  const pointAt = (e) => { const r = canvas.getBoundingClientRect(); return cellAt(cells(), e.clientX - r.left, e.clientY - r.top); };
  canvas.style.setProperty("cursor", "pointer");
  canvas.addEventListener("pointermove", (e) => brush(idUnder(pointAt(e))));
  canvas.addEventListener("pointerleave", () => { if (!focused) brush(null); });
  canvas.addEventListener("click", (e) => { const c = pointAt(e); if (c) { cursor = { face: c.face, row: c.row, col: c.col }; choose(c); } });
  canvas.addEventListener("focus", () => {
    focused = true;
    cursor ||= { face: "F", row: 1, col: 1 };
    brush(idUnder(cursor));
    view.draw();
  });
  canvas.addEventListener("blur", () => { focused = false; brush(null); view.draw(); });
  canvas.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      const all = cells(), from = all.find((c) => c.face === cursor.face && c.row === cursor.row && c.col === cursor.col);
      const to = stepCell(all, from, ...dir);
      cursor = { face: to.face, row: to.row, col: to.col };
      brush(idUnder(to));
      view.draw();
    } else if (e.key === "Enter" || e.key === " ") choose(cursor);
    else return;
    e.preventDefault();
  });
  return {
    update(s) {
      // moves change which piece the cursor is on
      if (focused) brush(idAt(s.state, cursor.face, cursor.row, cursor.col));
      canvas.dataset.holes = String(look(s, s.state).holes.length);
      canvas.dataset.track = s.track ?? "";
      canvas.dataset.target = s.mode === "predict" ? s.predict?.target ?? "" : "";
      view.draw();
    },
  };
}

export default { id: "net", title: "Net", mount: mountNet };
