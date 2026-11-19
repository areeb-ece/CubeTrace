// The cube flattened into its cross net: every sticker at once, nothing hidden.
// paintNet draws and nothing else.
import { stickers } from "../lib/cube.js";
import { rimMap, cycles } from "../lib/anatomy.js";
import { moveText } from "../lib/moves.js";
import { netLayout, netCell } from "../lib/layout2d.js";
import { BODY, STICKERS, LETTERS, inkOn } from "../palette.js";
import { mountCanvas } from "./canvas.js";

const round = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// An arrow from a to b, bowed by `bend` (a fraction of its length), haloed so it reads on
// any sticker. both: a head at each end (a swap). dash: a dashed shaft (the shape cue
// that tells the edges' arrows from the corners').
function arrow(ctx, pal, a, b, { bend = 0, dash = false, both = false, width = 2.5, head = 7, alpha = 1, color = pal.ink } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const c = [(a[0] + b[0]) / 2 - (dy / len) * bend * len, (a[1] + b[1]) / 2 + (dx / len) * bend * len];
  // tangents at the ends, so the heads follow the bow
  const t1 = norm([c[0] - a[0], c[1] - a[1]]), t2 = norm([b[0] - c[0], b[1] - c[1]]);
  const tip = [b[0], b[1]], tail = [a[0], a[1]];
  const base = (p, t, s) => [p[0] - t[0] * head * s, p[1] - t[1] * head * s];
  const b2 = base(tip, t2, 1), a2 = both ? [a[0] + t1[0] * head, a[1] + t1[1] * head] : a;
  const tri = (p, t) => [[p[0], p[1]], [p[0] - t[0] * head - t[1] * head * 0.55, p[1] - t[1] * head + t[0] * head * 0.55], [p[0] - t[0] * head + t[1] * head * 0.55, p[1] - t[1] * head - t[0] * head * 0.55]];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [col, w] of [[pal.alpha("bg", 0.8 * alpha), width + 3.5], [color, width]]) {
    ctx.beginPath();
    ctx.moveTo(a2[0], a2[1]);
    ctx.quadraticCurveTo(c[0], c[1], b2[0], b2[1]);
    ctx.setLineDash(dash ? [width * 2.2, width * 1.8] : []);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.setLineDash([]);
    const heads = [tri(tip, t2)];
    if (both) heads.push(tri(tail, [-t1[0], -t1[1]]));
    for (const h of heads) { ctx.beginPath(); h.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}
const norm = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

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

/** g = { ctx, w, h, pal }, o = { letters, guide }: guide { move, faint } draws the move's rim and cycle arrows. */
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
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const s of stickers(state)) {
    const c = netCell(l, s.face, s.row, s.col);
    round(ctx, c.x, c.y, c.size, c.size, c.size * 0.14);
    ctx.fillStyle = STICKERS[s.home];
    ctx.fill();
    if (o.letters && c.size >= 14) {
      ctx.fillStyle = inkOn(STICKERS[s.home]);
      ctx.font = `700 ${c.size * 0.5}px ${pal.mono}`;
      ctx.fillText(LETTERS[s.home], c.x + c.size / 2, c.y + c.size / 2);
    }
  }
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
  if (o.guide) drawAnatomy(ctx, pal, l, o.guide.move, o.guide.faint);
  ctx.restore();
}

export function mountNet(el, store) {
  const view = mountCanvas(el, store, (g, s) => paintNet(g, s.state, { letters: s.opts.letters, guide: s.guide }), "Net of the cube, unfolded: U above F, with L, F, R, B in a row and D below");
  return { update: () => view.draw() };
}

export default { id: "net", title: "Net", mount: mountNet };
