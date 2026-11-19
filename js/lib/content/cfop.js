// CFOP, held as speedsolvers hold it: white cross on D, green in front, yellow on U.
// Cross and F2L concepts are written here; the case sets come from f2l.js, oll.js and
// pll.js and are put together in index.js.

const p = (moves, role, caption, pair) => ({ moves, role, caption, ...(pair !== undefined ? { pair } : {}) });

export const CROSS = {
  intro: "Solve the four white edges on the bottom, each matching its side centre. Plan it before turning. Relative order matters more than matching each centre straight away: edges that are right relative to each other can all be lined up with one D turn at the end.",
  cases: [
    { id: "cr-up", name: "In the top layer, white up", parts: [p("U", null, "Bring the edge above its place; the cross underneath can't be disturbed by U…"), p("F2", null, "…then drop it straight down.")] },
    { id: "cr-up-down", name: "Above its place, white up", parts: [p("F2", null, "A half turn drops it in, white on the bottom.")] },
    { id: "cr-middle", name: "In the middle layer", parts: [p("F", null, "One quarter turn of the face beside it brings it down.")] },
    { id: "cr-flipped", name: "In the top layer, white on the side", parts: [p("U' R'", null, "Put the edge beside its place and take it into the middle layer, white on the side…"), p("F", null, "…so one turn of the front brings it down the right way."), p("R", null, "Then restore the right side.")] },
  ],
};

export const CFOP_STEPS = {
  cross: { id: "cross", name: "Cross", holding: "yellowUp", roles: "cross", goal: "cross" },
  f2l: { id: "f2l", name: "F2L", holding: "yellowUp", roles: "f2l", goal: "f2l", intro: "First two layers, one corner–edge pair at a time. Learn the four ideas first; the 41 cases are those ideas applied to every way a pair can sit." },
  oll2: { id: "oll2", name: "2-look OLL", holding: "yellowUp", roles: "oll", goal: "oll", intro: "Two looks: first make the yellow cross on top (3 cases), then twist the corners up (7 cases)." },
  pll2: { id: "pll2", name: "2-look PLL", holding: "yellowUp", roles: "pll", goal: "solved", intro: "Two looks: first put the corners in place (2 cases), then the edges (4 cases)." },
  oll: { id: "oll", name: "OLL", holding: "yellowUp", roles: "oll", goal: "oll", intro: "All 57 cases: yellow up in one algorithm. Grouped by the shape the yellow stickers make." },
  pll: { id: "pll", name: "PLL", holding: "yellowUp", roles: "pll", goal: "solved", intro: "All 21 cases: the last layer in place in one algorithm. Recognise them from the side stickers." },
};

/** Hand-written structure for the 2-look algorithms (setup and undo share a pair number). */
export const TWO_LOOK_PARTS = {
  "F R U R' U' F'": [p("F", "setup", "Tip the front so the line's ends join the turning layer.", 0), p("R U R' U'", "trigger", "Flip two edges with the sexy move."), p("F'", "undo", "Tip it back.", 0)],
  "f R U R' U' f'": [p("f", "setup", "Tip two layers so the L's edges join the turning layer.", 0), p("R U R' U'", "trigger", "Flip them with the sexy move."), p("f'", "undo", "Tip back.", 0)],
  "F R U R' U' F' f R U R' U' f'": [p("F R U R' U' F'", "trigger", "The line algorithm turns the dot into an L…"), p("f R U R' U' f'", "trigger", "…and the L algorithm finishes the cross.")],
  "R U R' U R U2 R'": [p("R U R'", "insert", "Lift a corner and put it back turned…"), p("U R U2 R'", "insert", "…then the same again round the top: three corners twist.")],
  "R U2 R' U' R U' R'": [p("R U2 R'", "insert", "Antisune is Sune backwards: lift and turn a corner…"), p("U' R U' R'", "insert", "…then again the other way round.")],
  "R U2 R' U' R U R' U' R U' R'": [p("R U2 R'", "insert", "Twist the right-hand pair of corners…"), p("U' R U R' U'", null, "…carry them round…"), p("R U' R'", "insert", "…and put them back: two pairs face each other.")],
  "R U2 R2 U' R2 U' R2 U2 R": [p("R U2 R2 U'", null, "Pi: swing the right side round the top…"), p("R2 U' R2 U2 R", null, "…and back, twisting four corners.")],
  "R2 D' R U2 R' D R U2 R": [p("R2 D'", null, "Take the right side down and borrow the bottom layer…"), p("R U2 R'", "insert", "…twist the top corners there…"), p("D R U2 R", null, "…and give the bottom layer back.")],
  "r U R' U' r' F R F'": [p("r U R' U' r'", null, "A wide sexy move twists the front corners…"), p("F R F'", null, "…and a sledgehammer finishes the T.")],
  "F' r U R' U' r' F R": [p("F'", null, "Tip the front so the bowtie lines up…"), p("r U R' U' r'", null, "…twist with a wide sexy move…"), p("F R", null, "…and tip back.")],
  "R U R' U' R' F R2 U' R' U' R U R' F'": [p("R U R' U'", "trigger", "T perm: a sexy move…"), p("R' F R2 U' R' U' R U R' F'", null, "…then the rest swaps the two right corners and the left and right edges.")],
  "F R U' R' U' R U R' F' R U R' U' R' F R F'": [p("F R U' R' U' R U R' F'", null, "Y perm: the first half swaps the diagonal corners…"), p("R U R' U' R' F R F'", null, "…the second half (sexy move, sledgehammer) puts the edges back.")],
  "M2 U M U2 M' U M2": [p("M2", "setup", "Ua: take the middle slice's top edge down…", 0), p("U M U2 M' U", null, "…cycle three edges round the top…"), p("M2", "undo", "…and bring the slice back.", 0)],
  "M2 U' M U2 M' U' M2": [p("M2", "setup", "Ub: the mirror of Ua…", 0), p("U' M U2 M' U'", null, "…cycling the edges the other way…"), p("M2", "undo", "…then the slice comes back.", 0)],
  "M2 U M2 U2 M2 U M2": [p("M2 U M2", null, "H: swap two opposite edges…"), p("U2", null, "…turn the top round…"), p("M2 U M2", null, "…and swap the other two.")],
  "M' U M2 U M2 U M' U2 M2": [p("M' U M2 U M2 U M'", null, "Z: swap two pairs of adjacent edges with the middle slice…"), p("U2 M2", null, "…then line the slice up again.")],
};
