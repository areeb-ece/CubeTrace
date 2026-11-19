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
