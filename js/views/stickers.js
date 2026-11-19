// How a sticker looks, in every view: one place, so the cube, the net and the last-layer
// diagram colour and mark pieces the same way (PLAN.md section 6).
//   focus     full colour, and an accent outline round the piece (only where there is
//             anything else to tell it from: with "All pieces" it would outline the cube)
//   kept      its colour quieted toward the sheet (palette.js keptColour)
//   top-only  only the sticker of the up colour keeps its colour; the piece's others are ignored
//   ignored   one flat grey from the theme
//   centre    full colour
// "Full colour" turns all of that off but the outlines. A displaced kept piece is
// hatched, and the cubie boxes it left are ghosts. A piece is brushed (hover) or
// tracked (track) by its cubie id, so its outline follows it.
import { STICKERS, LETTERS, inkOn } from "../palette.js";
import { roles, upColour, displaced } from "../lib/roles.js";
import { cellsOf } from "../lib/cells.js";
import { hatch, dashed } from "./draw.js";

/** The role sets, as the chooser names them. */
export const ROLE_NAMES = {
  all: "All pieces",
  "white-cross": "White cross",
  "white-corners": "White corners",
  "second-layer": "Second layer",
  "yellow-cross": "Yellow cross",
  "yellow-edges": "Yellow edges",
  "yellow-corners": "Yellow corners",
  cross: "CFOP cross",
  f2l: "F2L pair (right slot)",
  "f2l-left": "F2L pair (left slot)",
  oll: "OLL",
  pll: "PLL",
};

const memo = new Map();
function rolesFor(name) {
  if (!memo.has(name)) {
    const roleOf = roles(name);
    // outlines only say something where some pieces are not focus
    memo.set(name, { roleOf, up: upColour(name), marks: roleOf.some((r) => r === "kept" || r === "top-only" || r === "ignored") });
  }
  return memo.get(name);
}

// the pieces both halves of a commutator move: a Set made once per list
let meetFor = null, meetSetOf = null;
const meetSet = (ids) => {
  if (!ids) return null;
  if (ids !== meetFor) { meetFor = ids; meetSetOf = new Set(ids); }
  return meetSetOf;
};

/**
 * What the views need to know about the pieces, for the cube `now` (the one being drawn):
 * { roleOf, up, full, marks, away (displaced kept ids), holes, start, hover, track }.
 * s is the store's state.
 */
export function look(s, now) {
  const { roleOf, up, marks } = rolesFor(s.opts.roleSet);
  const { displaced: away, holes } = displaced(roleOf, s.start, now);
  return { roleOf, up, marks, meet: meetSet(s.meet), full: !!s.opts.full, away, holes, start: s.start, hover: s.hover, track: s.track };
}

/** The fill of a sticker of piece id whose colour is home's, and whether it is drawn as ignored (grey). */
export function stickerFill(pal, lk, id, home) {
  const role = lk.roleOf[id];
  if (lk.full || role === "focus" || role === "centre") return { fill: STICKERS[home], grey: false };
  if (role === "kept") return { fill: pal.kept[home], grey: false };
  if (role === "top-only" && home === lk.up) return { fill: STICKERS[home], grey: false };
  return { fill: pal.ignored, grey: true };
}

/** The letter's colour on a sticker that has one, or null when there should be none. */
export const letterInk = (st) => (st.grey ? null : inkOn(st.fill));
export { LETTERS };

/**
 * The outlines to draw round pieces, in painting order: [{ id, color, width, dash? }].
 * Focus is solid; where a commutator's halves meet it is dashed (on a halo of the ground).
 */
export function outlines(pal, lk) {
  const out = [];
  if (lk.marks) lk.roleOf.forEach((r, id) => { if (r === "focus") out.push({ id, color: pal.accent, width: 2.5 }); });
  if (lk.meet) for (const id of lk.meet) out.push({ id, color: pal.alpha("bg", 0.8), width: 6 }, { id, color: pal.accent, width: 3, dash: [5, 4] });
  if (lk.hover != null) out.push({ id: lk.hover, color: pal.ink, width: 3 });
  if (lk.track != null) out.push({ id: lk.track, color: pal.trail, width: 3.5 });
  return out;
}

const round = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/**
 * Stickers on a flat view: the net and the last-layer diagram. rect(face, row, col) gives
 * a sticker's { x, y, w, h } or null (not shown). o.letters: write the colour letters.
 * Draws the stickers, the hatching on displaced ones, the ghosts of the holes, then the
 * outlines of focus, brushed and tracked pieces. Nothing else (no frames, no text).
 */
export function paintStickers(g, state, lk, rect, stickerList, o = {}) {
  const { ctx, pal } = g;
  const byId = new Map();
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const st of stickerList) {
    const r = rect(st.face, st.row, st.col);
    if (!r) continue;
    const look1 = stickerFill(pal, lk, st.id, st.home), radius = Math.min(r.w, r.h) * 0.14;
    round(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fillStyle = look1.fill;
    ctx.fill();
    const ink = o.letters && Math.min(r.w, r.h) >= 14 ? letterInk(look1) : null;
    if (ink) {
      ctx.fillStyle = ink;
      ctx.font = `700 ${Math.min(r.w, r.h) * 0.5}px ${pal.mono}`;
      ctx.fillText(LETTERS[st.home], r.x + r.w / 2, r.y + r.h / 2);
    }
    if (lk.away.has(st.id)) hatch(ctx, pal, () => round(ctx, r.x, r.y, r.w, r.h, radius), [r.x, r.y, r.x + r.w, r.y + r.h]);
    if (!byId.has(st.id)) byId.set(st.id, []);
    byId.get(st.id).push(r);
  }
  // a ghost: dashed outlines round the cells the piece that is away had at the start
  for (const hole of lk.holes) {
    for (const c of cellsOf(lk.start, hole.id)) {
      const r = rect(c.face, c.row, c.col);
      if (r) dashed(ctx, pal, () => round(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, Math.min(r.w, r.h) * 0.2));
    }
  }
  for (const { id, color, width, dash } of outlines(pal, lk)) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.setLineDash(dash || []);
    for (const r of byId.get(id) || []) { round(ctx, r.x - 1, r.y - 1, r.w + 2, r.h + 2, Math.min(r.w, r.h) * 0.18); ctx.stroke(); }
  }
  ctx.restore();
}
