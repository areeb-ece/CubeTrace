// F2L: the 41 ways one corner–edge pair can sit in its slot and the top layer, for the
// front-right slot (yellow on U, green in front), one standard algorithm each. The
// group, the name and the recognition are worked out from each case (index.js), so
// they can't disagree with the algorithm. tests/content.test.js checks that every
// algorithm keeps the cross and the other slots, that the 41 are different up to U,
// and that with the solved pair they make all 42 positions.
//
// Cases come in mirror pairs through the slot's diagonal (R U' R' ↔ F' U F); the left
// slot's algorithms are the L/R mirrors of these (the Mirror toggle).
export const F2L = [
  "U R U' R'", "U' F' U F", "F' U' F", "R U R'",
  "U' R U R' U2 R U' R'", "U F' U' F U2 F' U F", "U' R U2 R' U2 R U' R'", "U F' U2 F U2 F' U F",
  "U' R U' R' U F' U' F", "U' R U R' U R U R'", "U' R U2 R' U F' U' F", "R U' R' U R U' R' U2 R U' R'",
  "U F' U F U' F' U' F", "U' R U' R' U R U R'", "F' U F U2 R U R'", "R U' R' U2 F' U' F",
  "R U2 R' U' R U R'", "F' U2 F U F' U' F", "U R U2 R' U R U' R'", "U' F' U2 F U' F' U F",
  "U2 R U R' U R U' R'", "U2 F' U' F U' F' U F", "U R U' R' U' R U' R' U R U' R'", "U' F' U F U F' U F U' F' U F",
  "U' R' F R F' R U R'", "U R U' R' U' F' U F", "R U' R' U R U' R'", "F' U F U' F' U F",
  "F' U' F U F' U' F", "R U R' U' R U R'", "U' R' F R F' R U' R'", "U R U' R' U R U' R' U R U' R'",
  "U' R U' R' U2 R U' R'", "U R U R' U2 R U R'", "U' R U R' U F' U' F", "U F' U' F U' R U R'",
  "R2 U2 F R2 F' U2 R' U R'", "R U' R' U' R U R' U2 R U' R'", "R U' R' U R U2 R' U R U' R'", "F' U F U2 R U R' U R U' R'",
  "R U R' U' R U' R' U2 F' U' F",
];

/** The basic ideas, taught before the cases (each points at a case by its algorithm). */
export const F2L_CONCEPTS = [
  { title: "The three basic inserts", text: "A pair joined in the top layer goes in with R U R' from the right, F' U' F from the front, or R U' R' once the corner sits above its slot.", algs: ["R U R'", "F' U' F", "U R U' R'"] },
  { title: "Pair up, then insert", text: "First join the corner and edge in the top layer, keeping the slot free, then put them in together with one insert.", algs: ["U' R U R' U2 R U' R'"] },
  { title: "Hide the slot", text: "While you move one piece with U, turn the slot up out of the way (R, then R' after), so the U turn can't disturb the cross or the other slots.", algs: ["R U' R' U R U' R'"] },
  { title: "U turns never hurt", text: "Turning U moves only the top layer, so it is free: use it to bring a piece above the right spot before any insert.", algs: ["U R U' R'", "U' F' U F"] },
];
