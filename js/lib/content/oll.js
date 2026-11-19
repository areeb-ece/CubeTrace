// OLL: the 57 orientation cases of the last layer, by their standard numbers, in the
// shape groups they are usually taught in. tests/content.test.js checks every algorithm
// keeps F2L, that the 57 cover every non-solved orientation pattern exactly once up to
// U, and that each group's shape matches its patterns (so numbers can't drift).
export const OLL_GROUPS = [
  { id: "dot", name: "Dot", note: "No edge oriented.", cases: [1, 2, 3, 4, 17, 18, 19, 20] },
  { id: "line", name: "Line", note: "Two opposite edges oriented, making a bar.", cases: [51, 52, 55, 56] },
  { id: "square", name: "Square", note: "A 2×2 block oriented in one corner.", cases: [5, 6] },
  { id: "lightning", name: "Small lightning", note: "A zig-zag of oriented stickers.", cases: [7, 8, 11, 12] },
  { id: "big-lightning", name: "Big lightning", note: "A long zig-zag across the face.", cases: [39, 40] },
  { id: "fish", name: "Fish", note: "A diagonal fish shape.", cases: [9, 10, 35, 37] },
  { id: "knight", name: "Knight move", note: "Shapes like a chess knight's move.", cases: [13, 14, 15, 16] },
  { id: "awkward", name: "Awkward", note: "Two edges and two corners in an uneven shape.", cases: [29, 30, 41, 42] },
  { id: "p", name: "P", note: "A P-shaped block.", cases: [31, 32, 43, 44] },
  { id: "w", name: "W", note: "A staircase of oriented stickers.", cases: [36, 38] },
  { id: "c", name: "C", note: "A C shape.", cases: [34, 46] },
  { id: "t", name: "T", note: "A T shape.", cases: [33, 45] },
  { id: "l", name: "Small L", note: "An L of two edges with no corner.", cases: [47, 48, 49, 50, 53, 54] },
  { id: "corners", name: "Corners oriented", note: "Every corner up, two or four edges not.", cases: [28, 57] },
  { id: "cross", name: "Cross (edges oriented)", note: "The yellow cross is there; only corners twist.", cases: [21, 22, 23, 24, 25, 26, 27] },
];

/** number → algorithm (yellow on U, green in front). */
export const OLL = {
  1: "R U2 R2 F R F' U2 R' F R F'", 2: "F R U R' U' F' f R U R' U' f'", 3: "f R U R' U' f' U' F R U R' U' F'", 4: "f R U R' U' f' U F R U R' U' F'",
  5: "r' U2 R U R' U r", 6: "r U2 R' U' R U' r'", 7: "r U R' U R U2 r'", 8: "r' U' R U' R' U2 r",
  9: "R U R' U' R' F R2 U R' U' F'", 10: "R U R' U R' F R F' R U2 R'", 11: "r U R' U R' F R F' R U2 r'", 12: "M' R' U' R U' R' U2 R U' R r'",
  13: "F U R U' R2 F' R U R U' R'", 14: "R' F R U R' F' R F U' F'", 15: "r' U' r R' U' R U r' U r", 16: "r U r' R U R' U' r U' r'",
  17: "R U R' U R' F R F' U2 R' F R F'", 18: "r U R' U R U2 r2 U' R U' R' U2 r", 19: "M U R U R' U' M' R' F R F'", 20: "r U R' U' M2 U R U' R' U' M'",
  21: "R U2 R' U' R U R' U' R U' R'", 22: "R U2 R2 U' R2 U' R2 U2 R", 23: "R2 D' R U2 R' D R U2 R", 24: "r U R' U' r' F R F'",
  25: "F' r U R' U' r' F R", 26: "R U2 R' U' R U' R'", 27: "R U R' U R U2 R'", 28: "r U R' U' M U R U' R'",
  29: "R U R' U' R U' R' F' U' F R U R'", 30: "F R' F R2 U' R' U' R U R' F2", 31: "R' U' F U R U' R' F' R", 32: "L U F' U' L' U L F L'",
  33: "R U R' U' R' F R F'", 34: "R U R2 U' R' F R U R U' F'", 35: "R U2 R2 F R F' R U2 R'", 36: "L' U' L U' L' U L U L F' L' F",
  37: "F R' F' R U R U' R'", 38: "R U R' U R U' R' U' R' F R F'", 39: "L F' L' U' L U F U' L'", 40: "R' F R U R' U' F' U R",
  41: "R U R' U R U2 R' F R U R' U' F'", 42: "R' U' R U' R' U2 R F R U R' U' F'", 43: "F' U' L' U L F", 44: "F U R U' R' F'",
  45: "F R U R' U' F'", 46: "R' U' R' F R F' U R", 47: "R' U' R' F R F' R' F R F' U R", 48: "F R U R' U' R U R' U' F'",
  49: "r U' r2 U r2 U r2 U' r", 50: "r' U r2 U' r2 U' r2 U r'", 51: "F U R U' R' U R U' R' F'", 52: "R U R' U R U' B U' B' R'",
  53: "r' U' R U' R' U R U' R' U2 r", 54: "r U R' U R U' R' U R U2 r'", 55: "R' F R U R U' R2 F' R2 U' R' U R U R'", 56: "r' U' r U' R' U R U' R' U R r' U r",
  57: "R U R' U' M' U R U' r'",
};

/** Names the cross cases are taught by (2-look OLL's second look). */
export const OCLL_NAMES = { 21: "H", 22: "Pi", 23: "Headlights", 24: "T", 25: "Bowtie", 26: "Antisune", 27: "Sune" };

/** 2-look OLL: the edges first (three cases), then the corners (the seven cross cases). */
export const OLL_2LOOK_EDGES = [
  { id: "line", name: "Line", alg: "F R U R' U' F'", recognition: "Two opposite yellow edges up: hold the line left to right." },
  { id: "l", name: "L shape", alg: "f R U R' U' f'", recognition: "Two adjacent yellow edges up: hold them at the back and left." },
  { id: "dot", name: "Dot", alg: "F R U R' U' F' f R U R' U' f'", same: 2, recognition: "No yellow edge up: the line algorithm, then the L one." },
];
