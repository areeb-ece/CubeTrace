// What the lessons need that isn't drawing: which selection is valid, what a case plays
// (its mirror, its roles, its goal), where "also used in" points and when the cube turns
// over. Pure, so tests/lesson.test.js can run all of it in Node.
import { METHODS, CASES } from "./content/index.js";
import { parse, format } from "./notation.js";
import { caseOf } from "./algebra.js";
import { HOLDINGS } from "./roles.js";
import { GOALS } from "./goals.js";

const method = (id) => METHODS.find((m) => m.id === id);

/** The first step's first case of a method (or of the first method). */
export function firstSel(methodId) {
  const m = method(methodId) || METHODS[0], s = m.steps[0];
  return { method: m.id, step: s.id, case: s.cases[0].id };
}

/** Whatever was saved, made into a selection that exists: a stale id falls back one level. */
export function validSel(raw) {
  const m = method(raw?.method);
  if (!m) return firstSel();
  const s = m.steps.find((x) => x.id === raw.step);
  if (!s) return firstSel(m.id);
  const c = s.cases.find((x) => x.id === raw.case) || s.cases[0];
  return { method: m.id, step: s.id, case: c.id };
}

export const stepOf = (sel) => method(sel.method).steps.find((s) => s.id === sel.step);
export const caseIn = (sel) => stepOf(sel).cases.find((c) => c.id === sel.case);

/**
 * What to play for a selection. mirrored: the F2L case's left-slot version.
 * mirror: null (no partner), { kind: "moves" } (F2L: the same case in the other slot) or
 * { kind: "case", to } (a beginner case with its own partner case); pressed says which
 * side of the pair is showing.
 */
export function resolve(sel, mirrored = false) {
  const m = method(sel.method), step = stepOf(sel), c = caseIn(sel);
  let { moves, parts, start } = c, roles = step.roles, mirror = null;
  if (step.id === "f2l" && c.mirrorAlg) {
    mirror = { kind: "moves", pressed: mirrored };
    if (mirrored) {
      moves = parse(c.mirrorAlg).moves;
      parts = null;
      start = caseOf(moves, HOLDINGS.yellowUp);
      roles = "f2l-left";
    }
  } else if (c.mirror && step.cases.some((x) => x.id === c.mirror)) {
    mirror = { kind: "case", to: c.mirror, pressed: step.cases.findIndex((x) => x.id === c.id) > step.cases.findIndex((x) => x.id === c.mirror) };
  }
  return { method: m, step, case: c, moves, parts, start, roles, goal: c.goal || step.goal, mirror };
}

/** Has the cube reached the case's goal? */
export const goalMet = (r, state) => GOALS[r.goal](state);

/** The whole-cube turn to play when moving from one step to another, or null. */
export function turnOverBetween(from, to) {
  if (!from || from.method !== to.method) return null;
  const m = method(to.method), a = stepOf(from), b = stepOf(to);
  const turn = m.steps.find((s) => s.turnOver)?.turnOver;
  return turn && a.holding === "whiteUp" && b.holding === "yellowUp" ? turn : null;
}

/** An "also" (a case id, or a step id) as a selection and a label, or null. */
export function alsoTarget(also) {
  if (!also) return null;
  const hit = CASES.get(also);
  if (hit) return { sel: { method: hit.method.id, step: hit.step.id, case: hit.case.id }, label: `${hit.case.name} (${hit.method.name}, ${hit.step.name})` };
  for (const m of METHODS) {
    const s = m.steps.find((x) => x.id === also);
    if (s) return { sel: { method: m.id, step: s.id, case: s.cases[0].id }, label: `${s.name} (${m.name})` };
  }
  return null;
}

/** The case in a step that plays this algorithm (a concept's chip), or null. */
export function caseForAlg(step, alg) {
  const text = format(parse(alg).moves);
  return step.cases.find((c) => c.alg === text) || null;
}
