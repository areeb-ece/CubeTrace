// A canvas that fills its panel and is drawn by a paint function (never by the view):
// sharp at any devicePixelRatio, redrawn when the panel resizes or the store changes.
import { palette } from "../palette.js";

/** paint(g, state) with g = { ctx, w, h, pal }; w and h are CSS pixels. */
export function mountCanvas(el, store, paint, label) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", label);
  const plot = document.createElement("div");
  plot.className = "plot";
  plot.append(canvas);
  el.append(plot);
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = 0;
  function size() {
    const r = devicePixelRatio || 1, cw = plot.clientWidth, ch = plot.clientHeight;
    if (cw === w && ch === h && r === dpr) return false;
    w = cw; h = ch; dpr = r;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    return true;
  }
  function draw() {
    size();
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    paint({ ctx, w, h, pal: palette() }, store.state);
  }
  new ResizeObserver(draw).observe(plot);
  draw();
  return { canvas, draw, update: draw, setLabel: (t) => canvas.setAttribute("aria-label", t) };
}
