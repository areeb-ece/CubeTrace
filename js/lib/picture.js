// What a saved picture is made of, as numbers: where each view goes on the sheet, and
// which moments of an algorithm a GIF shows. Pure: no DOM, so tests/picture.test.js runs it.

/** The credit line in the corner of every picture. */
export const CREDIT = "areeb-ece.github.io/CubeTrace";
/** Pictures are laid out at this many "page pixels" wide, then scaled to the size chosen. */
export const LAYOUT_WIDTH = 960;
export const PAD = 16, GAP = 12, FOOT = 26;
/** The widest a view may be drawn, as a share of the picture's width (one view alone). */
const MAX_HEIGHT = 0.62;

/** Width over height of each view's picture (the cube is wider with its mirror panes). */
export const SHAPES = { cube: 1.05, "cube-mirrors": 1.3, net: 1.3, ll: 1.1 };
export const shapeOf = (id, mirrors = false) => SHAPES[id === "cube" && mirrors ? "cube-mirrors" : id] ?? 1;

/** Picture widths in pixels, by the S/M/L the dialog offers: a still, and a GIF (which keeps the file small). */
export const WIDTHS = { png: { s: 960, m: 1440, l: 2160 }, gif: { s: 480, m: 720, l: 960 } };

/**
 * Views side by side, all the same height, as wide as fit in `width`.
 * views: [{ id, shape }] (width over height) in the order to draw. titleH: the title block's
 * height in layout pixels (0 for none). Returns { width, height, title, cells, credit },
 * every rectangle { x, y, w, h } in layout pixels.
 */
export function layoutPicture({ views, width = LAYOUT_WIDTH, titleH = 0 }) {
  const inner = width - 2 * PAD, n = views.length;
  const title = titleH > 0 ? { x: PAD, y: PAD, w: inner, h: titleH } : null;
  const top = PAD + (titleH > 0 ? titleH + GAP : 0);
  const shapes = views.reduce((s, v) => s + v.shape, 0);
  const h = n ? Math.min((inner - GAP * (n - 1)) / shapes, width * MAX_HEIGHT) : 0;
  const rowW = views.reduce((s, v) => s + v.shape * h, 0) + GAP * Math.max(0, n - 1);
  let x = PAD + (inner - rowW) / 2;
  const cells = views.map((v) => { const c = { id: v.id, x, y: top, w: v.shape * h, h }; x += c.w + GAP; return c; });
  const bottom = top + h + (n ? GAP : 0);
  return { width, height: Math.ceil(bottom + FOOT + PAD / 2), title, cells, credit: { x: PAD, y: bottom, w: inner, h: FOOT } };
}

/** Pixel size of a picture laid out at `layout` wide, drawn `width` wide: even numbers, as GIF and most players like. */
export function pixelSize(layout, width) {
  const even = (v) => Math.max(2, Math.round(v / 2) * 2);
  return { width: even(width), height: even((layout.height * width) / layout.width) };
}

const smooth = (u) => u * u * (3 - 2 * u);
export const HOLD = 90, PAUSE = 12, STEP = 5; // hundredths of a second: at each end, between moves, mid-turn

/**
 * The frames of a GIF of an algorithm of n moves: [{ index, t, delay }], meaning the cube
 * after `index` moves with moves[index] turned t of the way (0 for at rest). A few frames
 * a turn (fewer when the algorithm is long, to keep the file small), a short pause after
 * each move and a longer hold at the start and the end.
 */
export function gifPlan(n) {
  const per = n <= 8 ? 7 : n <= 16 ? 5 : n <= 30 ? 4 : 3;
  const frames = [{ index: 0, t: 0, delay: n ? HOLD : HOLD * 2 }];
  for (let i = 0; i < n; i++) {
    for (let k = 1; k < per; k++) frames.push({ index: i, t: smooth(k / per), delay: STEP });
    frames.push({ index: i + 1, t: 0, delay: i === n - 1 ? HOLD * 2 : PAUSE });
  }
  return frames;
}
