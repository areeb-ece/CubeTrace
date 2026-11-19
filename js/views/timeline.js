// The algorithm timeline, in the side panel under the moves box: the moves as chips,
// brackets over the pairs that undo each other, a band under each chunk and the chunk's
// caption. Plain DOM; the chunks, captions and bracket levels come from lib/chunks.js.
// Also the commutator note and its "where X and Y meet" switch (which sets store.meet).
import { h, clear } from "../ui.js";
import { moveText } from "../lib/moves.js";
import { inversePairs, overlap } from "../lib/structure.js";
import { chunkAt, captionFor, bracketLevels, commutatorNote, BAND_LABEL } from "../lib/chunks.js";

const SVGNS = "http://www.w3.org/2000/svg";
const ARC_STEP = 6, ARC_GAP = 3; // px between stacked brackets, and above the chips

const svgEl = (tag, attrs) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

export function mountTimeline(root, store, player) {
  const row = h("div", { class: "tl-row" });
  const arcs = svgEl("svg", { class: "tl-arcs", "aria-hidden": "true", focusable: "false" });
  const caption = h("p", { class: "tl-caption" });
  const noteText = h("code", { class: "tl-note" });
  const toggle = h("button", { class: "sd-btn sd-small", type: "button", "aria-pressed": "false", text: "Show where X and Y meet" });
  const why = h("p", { class: "sd-hint", text: "These are the only pieces both parts move, so they are where [X, Y] does its work." });
  const comm = h("div", { class: "tl-comm", hidden: true }, noteText, toggle, why);
  root.append(h("div", { class: "tl-wrap" }, arcs, row), caption, comm);

  let seq = null, chips = [], levels = [], ids = null, on = false, tab = -1;
  const current = (s) => (s.seq.n === 0 ? -1 : Math.min(s.play.index, s.seq.n - 1));

  // Chips go in a wrapper per chunk, so a band can sit under exactly its moves.
  function build(s) {
    clear(row);
    chips = [];
    const { moves, chunks } = s.seq;
    for (const c of chunks) {
      const group = h("div", { class: "tl-chunk", "data-role": c.role || "none" });
      const line = h("div", { class: "tl-chips" });
      for (let i = c.start; i < c.end; i++) {
        const chip = h("button", { class: "tl-chip", type: "button", tabindex: "-1", "data-i": String(i), text: moveText(moves[i]) });
        chips[i] = chip;
        line.append(chip);
      }
      group.append(line);
      if (c.role) {
        group.append(h("span", { class: "tl-band", "data-role": c.role }));
        const label = c.name ?? BAND_LABEL[c.role];
        if (label) group.append(h("span", { class: "tl-label", text: label }));
      }
      row.append(group);
    }
    levels = bracketLevels(inversePairs(moves));
    // every chunk leaves room above for the tallest bracket
    const top = levels.length ? (Math.max(...levels.map((l) => l.level)) + 1) * ARC_STEP + ARC_GAP : 0;
    row.style.setProperty("--tl-arc", top + "px");
  }

  // Brackets: a path up from each chip, across at its level and down to its partner. A pair
  // that wraps onto two lines becomes two half brackets running to the row's edges.
  function drawArcs() {
    clear(arcs);
    const r = row.getBoundingClientRect();
    if (!levels.length || !r.width) return;
    arcs.setAttribute("width", String(r.width));
    arcs.setAttribute("height", String(r.height));
    const box = (i) => { const b = chips[i].getBoundingClientRect(); return { x: b.left + b.width / 2 - r.left, y: b.top - r.top - ARC_GAP }; };
    const add = (d, i, j) => arcs.append(svgEl("path", { class: "tl-arc", d, fill: "none", "stroke-width": "1.5", "stroke-linejoin": "round", "data-i": i, "data-j": j }));
    for (const { i, j, level } of levels) {
      const a = box(i), b = box(j), up = level * ARC_STEP + ARC_STEP;
      if (Math.abs(a.y - b.y) < 2) add(`M${a.x} ${a.y}V${a.y - up}H${b.x}V${b.y}`, i, j);
      else {
        add(`M${a.x} ${a.y}V${a.y - up}H${r.width}`, i, j);
        add(`M0 ${b.y - up}H${b.x}V${b.y}`, i, j);
      }
    }
  }

  function mark(s) {
    const cur = current(s), c = chunkAt(s.seq.chunks, cur);
    chips.forEach((chip, i) => {
      if (i === cur) chip.setAttribute("aria-current", "step"); else chip.removeAttribute("aria-current");
      chip.tabIndex = i === (tab >= 0 ? tab : cur) ? 0 : -1;
    });
    if (chips.length && !chips[tab >= 0 ? tab : cur]) tab = -1;
    const text = s.seq.n ? captionFor(c) : null;
    caption.textContent = text || "";
    caption.hidden = !text;
  }

  // The commutator note, and the pieces to outline while the switch is on.
  function note(s) {
    const c = s.seq.n ? commutatorNote(s.seq.moves) : null;
    comm.hidden = !c;
    ids = c ? overlap(c.xMoves, c.yMoves) : null;
    if (c) noteText.textContent = `[${c.x}, ${c.y}]`;
    toggle.setAttribute("aria-pressed", String(on && !!c));
  }
  function publishMeet() {
    const want = on && ids ? ids : null;
    if (store.state.meet !== want) store.set("meet", want);
  }
  toggle.addEventListener("click", () => { on = !on; toggle.setAttribute("aria-pressed", String(on)); publishMeet(); });

  row.addEventListener("click", (e) => {
    const chip = e.target.closest(".tl-chip");
    if (chip) { tab = Number(chip.dataset.i); player.seek(tab); }
  });
  row.addEventListener("focusin", (e) => { const i = e.target.dataset?.i; if (i != null) tab = Number(i); });
  row.addEventListener("focusout", (e) => { if (!row.contains(e.relatedTarget)) { tab = -1; mark(store.state); } });
  row.addEventListener("keydown", (e) => {
    const i = Number(e.target.dataset?.i);
    if (!Number.isInteger(i) || e.ctrlKey || e.metaKey || e.altKey) return;
    const to = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : e.key === "Home" ? 0 : e.key === "End" ? chips.length - 1 : null;
    if (to == null) return;
    chips[Math.max(0, Math.min(chips.length - 1, to))].focus();
    e.preventDefault();
  });
  new ResizeObserver(() => { if (seq) drawArcs(); }).observe(row);

  return {
    update(s) {
      if (s.seq !== seq) {
        seq = s.seq;
        root.hidden = seq.n === 0;
        tab = -1;
        if (seq.n) { build(s); note(s); publishMeet(); }
        else { ids = null; publishMeet(); }
        drawArcs();
      }
      if (seq.n) mark(s);
    },
  };
}
