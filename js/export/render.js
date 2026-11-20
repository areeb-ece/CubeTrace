// A saved image, drawn: the chosen views side by side, each drawn by the same paint
// function that draws it on the page, with an optional title block and the credit line.
// Nothing here draws a cube, a net or a layer itself (CLAUDE.md: paint functions only).
//
// spec = { views: ["cube", "net", "ll"] (in the order to draw), width (pixels),
//          theme ("current" | "dark" | "light" | any theme name), transparent,
//          title: { name, alg } | null }
import { palette } from "../palette.js";
import { paintCube, cubeProps } from "../views/cube.js";
import { paintNet, netProps } from "../views/net.js";
import { paintLL, llProps } from "../views/ll.js";
import { layoutPicture, shapeOf, pixelSize, CREDIT, LAYOUT_WIDTH, PAD } from "../lib/picture.js";

const LINE = 22, NAME_SIZE = 20, ALG_SIZE = 15, MAX_LINES = 3;

/**
 * The page's store state as it is at one moment of the algorithm: `index` moves done and
 * the next one turned t of the way. Hover and Predict's question are left out: a picture
 * shows the position, not the pointer, and never gives an answer away.
 */
export function frameState(s, index, t) {
  const states = s.trace.states, moves = s.seq.moves, turning = t > 0 && index < moves.length;
  return {
    ...s, mode: "learn", predict: null, hover: null, play: { ...s.play, index, t: turning ? t : 0 },
    state: states[index], shown: { state: states[index], turn: turning ? { move: moves[index], t } : null },
    guide: turning ? { move: moves[index], t, faint: false } : null,
  };
}
/** The page as it is now: its own position, guides and all. */
export function nowState(s) {
  return { ...s, guide: s.mode === "predict" ? null : s.guide, mode: "learn", predict: null, hover: null };
}

// words wrapped to a width, at most `max` lines, the last ending in "…" if more would not fit
function wrap(ctx, text, width, max) {
  const words = text.split(/\s+/).filter(Boolean), lines = [];
  let line = "", i = 0;
  for (; i < words.length; i++) {
    const next = line ? line + " " + words[i] : words[i];
    if (line && ctx.measureText(next).width > width) {
      if (lines.length === max - 1) break;
      lines.push(line);
      line = words[i];
    } else line = next;
  }
  if (i < words.length) line = line.replace(/\s*\S*$/, "") + " …";
  if (line) lines.push(line);
  return lines;
}

/** What the title block says and how tall it is, at the layout's scale. */
function titleBlock(ctx, spec, pal) {
  const t = spec.title;
  if (!t || (!t.name && !t.alg)) return null;
  ctx.font = `${ALG_SIZE}px ${pal.mono}`;
  const alg = t.alg ? wrap(ctx, t.alg, LAYOUT_WIDTH - 2 * PAD, MAX_LINES) : [];
  return { name: t.name || "", alg, height: (t.name ? NAME_SIZE + 6 : 0) + alg.length * LINE + 4 };
}

/** Where everything goes, and the canvas size in pixels. Same for every frame of a GIF. */
export function planPicture(canvas, spec, s) {
  const pal = palette(spec.theme), ctx = canvas.getContext("2d", { willReadFrequently: true });
  const block = titleBlock(ctx, spec, pal);
  const mirrors = !!s.opts.mirrors;
  const layout = layoutPicture({ views: spec.views.map((id) => ({ id, shape: shapeOf(id, mirrors) })), titleH: block?.height || 0 });
  return { layout, block, ...pixelSize(layout, spec.width) };
}

export function renderFrame(canvas, spec, s, plan = planPicture(canvas, spec, s)) {
  const { layout, block } = plan, pal = palette(spec.theme), ctx = canvas.getContext("2d", { willReadFrequently: true });
  const scale = plan.width / layout.width;
  if (canvas.width !== plan.width || canvas.height !== plan.height) { canvas.width = plan.width; canvas.height = plan.height; }
  ctx.setTransform(scale, 0, 0, plan.height / layout.height, 0, 0);
  ctx.clearRect(0, 0, layout.width, layout.height);
  if (!spec.transparent) { ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, layout.width, layout.height); }
  ctx.textBaseline = "alphabetic";

  if (block && layout.title) {
    let y = layout.title.y;
    ctx.textAlign = "left";
    if (block.name) {
      ctx.font = `700 ${NAME_SIZE}px ${pal.text}`;
      ctx.fillStyle = pal.ink;
      ctx.fillText(block.name, PAD, y + NAME_SIZE);
      y += NAME_SIZE + 6;
    }
    ctx.font = `${ALG_SIZE}px ${pal.mono}`;
    ctx.fillStyle = pal.ink2;
    for (const line of block.alg) { ctx.fillText(line, PAD, y + ALG_SIZE + 2); y += LINE; }
  }

  for (const c of layout.cells) {
    if (!spec.transparent) { ctx.fillStyle = pal.sheet; ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 10); ctx.fill(); }
    ctx.save();
    ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    ctx.translate(c.x, c.y);
    const g = { ctx, w: c.w, h: c.h, pal };
    if (c.id === "cube") paintCube(g, s.shown.state, cubeProps(s));
    else if (c.id === "net") paintNet(g, s.state, netProps(s));
    else { const f = llProps(s); paintLL(g, f.state, f.props); }
    ctx.restore();
  }

  // the credit, bottom right
  const y = layout.credit.y + layout.credit.h / 2 + 1;
  ctx.textBaseline = "middle";
  ctx.font = `12px ${pal.mono}`;
  const siteW = ctx.measureText(CREDIT).width;
  ctx.textAlign = "left"; ctx.fillStyle = pal.accent;
  ctx.fillText(CREDIT, layout.width - PAD - siteW, y);
  ctx.font = `700 12px ${pal.text}`; ctx.fillStyle = pal.ink2; ctx.textAlign = "right";
  ctx.fillText("made by areeb · ", layout.width - PAD - siteW, y);
  return canvas;
}
