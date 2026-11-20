// The twist ledger (PLAN.md section 6): how far each corner is twisted, in thirds of a
// turn, with the cube held the way the learner holds it. Twists add up to 0 mod 3 over all
// eight corners, so a twist on top is paid for below: that is why the lower layers look
// broken mid-way through step 7 and come back once every corner is done. Pure.
import { POS, PERM, MUL, posIndex } from "./rot.js";
import { IDS, clone } from "./cube.js";
import { twistAt, CENTRES, slotWords } from "./pieces.js";

/** a thirds-of-a-turn count as 0, 1 or -1 */
export const signed3 = (n) => ((((n % 3) + 3) % 3) + 1) % 3 - 1;

/** The state with the whole cube turned so its centres sit where the holding's do (what the learner sees). */
export function inHolding(state, holding) {
  for (let r = 0; r < 24; r++) {
    if (!CENTRES.every((id) => PERM[r][state.pos[id]] === holding.pos[id])) continue;
    const t = clone(state);
    for (const id of IDS) { t.pos[id] = PERM[r][state.pos[id]]; t.ori[id] = MUL[r][state.ori[id]]; }
    return t;
  }
  return clone(state);
}

// the top layer's corners, once round as seen from above
const TOP = [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]].map(posIndex);
const LOWER = TOP.map((p) => posIndex([POS[p][0], -1, POS[p][2]]));

/**
 * state: any cube; holding: the solved cube as held (HOLDINGS.yellowUp: yellow up, green in front).
 * → { corners: [{ pos, name, twist }] (the top layer, front-left first, going round
 * clockwise from above; twist 0, 1 or -1: +1 is a third of a turn clockwise), top (their
 * total mod 3), lower (the four corners under them, mod 3) }. top + lower ≡ 0 (mod 3).
 */
export function twistLedger(state, holding) {
  const s = inHolding(state, holding);
  const twist = (p) => signed3(twistAt(s, p));
  const corners = TOP.map((p) => ({ pos: p, name: slotWords(p).replace(/^up-/, ""), twist: twist(p) }));
  return {
    corners,
    top: signed3(corners.reduce((n, c) => n + c.twist, 0)),
    lower: signed3(LOWER.reduce((n, p) => n + twist(p), 0)),
  };
}
