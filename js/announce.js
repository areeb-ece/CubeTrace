// The polite live region: one short sentence per completed move, for screen readers.
import { moveText } from "./lib/moves.js";
import { ANNOUNCE_GAP } from "./timing.js";

const WORD = { U: "up", D: "down", L: "left", R: "right", F: "front", B: "back" };
const SLICE = { M: "middle slice", E: "equator slice", S: "standing slice" };
const LIKE = { M: "L", E: "D", S: "F", x: "R", y: "U", z: "F" };

/** "R: the right face, clockwise." · "U2: the up face, twice." · "M': the middle slice, back." */
export function describeMove(m) {
  const n = m.name, upper = n.toUpperCase();
  let what, how;
  if (n in SLICE) what = `the ${SLICE[n]}`;
  else if ("xyz".includes(n)) what = "the whole cube";
  else if (n === upper) what = `the ${WORD[n]} face`;
  else what = `the ${WORD[upper]} face and the layer behind it`;
  if (Math.abs(m.amount) === 2) how = "twice";
  else if (m.amount < 0) how = "back";
  else how = n in LIKE ? `like ${LIKE[n]}` : "clockwise";
  return `${moveText(m)}: ${what}, ${how}.`;
}

let region = null, timer = 0;
function live() {
  if (region) return region;
  region = document.createElement("div");
  region.className = "live";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  document.body.append(region);
  return region;
}
/** Say a sentence; the same sentence twice in a row is still read twice. */
export function announce(text) {
  const el = live();
  clearTimeout(timer);
  el.textContent = "";
  timer = setTimeout(() => { el.textContent = text; }, ANNOUNCE_GAP);
}
