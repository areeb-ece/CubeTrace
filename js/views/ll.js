// The last layer from above, as OLL and PLL sheets draw it: the up face as a 3×3 square
// and the twelve side stickers of the top layer as strips round it, the front at the
// bottom. paintLL draws and nothing else. With "Net change" on it shows the sequence's
// start and what the whole sequence does to this layer: one arrow per cycle of pieces,
// a mark on each twisted corner or flipped edge.
import { stickers } from "../lib/cube.js";
import { topLayerChange } from "../lib/trace.js";
import { llLayout, llCell, llCentre } from "../lib/layout2d.js";
import { POS } from "../lib/rot.js";
import { idAt } from "../lib/cells.js";
import { BODY } from "../palette.js";
import { h } from "../ui.js";
import { mountCanvas } from "./canvas.js";
import { arrow } from "./draw.js";
import { look, paintStickers } from "./stickers.js";

const round = (ctx, x, y, w, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, hh, r); };

// A flipped edge's mark: two short arrows side by side, one up and one down (⇅), drawn
// rather than typed so it doesn't depend on a font having the glyph. Strokes with the
// current style.
function flipMark(ctx, x, y, s) {
  ctx.beginPath();
  for (const [dx, dir] of [[-s * 0.28, -1], [s * 0.28, 1]]) {
    const tip = y + dir * s * 0.5;
    ctx.moveTo(x + dx, y - dir * s * 0.5);
    ctx.lineTo(x + dx, tip);
    ctx.moveTo(x + dx - s * 0.22, tip - dir * s * 0.28);
    ctx.lineTo(x + dx, tip);
    ctx.lineTo(x + dx + s * 0.22, tip - dir * s * 0.28);
  }
  ctx.stroke();
}

// One mark on a piece's up sticker, off its middle where the arrows meet: + or − for a
// corner turned a third clockwise or anticlockwise, ⇅ for a flipped edge. Haloed.
function drawMark(ctx, pal, l, m) {
  const [cx, cy] = llCentre(l, POS[m.pos][0], POS[m.pos][2]), mx = cx + l.cell * 0.27, my = cy - l.cell * 0.27;
  const glyph = m.twist === 1 ? "+" : "−";
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${l.cell * 0.55}px ${pal.mono}`;
  ctx.strokeStyle = pal.alpha("bg", 0.85);
  ctx.lineWidth = 4.5;
  if (m.kind === "edge") flipMark(ctx, mx, my, l.cell * 0.44); else ctx.strokeText(glyph, mx, my);
  ctx.strokeStyle = pal.ink;
  ctx.fillStyle = pal.ink;
  ctx.lineWidth = 2;
  if (m.kind === "edge") flipMark(ctx, mx, my, l.cell * 0.44); else ctx.fillText(glyph, mx, my);
  ctx.restore();
}

// What the marks mean: the key, bottom left, naming only the marks that are drawn.
function drawKey(ctx, pal, l, marks, height) {
  const items = [];
  if (marks.some((m) => m.kind === "corner" && m.twist === 1)) items.push(["+", "clockwise third"]);
  if (marks.some((m) => m.kind === "corner" && m.twist === 2)) items.push(["−", "anticlockwise third"]);
  if (marks.some((m) => m.kind === "edge")) items.push(["flip", "flipped"]);
  if (!items.length) return;
  const size = Math.max(10, Math.min(13, l.cell * 0.34));
  ctx.save();
  ctx.font = `${size}px ${pal.text}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let y = height - size * (items.length * 1.5) - 4;
  const x = 8;
  for (const [glyph, words] of items) {
    ctx.fillStyle = pal.ink;
    if (glyph === "flip") { ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6; flipMark(ctx, x + size * 0.6, y + size * 0.75, size); }
    else { ctx.font = `700 ${size}px ${pal.mono}`; ctx.fillText(glyph, x + size * 0.2, y + size * 0.75); ctx.font = `${size}px ${pal.text}`; }
    ctx.fillStyle = pal.ink2;
    ctx.fillText(words, x + size * 1.5, y + size * 0.75);
    y += size * 1.5;
  }
  ctx.restore();
}

/**
 * g = { ctx, w, h, pal }, o = { look, letters, change }.
 * change: topLayerChange()'s result, drawn over the stickers (the state should then be the start).
 */
export function paintLL(g, state, o = {}) {
  const { ctx, w, h: height, pal } = g;
  const l = llLayout(w, height), rect = (face, row, col) => llCell(l, face, row, col);
  ctx.save();
  // the plastic round the stickers: the square, and a strip under each side sticker
  const pad = l.gap * 0.7;
  ctx.fillStyle = BODY;
  round(ctx, l.ux - pad, l.uy - pad, l.side + 2 * pad, l.side + 2 * pad, l.cell * 0.2);
  ctx.fill();
  for (const face of "FRBL") for (let col = 0; col < 3; col++) {
    const r = rect(face, 0, col);
    round(ctx, r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad, l.cell * 0.14);
    ctx.fill();
  }
  paintStickers(g, state, o.look, rect, stickers(state), { letters: o.letters });
  if (o.change) {
    const mid = (p) => llCentre(l, POS[p][0], POS[p][2]);
    const pull = (a, b, k) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / d) * k, a[1] + ((b[1] - a[1]) / d) * k]; };
    for (const { kind, ps } of o.change.cycles) {
      const pts = ps.map(mid), dash = kind === "edge", opts = { bend: 0.2, dash, width: 1.8, head: Math.max(4.5, l.cell * 0.17) };
      if (ps.length === 2) arrow(ctx, pal, pull(pts[0], pts[1], l.cell * 0.3), pull(pts[1], pts[0], l.cell * 0.3), { ...opts, both: true });
      else for (let i = 0; i < ps.length; i++) {
        const a = pts[i], b = pts[(i + 1) % ps.length];
        arrow(ctx, pal, pull(a, b, l.cell * 0.3), pull(b, a, l.cell * 0.3), opts);
      }
    }
    for (const m of o.change.marks) drawMark(ctx, pal, l, m);
    drawKey(ctx, pal, l, o.change.marks, height);
  }
  ctx.restore();
}

const LABEL = "Last layer seen from above, front at the bottom: the up face and the side stickers of the top layer.";

export function mountLL(el, store) {
  const toggle = h("button", { type: "button", "aria-pressed": "false", title: "Show the start of the moves and what they do to this layer, all at once", text: "Net change" });
  el.append(h("div", { class: "ll-bar" }, h("div", { class: "sd-seg" }, toggle)));
  toggle.addEventListener("click", () => store.set("opts", { ...store.state.opts, netChange: !store.state.opts.netChange }));
  const frame = (s) => {
    const states = s.trace.states, on = s.opts.netChange;
    const state = on ? states[0] : s.state;
    return { state, look: look(s, state), change: on ? topLayerChange(states[0], states[states.length - 1]) : null };
  };
  const view = mountCanvas(el, store, (g, s) => { const f = frame(s); paintLL(g, f.state, { look: f.look, letters: s.opts.letters, change: f.change }); }, LABEL);
  const { canvas } = view;
  const idUnder = (e) => {
    const s = store.state, r = canvas.getBoundingClientRect(), l = llLayout(r.width, r.height), x = e.clientX - r.left, y = e.clientY - r.top;
    const state = s.opts.netChange ? s.trace.states[0] : s.state;
    for (const st of stickers(state)) {
      const c = llCell(l, st.face, st.row, st.col);
      if (c && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return idAt(state, st.face, st.row, st.col);
    }
    return null;
  };
  canvas.style.setProperty("cursor", "pointer");
  canvas.addEventListener("pointermove", (e) => { const id = idUnder(e); if (store.state.hover !== id) store.set("hover", id); });
  canvas.addEventListener("pointerleave", () => { if (store.state.hover != null) store.set("hover", null); });
  canvas.addEventListener("click", (e) => { const id = idUnder(e); if (id != null) store.set("track", store.state.track === id ? null : id); });
  return {
    update(s) {
      toggle.setAttribute("aria-pressed", String(!!s.opts.netChange));
      canvas.dataset.change = s.opts.netChange ? "on" : "off";
      view.draw();
    },
  };
}

export default { id: "ll", title: "Last layer", mount: mountLL };
