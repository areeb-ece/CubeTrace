// The Learn side panel: a method's steps, the step's cases as small pictures, and the
// selected case's detail (its timeline is moved in by app.js). Picking a case loads it
// into the player, paused at the start, and the goal is checked when it plays to the end.
import { h, clear } from "./ui.js";
import { METHODS } from "./lib/content/index.js";
import { HOLDINGS } from "./lib/roles.js";
import { parse } from "./lib/notation.js";
import { firstSel, validSel, stepOf, resolve, goalMet, turnOverBetween, alsoTarget, caseForAlg } from "./lib/lesson.js";
import { drawThumb, isLL } from "./thumbs.js";
import { onThemeChange } from "./palette.js";
import { turnMs } from "./timing.js";

const methodOf = (sel) => METHODS.find((m) => m.id === sel.method);

/**
 * root: the panel's element. side: the element that carries data-goal. mirrorBtn: the
 * transport's Mirror toggle. onSelect(sel): the selection changed (to be remembered).
 * onPick(): the visitor chose something to play (a drawer can close).
 */
export function mountLearn({ root, side, mirrorBtn, store, player, onSelect, onPick, initial }) {
  let cur = validSel(initial), mirrored = false, active = false;
  let token = 0, pending = null, turning = false; // the turn-over: what to do when it has played
  let resolved = null;

  // ── the parts of the panel ──
  const stepBox = h("div", { class: "steps" });
  const intro = h("p", { class: "intro" });
  const note = h("p", { class: "sd-hint" });
  const turnBtn = h("button", { class: "sd-btn sd-small", type: "button", text: "Turn the cube over again", on: { click: () => turnAgain() } });
  const concepts = h("details", { class: "concepts", open: true });
  const name = h("h3", { class: "case-name" });
  const recog = h("p", { class: "recog" });
  const also = h("p", { class: "also" });
  const slot = h("div", { class: "tl-slot" });
  const warn = h("div", { class: "sd-callout sd-warn", role: "alert", hidden: true }, h("p", { text: "This algorithm didn't reach the step's goal from this case." }));
  const detail = h("section", { class: "detail", "aria-labelledby": "caseName" }, name, recog, also, slot, warn);
  name.id = "caseName";
  const cases = h("div", { class: "cases" });
  root.append(h("nav", { "aria-label": "Steps" }, stepBox), h("div", { class: "lead" }, intro, note, turnBtn), detail, concepts, cases);

  // ── thumbnails: drawn when they scroll into view ──
  const thumbs = new Map(); // canvas → { step, c }
  const seen = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const t = thumbs.get(e.target);
      if (t && drawThumb(e.target, t.step, t.c)) seen.add(e.target);
      io.unobserve(e.target);
    }
  }, { rootMargin: "160px" });
  onThemeChange(() => { for (const cv of seen) { const t = thumbs.get(cv); if (t && cv.isConnected) drawThumb(cv, t.step, t.c); } });

  // ── what the panel shows ──
  function renderSteps() {
    clear(stepBox);
    methodOf(cur).steps.forEach((s, i) => stepBox.append(h("button", {
      class: "sd-btn sd-small", type: "button", "data-step": s.id, "aria-current": s.id === cur.step ? "step" : null,
      on: { click: () => go({ ...cur, step: s.id, case: s.cases[0].id }, "step") },
    }, h("span", { class: "n", text: String(i + 1) }), s.name)));
  }
  function markStep() {
    for (const b of stepBox.children) { if (b.dataset.step === cur.step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); }
  }
  const lead = (step, c) => {
    const group = step.groups?.find((g) => g.id === c.group)?.name || "";
    if (step.id === "oll") return c.name.replace(/^OLL /, "");
    // the group's heading already says "Corner on top": keep what tells the cases apart
    if (step.id === "f2l") return c.name.slice(group.split(",")[0].length).trim() || c.name;
    return c.name;
  };
  function card(step, c, dup) {
    const cv = h("canvas", { "aria-hidden": "true" });
    thumbs.set(cv, { step, c });
    const group = step.groups?.find((g) => g.id === c.group)?.name;
    const label = dup.has(c.name) && group ? `${c.name} (${group})` : c.name;
    const b = h("button", { class: "case", type: "button", "aria-label": label, "data-case": c.id, "data-kind": isLL(step) ? "ll" : step.id === "f2l" ? "f2l" : "cube", on: { click: () => go({ ...cur, case: c.id }, true) } },
      cv, h("span", { class: "case-label", text: lead(step, c) }));
    requestAnimationFrame(() => io.observe(cv));
    return b;
  }
  function renderStep() {
    const step = stepOf(cur);
    io.disconnect();
    seen.clear();
    thumbs.clear();
    intro.textContent = step.intro;
    note.textContent = step.also || "";
    note.hidden = !step.also;
    turnBtn.hidden = !step.turnOver;
    // the F2L ideas, each with algorithms that load as cases
    clear(concepts);
    concepts.hidden = !step.concepts;
    concepts.open = true;
    if (step.concepts) concepts.append(h("summary", { text: "The basic ideas" }));
    for (const k of step.concepts || []) {
      concepts.append(h("article", { class: "concept" }, h("h3", { text: k.title }), h("p", { text: k.text }),
        h("div", { class: "chips" }, k.algs.map((alg) => {
          const target = caseForAlg(step, alg);
          return h("button", { class: "sd-btn sd-small sd-mono", type: "button", text: alg, disabled: !target, on: { click: () => target && go({ ...cur, case: target.id }, true) } });
        }))));
    }
    clear(cases);
    const count = new Map();
    for (const c of step.cases) count.set(c.name, (count.get(c.name) || 0) + 1);
    const dup = new Set([...count].filter(([, n]) => n > 1).map(([n]) => n));
    const grid = (list) => h("div", { class: "grid", "data-kind": isLL(step) ? "ll" : step.id === "f2l" ? "f2l" : "cube" }, list.map((c) => card(step, c, dup)));
    if (step.groups) {
      for (const g of step.groups) {
        const list = step.cases.filter((c) => c.group === g.id);
        if (list.length) cases.append(h("section", { class: "group" }, h("h3", { text: g.name }), grid(list)));
      }
    } else cases.append(grid(step.cases));
    markCase();
  }
  function markCase() {
    for (const b of cases.querySelectorAll(".case")) { if (b.dataset.case === cur.case) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); }
  }
  function renderDetail() {
    const r = resolved;
    name.textContent = r.case.name;
    recog.textContent = r.case.recognition || "";
    recog.hidden = !r.case.recognition;
    clear(also);
    const t = alsoTarget(r.case.also);
    also.hidden = !t;
    if (t) also.append("Also used in ", h("button", { class: "sd-link", type: "button", text: t.label, on: { click: () => go(t.sel, true) } }));
    // the Mirror toggle on the transport strip
    const m = r.mirror;
    mirrorBtn.setAttribute("aria-disabled", String(!m));
    mirrorBtn.setAttribute("aria-pressed", String(!!m?.pressed));
    mirrorBtn.title = m ? "Show the mirror image of this case" : "This case has no left or right partner";
  }

  // ── loading a case into the player ──
  const setRoles = (roleSet) => { if (store.state.opts.roleSet !== roleSet) store.set("opts", { ...store.state.opts, roleSet }); };
  function load() {
    resolved = resolve(cur, mirrored);
    setRoles(resolved.roles);
    player.setStart(resolved.start);
    player.setMoves(resolved.moves, resolved.parts);
    player.seek(0); // the case as it is, paused: step through it by default
    renderDetail();
    judge(store.state);
  }
  function stop() { token++; pending = null; turning = false; }

  // Beginner step 3 holds the cube the other way up: show the turn, then the case.
  function playTurn(turn, then) {
    stop();
    if (!turnMs(store.state.play.speed)) { then(); return; } // motion off: it jumps
    const mine = token;
    turning = true;
    setRoles("all");
    player.setStart(HOLDINGS.whiteUp);
    player.setMoves(parse(turn).moves);
    player.seek(0);
    player.play();
    pending = () => { if (mine !== token) return; turning = false; then(); };
    side.removeAttribute("data-goal");
    warn.hidden = true;
  }
  function turnAgain() { const t = stepOf(cur).turnOver; if (t) playTurn(t, load); }

  /** Select a case. user: the visitor chose it ("step": a step, which keeps a drawer open to show its cases). */
  function go(next, user) {
    const prev = cur;
    cur = validSel(next);
    mirrored = false;
    if (prev.method !== cur.method) renderSteps(); else markStep();
    if (prev.method !== cur.method || prev.step !== cur.step) renderStep(); else markCase();
    onSelect?.(cur);
    if (!active) return;
    const turn = user && turnOverBetween(prev, cur);
    resolved = resolve(cur, false);
    renderDetail();
    if (turn) playTurn(turn, load); else { stop(); load(); }
    if (user) { if (user !== "step") onPick?.(); detail.scrollIntoView({ block: "nearest" }); }
  }

  // The goal, once the case has played to its end. Met: the panel says so in data-goal and
  // the cube shows it. Not met should never happen; it is a guard against a silent wrong result.
  function judge(s) {
    const n = s.seq.n, atEnd = active && !turning && resolved && n > 0 && s.play.index >= n && s.play.t === 0;
    const met = atEnd ? goalMet(resolved, s.trace.states[n]) : null;
    if (met === true) side.setAttribute("data-goal", "met"); else side.removeAttribute("data-goal");
    warn.hidden = met !== false;
  }

  mirrorBtn.addEventListener("click", () => {
    if (!active || !resolved?.mirror || mirrorBtn.getAttribute("aria-disabled") === "true") return;
    if (resolved.mirror.kind === "case") { go({ ...cur, case: resolved.mirror.to }, true); return; }
    mirrored = !mirrored;
    load();
  });

  renderSteps();
  renderStep();
  resolved = resolve(cur, false);
  renderDetail();

  return {
    timelineSlot: slot,
    detailEl: detail,
    /** The cube is being turned over between steps (what is loaded is not a case). */
    get turning() { return turning; },
    get selection() { return { ...cur }; },
    /** The selected case's name, for the saved picture's title. */
    get caseName() { return resolved?.case.name || ""; },
    /** Another method: its first case. */
    setMethod(id) { if (id !== cur.method) go(firstSel(id), true); },
    /** The panel is on screen: play the selected case. */
    activate() { active = true; stop(); load(); },
    deactivate() { active = false; stop(); side.removeAttribute("data-goal"); warn.hidden = true; },
    update(s) {
      if (!active) return;
      if (pending && !s.busy && s.play.index >= 1 && !s.play.playing) { const f = pending; pending = null; f(); return; }
      judge(s);
    },
  };
}
