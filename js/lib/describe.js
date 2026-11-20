// Words for where the cube is in its moves, for the canvases' accessible names (nothing
// here is drawn on screen). Pure: no DOM.

/** "before move 3 of 7", "turning move 3 of 7", "before the first move", "after the last move", "no moves". */
export function positionWords(index, t, n) {
  if (!n) return "no moves yet";
  if (t > 0) return `turning move ${index + 1} of ${n}`;
  if (index <= 0) return "before the first move";
  if (index >= n) return "after the last move";
  return `before move ${index + 1} of ${n}`;
}

/** "Cube: Edge goes right, before move 3 of 7." (name may be empty, as in Explore). */
export function canvasName(view, name, index, t, n, extra = "") {
  const where = positionWords(index, t, n);
  return `${view}: ${name ? name + ", " : ""}${where}.${extra ? " " + extra : ""}`;
}
