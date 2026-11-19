// The shell: one shared state, the docking workspace, the View options and what is
// remembered between visits. Each view is a module { id, title, mount }.
import { createStore, ALL } from "./store.js";
import { createDock, stack, row, col } from "./dock.js";
import { h, storage } from "./ui.js";
import { onThemeChange } from "./palette.js";
import { HOLDINGS, ROLE_SETS } from "./lib/roles.js";
import { trace } from "./lib/trace.js";
import { parse, NotationError } from "./lib/notation.js";
import { DEFAULT_CAMERA } from "./lib/scene.js";
import cube from "./views/cube.js";
import net from "./views/net.js";
import ll from "./views/ll.js";
import { ROLE_NAMES } from "./views/stickers.js";
import { createPlayer } from "./player.js";
import { mountTransport, isSpeed } from "./transport.js";
import { mountKeys } from "./keys.js";
import { mountPrimer } from "./primer.js";
import { TYPING_DEBOUNCE } from "./timing.js";

const VIEWS = [cube, net, ll];
const OPTIONS_KEY = "cubetrace.options", LAYOUT_KEY = "cubetrace.layout", SEEN_KEY = "cubetrace.primerSeen", VERSION = 1;
const DEFAULT_LAYOUT = () => row([0.55, 0.45], stack("cube"), col([0.6, 0.4], stack("net"), stack("ll")));

// ── what is remembered: the options, validated ──
function restoreOptions() {
  const o = storage.get(OPTIONS_KEY), ok = o && o.v === VERSION && typeof o === "object";
  const flag = (v, d) => (ok && typeof v === "boolean" ? v : d);
  return {
    letters: flag(o?.letters, false), mirrors: flag(o?.mirrors, true), spring: flag(o?.spring, true), speed: ok && isSpeed(o?.speed) ? o.speed : 1,
    roleSet: ok && typeof o.roleSet === "string" && Object.hasOwn(ROLE_SETS, o.roleSet) ? o.roleSet : "all", full: flag(o?.full, false), netChange: flag(o?.netChange, false),
  };
}

const opts = restoreOptions();
const start = HOLDINGS[ROLE_SETS[opts.roleSet].holding];
const store = createStore({
  moves: "", start, trace: trace(start, []), state: start, shown: { state: start, turn: null }, guide: null, busy: false,
  hover: null, track: null, // a piece (cubie id) brushed by the pointer or keys, and one being followed
  play: { index: 0, t: 0, playing: false, speed: opts.speed }, seq: { n: 0, chunks: [] },
  error: null, camera: { ...DEFAULT_CAMERA }, opts,
});
const { state } = store;
const player = createPlayer(store);
const saveOptions = () => storage.set(OPTIONS_KEY, { v: VERSION, ...state.opts });

// ── the workspace ──
const host = document.getElementById("dock");
const made = {};
const dock = createDock(host, {
  titles: Object.fromEntries(VIEWS.map((v) => [v.id, v.title])),
  elFor(id) {
    if (!made[id]) {
      const el = h("div", { class: "view", "data-view": id });
      made[id] = { el, view: VIEWS.find((v) => v.id === id).mount(el, store) };
      if (id === "cube") mountKeys(el, { turn: turnByKey, player });
    }
    return made[id].el;
  },
  // a view that was off screen missed every change: tell it all of them
  onShow: (id) => requestAnimationFrame(() => made[id]?.view.update?.(state, ALL)),
  onChange: () => storage.set(LAYOUT_KEY, { v: VERSION, tree: dock.get() }),
});
const saved = storage.get(LAYOUT_KEY);
if (!(saved?.v === VERSION && saved.tree && dock.set(saved.tree))) dock.set(DEFAULT_LAYOUT());
const narrow = matchMedia("(max-width: 759px)");
const setNarrow = () => dock.setStacked(narrow.matches);
narrow.addEventListener("change", setNarrow);
setNarrow();

// ── the moves box ──
const box = document.getElementById("moves"), errBox = document.getElementById("movesError");
const errText = document.getElementById("errorText"), errWhere = document.getElementById("errorWhere");

// The line the error is on, cut to what fits, with a caret under the character.
function where(text, at) {
  const start = text.lastIndexOf("\n", at - 1) + 1, end = text.indexOf("\n", at) < 0 ? text.length : text.indexOf("\n", at);
  const from = Math.max(start, at - 24), to = Math.min(end, at + 24);
  return `${from > start ? "…" : ""}${text.slice(from, to)}${to < end ? "…" : ""}\n${" ".repeat(at - from + (from > start ? 1 : 0))}^`;
}
let typing = 0;
// Reads the box. Good moves go to the player (typing shows the end state, paused; a
// key press turns the new move); bad ones are reported and the last good state stays.
function readMoves(then = "set") {
  const text = box.value;
  store.set("moves", text);
  try {
    const moves = parse(text).moves;
    store.set("error", null);
    if (then === "append") player.append(moves); else player.setMoves(moves);
  } catch (e) {
    if (!(e instanceof NotationError)) throw e;
    store.set("error", { message: e.message, where: where(text, Math.min(e.at, text.length)) });
  }
}
box.addEventListener("input", () => { clearTimeout(typing); typing = setTimeout(readMoves, TYPING_DEBOUNCE); });
// A key turn writes the move on the end of the box (on a new line after a comment, which would swallow it).
function turnByKey(text) {
  clearTimeout(typing);
  const v = box.value, last = v.slice(v.lastIndexOf("\n") + 1);
  box.value = v + (last.includes("//") ? "\n" : v && !/\s$/.test(v) ? " " : "") + text;
  readMoves("append");
}
function drawError(err) {
  errBox.hidden = !err;
  errText.textContent = err ? err.message : "";
  errWhere.textContent = err ? err.where : "";
  box.setAttribute("aria-invalid", String(!!err));
  host.toggleAttribute("data-stale", !!err);
}

// ── what to show: the role set, and so the cube the moves start from ──
const roleSel = document.getElementById("roleSet");
for (const [id, name] of Object.entries(ROLE_NAMES)) roleSel.append(h("option", { value: id, text: name }));
roleSel.value = state.opts.roleSet;
roleSel.addEventListener("change", () => {
  store.set("opts", { ...state.opts, roleSet: roleSel.value });
  player.setStart(HOLDINGS[ROLE_SETS[roleSel.value].holding]);
});

// ── the View menu ──
const pop = document.getElementById("viewPop"), btnView = document.getElementById("btnView");
const checks = { letters: document.getElementById("optLetters"), mirrors: document.getElementById("optMirrors"), spring: document.getElementById("optSpring") };
for (const [key, input] of Object.entries(checks)) {
  input.checked = state.opts[key];
  input.addEventListener("change", () => {
    store.set("opts", { ...state.opts, [key]: input.checked });
  });
}
pop.addEventListener("toggle", (e) => {
  const open = e.newState === "open";
  btnView.setAttribute("aria-expanded", String(open));
  if (!open) return;
  const r = btnView.getBoundingClientRect();
  pop.style.setProperty("top", r.bottom + 4 + "px");
  pop.style.setProperty("left", Math.max(8, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8)) + "px");
  checks.letters.focus();
});
document.getElementById("btnReset").addEventListener("click", () => { storage.remove(LAYOUT_KEY); dock.set(DEFAULT_LAYOUT()); pop.hidePopover(); });

// ── the transport strip, the keys and the two dialogs ──
const transport = mountTransport(document.getElementById("strip"), store, player, {
  onSpeed(v) { player.setSpeed(v); store.set("opts", { ...state.opts, speed: v }); },
  onFull() { store.set("opts", { ...state.opts, full: !state.opts.full }); },
});
const callout = document.getElementById("primerCallout");
const seen = () => { storage.set(SEEN_KEY, true); callout.hidden = true; };
callout.hidden = !!storage.get(SEEN_KEY);
const primer = mountPrimer(document.getElementById("primer"), store, { onOpen: seen });
document.getElementById("btnNotation").addEventListener("click", primer.open);
document.getElementById("btnPrimerOpen").addEventListener("click", primer.open);
document.getElementById("btnPrimerDismiss").addEventListener("click", seen);
const keysDialog = document.getElementById("keysDialog");
document.getElementById("btnKeys").addEventListener("click", () => keysDialog.showModal());
// a click on the backdrop (the dialog element itself) or the × closes a dialog
for (const d of document.querySelectorAll("dialog.sd-dialog")) {
  d.querySelector(".sd-x").addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
}
transport.update(state);

// ── every change, once per frame ──
store.on((s, dirty) => {
  if (dirty.has("opts")) saveOptions();
  transport.update(s);
  if (dirty.has("error")) drawError(s.error);
  for (const id in made) if (dock.isShown(id)) made[id].view.update?.(s, dirty);
});
onThemeChange(() => store.touch("theme"));
// The letters are drawn in mononoki: draw again once it has loaded.
document.fonts.load("700 12px mononoki").then(() => store.touch("theme"), () => {});

// ── the skip link and the offline light/dark switch ──
document.getElementById("skip").addEventListener("click", () => (host.querySelector("[role='tab']") || host).focus());
if (!window.SiteDesign) {
  const btn = document.getElementById("btnTheme"), root = document.documentElement;
  const name = () => (btn.textContent = root.dataset.theme === "light" ? "Dark" : "Light");
  btn.hidden = false;
  name();
  btn.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem("cubetrace.theme", root.dataset.theme); } catch (e) { /* this visit only */ }
    name();
  });
}
