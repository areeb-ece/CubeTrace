// PLL: the 21 permutations of the last layer, one standard algorithm each, held with
// yellow on U and green in front. tests/content.test.js checks that each keeps F2L and
// the orientation, that they are 21 different cases up to U before and after, and what
// each one swaps (so the names can't drift from the algorithms).
//   kind: what moves; recognition: what to look for on the side stickers.
export const PLL = [
  { id: "Aa", alg: "x R' U R' D2 R U' R' D2 R2 x'", kind: "corners", recognition: "Three corners cycle anticlockwise; headlights on one side, edges all solved." },
  { id: "Ab", alg: "x R2 D2 R U R' D2 R U' R x'", kind: "corners", recognition: "Three corners cycle clockwise; headlights on one side, edges all solved." },
  { id: "E", alg: "x' R U' R' D R U R' D' R U R' D R U' R' D' x", kind: "corners", recognition: "No headlights anywhere; every side shows two different corner colours." },
  { id: "F", alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", kind: "both", recognition: "One side is a solid bar of three; the opposite side shows a 1-2 split." },
  { id: "Ga", alg: "R2 U R' U R' U' R U' R2 U' D R' U R D'", kind: "both", recognition: "Headlights with a matching edge beside them, and a 1×2 block elsewhere." },
  { id: "Gb", alg: "R' U' R U D' R2 U R' U R U' R U' R2 D", kind: "both", recognition: "A 1×2 block next to headlights whose middle edge doesn't match." },
  { id: "Gc", alg: "R2 U' R U' R U R' U R2 U D' R U' R' D", kind: "both", recognition: "Mirror of Ga: headlights with a matching edge on the other side." },
  { id: "Gd", alg: "R U R' U' D R2 U' R U' R' U R' U R2 D'", kind: "both", recognition: "Mirror of Gb: a 1×2 block on the other side of the headlights." },
  { id: "H", alg: "M2 U M2 U2 M2 U M2", kind: "edges", recognition: "Every side has headlights with the opposite colour between them." },
  { id: "Ja", alg: "R' U L' U2 R U' R' U2 R L", kind: "both", recognition: "A 1×3 bar on the left and a 2×2-looking block; swaps two corners and two edges." },
  { id: "Jb", alg: "R U R' F' R U R' U' R' F R2 U' R'", kind: "both", recognition: "A 1×3 bar on the right side; swaps two adjacent corners and two edges." },
  { id: "Na", alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", kind: "both", recognition: "Front and back look like 1-2 splits pointing opposite ways." },
  { id: "Nb", alg: "R' U R U' R' F' U' F R U R' F R' F' R U' R", kind: "both", recognition: "Mirror of Na: the splits point the other way." },
  { id: "Ra", alg: "R U' R' U' R U R D R' U' R D' R' U2 R'", kind: "both", recognition: "Headlights on one side, and a 1×2 block on the side to their right." },
  { id: "Rb", alg: "R2 F R U R U' R' F' R U2 R' U2 R", kind: "both", recognition: "Headlights on one side, and a 1×2 block on the side to their left." },
  { id: "T", alg: "R U R' U' R' F R2 U' R' U' R U R' F'", kind: "both", recognition: "Headlights on one side, and a solid bar of three opposite the swapped edges." },
  { id: "Ua", alg: "M2 U M U2 M' U M2", kind: "edges", recognition: "One solved side; the other three edges cycle anticlockwise." },
  { id: "Ub", alg: "M2 U' M U2 M' U' M2", kind: "edges", recognition: "One solved side; the other three edges cycle clockwise." },
  { id: "V", alg: "R' U R' d' R' F' R2 U' R' U R' F R F", kind: "both", recognition: "No headlights; two corners swap across the diagonal with two edges." },
  { id: "Y", alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'", kind: "both", recognition: "Two corners swap across the diagonal; two blocks of two show." },
  { id: "Z", alg: "M' U M2 U M2 U M' U2 M2", kind: "edges", recognition: "Two pairs of adjacent edges swap: every side shows headlights with a neighbour's colour." },
];

/** 2-look PLL: the corners first (two cases), then the edges (four). */
export const PLL_2LOOK = [
  { id: "corners-headlights", name: "Headlights", alg: "R U R' U' R' F R2 U' R' U' R U R' F'", same: "T", recognition: "One side has headlights: put them on the left and swap the two right corners." },
  { id: "corners-diagonal", name: "No headlights", alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'", same: "Y", recognition: "No side has headlights: two corners need to swap across the diagonal." },
  { id: "edges-Ua", name: "Ua", alg: "M2 U M U2 M' U M2", same: "Ua", recognition: "Corners done, one side solved, three edges cycle anticlockwise." },
  { id: "edges-Ub", name: "Ub", alg: "M2 U' M U2 M' U' M2", same: "Ub", recognition: "Corners done, one side solved, three edges cycle clockwise." },
  { id: "edges-H", name: "H", alg: "M2 U M2 U2 M2 U M2", same: "H", recognition: "Corners done, opposite edges swap on both axes." },
  { id: "edges-Z", name: "Z", alg: "M' U M2 U M2 U M' U2 M2", same: "Z", recognition: "Corners done, adjacent edges swap in two pairs." },
];
