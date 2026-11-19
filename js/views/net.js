// The cube flattened into its cross net: every sticker at once, nothing hidden.
// paintNet draws and nothing else.
import { stickers } from "../lib/cube.js";
import { netLayout, netCell } from "../lib/layout2d.js";
import { BODY, STICKERS, LETTERS, inkOn } from "../palette.js";
import { mountCanvas } from "./canvas.js";

const round = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/** g = { ctx, w, h, pal }, o = { letters }. */
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
  ctx.restore();
}

export function mountNet(el, store) {
  const view = mountCanvas(el, store, (g, s) => paintNet(g, s.state, { letters: s.opts.letters }), "Net of the cube, unfolded: U above F, with L, F, R, B in a row and D below");
  return { update: () => view.draw() };
}

export default { id: "net", title: "Net", mount: mountNet };
