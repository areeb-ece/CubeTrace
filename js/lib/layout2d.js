// Where the stickers go on the flat net. Pure: no DOM. The net is the standard cross:
// U above F; L F R B in a row; D below F. A face is 3×3 stickers; the stickers on a
// face sit a small gap apart and the faces a larger one apart.

/** Each face's place on the cross, in whole faces: [column, row]. */
export const NET_FACES = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };

const GAP = 0.12;   // between stickers, in stickers
const FACE_GAP = 0.5; // between faces, in stickers: also the strip above the net that holds the face names
const COLS = 4, ROWS = 3;

/**
 * The net fitted and centred in a w × h box with `margin` to spare.
 * cell is a sticker's side, gap the space between stickers, faceGap the space between
 * faces; (x0, y0) is the top-left of the whole drawing (name strip included).
 */
export function netLayout(w, h, margin = Math.max(6, 0.03 * Math.min(w, h))) {
  const face = 3 + 2 * GAP;
  const across = COLS * face + (COLS - 1) * FACE_GAP, down = ROWS * face + (ROWS - 1) * FACE_GAP + FACE_GAP;
  const cell = Math.max(1, Math.min((w - 2 * margin) / across, (h - 2 * margin) / down));
  const gap = GAP * cell, faceGap = FACE_GAP * cell;
  const width = across * cell, height = down * cell;
  return { cell, gap, faceGap, x0: (w - width) / 2, y0: (h - height) / 2, width, height, faces: NET_FACES };
}

/** The top-left corner and side of sticker (row, col) of a face. */
export function netCell(l, face, row, col) {
  const [fc, fr] = l.faces[face], pitch = l.cell + l.gap;
  const faceSide = 3 * l.cell + 2 * l.gap;
  return {
    x: l.x0 + fc * (faceSide + l.faceGap) + col * pitch,
    y: l.y0 + l.faceGap + fr * (faceSide + l.faceGap) + row * pitch,
    size: l.cell,
  };
}

/** All 54 stickers of the net as { face, row, col, x, y, size }, for hit tests and cursor moves. */
export function netCells(l) {
  const out = [];
  for (const face of "UDLRFB") for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) out.push({ face, row, col, ...netCell(l, face, row, col) });
  return out;
}

/** The sticker (from netCells) whose square holds point (px, py), or null. */
export const cellAt = (cells, px, py) => cells.find((c) => px >= c.x && px <= c.x + c.size && py >= c.y && py <= c.y + c.size) || null;

/**
 * The cell the arrow key (dx, dy: a unit step on screen) moves a cursor to: the nearest
 * cell centre lying that way, sideways drift counting double so a row stays a row.
 * Stays put (returns from) when nothing lies that way.
 */
export function stepCell(cells, from, dx, dy) {
  const mid = (c) => [c.x + c.size / 2, c.y + c.size / 2];
  const [fx, fy] = mid(from);
  let best = from, bestScore = Infinity;
  for (const c of cells) {
    if (c === from) continue;
    const [x, y] = mid(c), along = (x - fx) * dx + (y - fy) * dy, across = Math.abs((x - fx) * dy - (y - fy) * dx);
    if (along < from.size * 0.3) continue;
    const score = along + 2 * across;
    if (score < bestScore) { best = c; bestScore = score; }
  }
  return best;
}

// ── the last-layer diagram: the up face as a 3×3 square, and the 12 side stickers of the
// top layer as strips round it, as OLL and PLL sheets draw them. F is at the bottom, so
// it is the view from above with the front towards you.
const LL_STRIP = 0.4;  // a strip's thickness, in stickers
const LL_OFF = 0.22;   // the space between the square and its strips
const LL_ACROSS = 3 + 2 * GAP + 2 * (LL_OFF + LL_STRIP);

/**
 * The diagram fitted and centred in a w × h box. cell is a sticker's side; (ux, uy) the
 * top-left of the up face's square; side the square's width; t the strips' thickness.
 */
export function llLayout(w, h, margin = Math.max(6, 0.04 * Math.min(w, h))) {
  const cell = Math.max(1, Math.min((w - 2 * margin) / LL_ACROSS, (h - 2 * margin) / LL_ACROSS));
  const gap = GAP * cell, side = 3 * cell + 2 * gap, t = LL_STRIP * cell, off = LL_OFF * cell;
  const span = LL_ACROSS * cell;
  return { cell, gap, side, t, off, ux: (w - span) / 2 + t + off, uy: (h - span) / 2 + t + off, span };
}

/**
 * Where sticker (face, row, col) (as on the net) sits in the diagram: { x, y, w, h }, or
 * null for stickers the diagram doesn't show (everything but U and the top row of F, R,
 * B and L).
 */
export function llCell(l, face, row, col) {
  const pitch = l.cell + l.gap;
  if (face === "U") return { x: l.ux + col * pitch, y: l.uy + row * pitch, w: l.cell, h: l.cell };
  if (row !== 0 || !"FRBL".includes(face)) return null;
  if (face === "F") return { x: l.ux + col * pitch, y: l.uy + l.side + l.off, w: l.cell, h: l.t };
  if (face === "B") return { x: l.ux + (2 - col) * pitch, y: l.uy - l.off - l.t, w: l.cell, h: l.t };
  if (face === "R") return { x: l.ux + l.side + l.off, y: l.uy + (2 - col) * pitch, w: l.t, h: l.cell };
  return { x: l.ux - l.off - l.t, y: l.uy + col * pitch, w: l.t, h: l.cell };
}

/** The middle of the up-face sticker at grid x, z (each -1, 0 or 1; z = 1 is the front): where a top-layer piece's arrows meet. */
export function llCentre(l, x, z) {
  const pitch = l.cell + l.gap;
  return [l.ux + (x + 1) * pitch + l.cell / 2, l.uy + (z + 1) * pitch + l.cell / 2];
}
