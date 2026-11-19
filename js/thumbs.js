// The small pictures in the case grid. They are painted by the views' own paint
// functions (the last-layer diagram for the last-layer steps, the cube for the rest), so
// a thumbnail can never disagree with the panels, in any theme.
import { paintLL } from "./views/ll.js";
import { paintCube } from "./views/cube.js";
import { look } from "./views/stickers.js";
import { palette } from "./palette.js";
import { DEFAULT_CAMERA } from "./lib/scene.js";

const LL_STEPS = new Set(["oll", "pll", "oll2", "pll2"]);
/** Is this step drawn as a last-layer diagram? */
export const isLL = (step) => LL_STEPS.has(step.id);

/** Paints case c of step onto canvas at its CSS size; false while it has none (not laid out yet). */
export function drawThumb(canvas, step, c) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const g = { ctx, w, h, pal: palette() };
  const lk = look({ opts: { roleSet: step.roles, full: false }, start: c.start, meet: null, hover: null, track: null }, c.start);
  // at this size an outline round every last-layer piece is noise: the colours say it
  if (isLL(step)) paintLL(g, c.start, { look: { ...lk, marks: false } });
  else paintCube(g, c.start, { camera: DEFAULT_CAMERA, mirrors: false, look: lk });
  return true;
}
