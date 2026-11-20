// Predict mode (PLAN.md section 6): before each move (or chunk) of the lesson's case one
// piece is marked, and the learner picks the slot it will end up in, on the cube or the
// net. Then the move plays and the answer is shown. This is the state machine; what to
// ask and whether it was right come from lib/predict.js, and the marks are drawn by the
// views from store.predict:
//   { phase: "ask" | "play" | "shown" | "done", target, choice, answer, right, from, to, streak }
// The streak lives in memory only: a visit is a session, and a wrong answer ends it.
import { announce } from "./announce.js";
import { block } from "./ui.js";
import { roles } from "./lib/roles.js";
import { units, pickTarget, judge, verdict, question } from "./lib/predict.js";

/** bar: the elements of the strip's Predict bar; learn: the Learn panel (it says when a turn-over is playing). */
export function mountPredict({ bar, store, player, learn }) {
  const { prompt, next, streakEl, bySeg } = bar;
  let active = false, by = "move", list = [], k = 0, streak = 0, key = null, surface = null;
  const set = (part) => {
    const next = { ...store.state.predict, ...part, streak };
    store.set("predict", next);
    streakEl.textContent = `Streak: ${streak}`;
    bar.el.dataset.phase = next.phase;
  };
  const idle = () => store.set("predict", null);

  function say(text) { prompt.textContent = text; announce(text); }

  // the next run that has a piece to ask about; the ones where nothing moves go by unasked
  function ask() {
    const s = store.state, roleOf = roles(s.opts.roleSet);
    while (k < list.length) {
      const [from, to] = list[k], target = pickTarget(s.trace.states[from], s.trace.states[to], roleOf, k);
      if (target == null) { k++; continue; }
      player.seek(from);
      set({ phase: "ask", target, choice: null, answer: null, right: null, from, to });
      bar.verdict(null);
      say(`${question(target)} Click its place on the cube or the net.`);
      block(next, "Answer the question first");
      next.textContent = "Next";
      return;
    }
    player.seek(s.seq.n);
    set({ phase: "done", target: null, choice: null, answer: null, right: null });
    bar.verdict(null);
    say("That was the whole case. Choose another, or go again.");
    block(next, "");
    next.textContent = "Again";
  }
  function begin() {
    list = units(store.state.seq.chunks, store.state.seq.n, by);
    k = 0;
    ask();
  }

  /** The learner names slot `pos` (from the cube, or from `el`, the net). */
  function answer(pos, el) {
    const s = store.state, p = s.predict;
    if (!active || p?.phase !== "ask") return;
    const res = judge(s.trace.states[p.to], p.target, pos);
    surface = el || null;
    set({ phase: "play", choice: pos, answer: res.answer, right: res.right });
    if (by === "chunk") player.playChunk(); else player.step(1);
  }
  function advance() {
    const p = store.state.predict;
    if (p?.phase === "shown") { k++; ask(); surface?.focus({ preventScroll: true }); }
    else if (p?.phase === "done") begin();
  }
  next.addEventListener("click", advance);
  for (const b of bySeg.querySelectorAll("button")) b.addEventListener("click", () => {
    if (!active || b.dataset.by === by) return;
    by = b.dataset.by;
    for (const x of bySeg.querySelectorAll("button")) x.setAttribute("aria-checked", String(x === b));
    if (store.state.seq.n) begin();
  });

  return {
    answer,
    get active() { return active; },
    setActive(on) {
      if (on === active) return;
      active = on;
      key = null;
      bar.el.hidden = !on;
      if (!on) idle();
    },
    /** Every store change: a new case starts the questions again; a finished move shows the answer. */
    update(s) {
      if (!active) return;
      if (learn.turning) { if (s.predict) idle(); key = null; return; }
      if (s.seq.n && (key?.seq !== s.seq || key.start !== s.start)) { key = { seq: s.seq, start: s.start }; begin(); return; }
      const p = s.predict;
      if (p?.phase === "play" && !s.busy && s.play.index === p.to && s.play.t === 0) {
        streak = p.right ? streak + 1 : 0;
        set({ phase: "shown" });
        const text = verdict(p.right, p.target, p.answer);
        bar.verdict(p.right);
        say(text);
        block(next, "");
        next.focus({ preventScroll: true });
      }
    },
  };
}
