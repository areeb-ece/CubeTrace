// Drawing pieces shared by the views. Everything here draws on a ctx it is given and
// touches nothing else.

const norm = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/**
 * An arrow from a to b, bowed by `bend` (a fraction of its length), haloed so it reads on
 * any sticker. both: a head at each end (a swap). noHead: just the shaft. dash: a dashed shaft (the shape cue
 * that tells the edges' arrows from the corners'). dots: a dotted shaft (a trail).
 */
export function arrow(ctx, pal, a, b, { bend = 0, dash = false, dots = false, both = false, noHead = false, width = 2.5, head = 7, alpha = 1, color = pal.ink } = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const c = [(a[0] + b[0]) / 2 - (dy / len) * bend * len, (a[1] + b[1]) / 2 + (dx / len) * bend * len];
  // tangents at the ends, so the heads follow the bow
  const t1 = norm([c[0] - a[0], c[1] - a[1]]), t2 = norm([b[0] - c[0], b[1] - c[1]]);
  const tip = [b[0], b[1]], tail = [a[0], a[1]];
  const base = (p, t, s) => [p[0] - t[0] * head * s, p[1] - t[1] * head * s];
  const b2 = noHead ? tip : base(tip, t2, 1), a2 = both ? [a[0] + t1[0] * head, a[1] + t1[1] * head] : a;
  const tri = (p, t) => [[p[0], p[1]], [p[0] - t[0] * head - t[1] * head * 0.55, p[1] - t[1] * head + t[0] * head * 0.55], [p[0] - t[0] * head + t[1] * head * 0.55, p[1] - t[1] * head - t[0] * head * 0.55]];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [col, w] of [[pal.alpha("bg", 0.8 * alpha), width + Math.min(3.5, width * 1.2)], [color, width]]) {
    ctx.beginPath();
    ctx.moveTo(a2[0], a2[1]);
    ctx.quadraticCurveTo(c[0], c[1], b2[0], b2[1]);
    ctx.setLineDash(dots ? [0.1, width * 2.4] : dash ? [width * 2.2, width * 1.8] : []);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.setLineDash([]);
    const heads = noHead ? [] : [tri(tip, t2)];
    if (both) heads.push(tri(tail, [-t1[0], -t1[1]]));
    for (const h of heads) { ctx.beginPath(); h.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}

/**
 * Diagonal hatching over a shape: `shape` builds its path on ctx, `box` is [x0, y0, x1, y1]
 * round it. A thin line in the pal's ink-2 on a faint halo of the ground, so it reads on
 * a pale sticker and a dark one alike.
 */
export function hatch(ctx, pal, shape, [x0, y0, x1, y1]) {
  const h = y1 - y0, step = Math.max(3.5, Math.min(x1 - x0, h) / 3.5);
  ctx.save();
  shape();
  ctx.clip();
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (let k = x0 - h; k < x1; k += step) { ctx.moveTo(k, y1); ctx.lineTo(k + h, y0); }
  ctx.strokeStyle = pal.alpha("bg", 0.55);
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.strokeStyle = pal.ink2;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** A dashed line (or outline) in the pal's ink-3 on a halo, for the ghost of a piece that is away. */
export function dashed(ctx, pal, trace) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [color, width, pattern] of [[pal.alpha("bg", 0.6), 3.5, []], [pal.ink3, 1.6, [4, 3]]]) {
    ctx.beginPath();
    trace();
    ctx.setLineDash(pattern);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}
