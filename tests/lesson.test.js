// The lessons' logic: saved selections, what a case plays (and its mirror), "also used in"
// targets and the turn-over between beginner steps.
import test from "node:test";
import assert from "node:assert/strict";
import { METHODS } from "../js/lib/content/index.js";
import { firstSel, validSel, resolve, goalMet, turnOverBetween, alsoTarget, caseForAlg } from "../js/lib/lesson.js";
import { applyMoves } from "../js/lib/cube.js";
import { ROLE_SETS } from "../js/lib/roles.js";

const every = function* () { for (const m of METHODS) for (const s of m.steps) for (const c of s.cases) yield { method: m.id, step: s.id, case: c.id }; };

test("a saved selection that no longer exists falls back one level", () => {
  assert.deepEqual(validSel(null), firstSel());
  assert.deepEqual(validSel({ method: "nope" }), firstSel());
  assert.deepEqual(validSel({ method: "cfop", step: "nope", case: "x" }), firstSel("cfop"));
  const s = METHODS[1].steps[2];
  assert.deepEqual(validSel({ method: "cfop", step: s.id, case: "nope" }), { method: "cfop", step: s.id, case: s.cases[0].id });
  assert.deepEqual(validSel({ method: "cfop", step: s.id, case: s.cases[1].id }), { method: "cfop", step: s.id, case: s.cases[1].id });
});

test("every case plays to its step's goal, and every role set it names exists", () => {
  for (const sel of every()) {
    const r = resolve(sel);
    assert.ok(ROLE_SETS[r.roles], sel.case);
    assert.ok(goalMet(r, applyMoves(r.start, r.moves)), `${sel.case} reaches ${r.goal}`);
  }
});

test("F2L: every case has a left-slot version that reaches the goal; beginner partners point at each other", () => {
  const f2l = METHODS[1].steps.find((s) => s.id === "f2l");
  assert.equal(f2l.cases.length, 41);
  for (const c of f2l.cases) {
    const sel = { method: "cfop", step: "f2l", case: c.id }, r = resolve(sel, true);
    assert.equal(r.roles, "f2l-left");
    assert.equal(r.mirror.pressed, true);
    assert.ok(goalMet(r, applyMoves(r.start, r.moves)), c.id + " mirrored");
    assert.equal(resolve(sel).roles, "f2l");
  }
  const second = METHODS[0].steps.find((s) => s.id === "second-layer");
  const [a, b] = second.cases.map((c) => resolve({ method: "beginner", step: "second-layer", case: c.id }));
  assert.equal(a.mirror.to, b.case.id);
  assert.equal(b.mirror.to, a.case.id);
  assert.notEqual(a.mirror.pressed, b.mirror.pressed);
  // OLL, PLL and the others have no partner
  assert.equal(resolve({ method: "cfop", step: "pll", case: "pll-T" }).mirror, null);
});

test("every concept's algorithm is a case of F2L; every 'also' leads somewhere", () => {
  const f2l = METHODS[1].steps.find((s) => s.id === "f2l");
  for (const k of f2l.concepts) for (const alg of k.algs) assert.ok(caseForAlg(f2l, alg), alg);
  for (const sel of every()) {
    const { case: c } = resolve(sel);
    if (c.also) assert.ok(alsoTarget(c.also), `${c.id} also ${c.also}`);
  }
  assert.equal(alsoTarget("yellow-cross").sel.method, "beginner");
  assert.equal(alsoTarget("nothing"), null);
});

test("the cube turns over once, from a white-up step to a yellow-up one in the beginner method", () => {
  const sel = (step) => ({ method: "beginner", step, case: "x" });
  assert.equal(turnOverBetween(sel("white-corners"), sel("second-layer")), "z2");
  assert.equal(turnOverBetween(sel("white-cross"), sel("yellow-cross")), "z2");
  assert.equal(turnOverBetween(sel("second-layer"), sel("yellow-cross")), null);
  assert.equal(turnOverBetween(sel("second-layer"), sel("white-cross")), null);
  assert.equal(turnOverBetween({ method: "cfop", step: "cross" }, { method: "cfop", step: "f2l" }), null);
});
