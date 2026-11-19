// The shell: one shared state, the docking workspace, the View options and what is
// remembered between visits. Each view is a module { id, title, mount }.
import { createStore, ALL } from "./store.js";
import { createDock, stack, row } from "./dock.js";
import { h, storage } from "./ui.js";
import { onThemeChange } from "./palette.js";
import { solved, applyMoves } from "./lib/cube.js";
import { parse, NotationError } from "./lib/notation.js";
import { DEFAULT_CAMERA } from "./lib/scene.js";
import cube from "./views/cube.js";
import net from "./views/net.js";

const VIEWS = [cube, net];
const OPTIONS_KEY = "cubetrace.options", LAYOUT_KEY = "cubetrace.layout", VERSION = 1;
const DEFAULT_LAYOUT = () => row([0.62, 0.38], stack("cube"), stack("net"));

// ── what is remembered: the options, validated ──
function restoreOptions() {
  const o = storage.get(OPTIONS_KEY), ok = o && o.v === VERSION && typeof o === "object";
  const flag = (v, d) => (ok && typeof v === "boolean" ? v : d);
  return { letters: flag(o?.letters, false), mirrors: flag(o?.mirrors, true), spring: flag(o?.spring, true) };
}

const store = createStore({
  moves: "", state: solved(), error: null, camera: { ...DEFAULT_CAMERA }, opts: restoreOptions(),
});
const { state } = store;

// ── the workspace ──
const host = document.getElementById("dock");
const made = {};
const dock = createDock(host, {
  titles: Object.fromEntries(VIEWS.map((v) => [v.id, v.title])),
  elFor(id) {
    if (!made[id]) {
      const el = h("div", { class: "view", "data-view": id });
      made[id] = { el, view: VIEWS.find((v) => v.id === id).mount(el, store) };
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
function readMoves() {
  const text = box.value;
  store.set("moves", text);
  try {
    store.set("state", applyMoves(solved(), parse(text).moves));
    store.set("error", null);
  } catch (e) {
    if (!(e instanceof NotationError)) throw e;
    store.set("error", { message: e.message, where: where(text, Math.min(e.at, text.length)) });
  }
}
box.addEventListener("input", () => { clearTimeout(typing); typing = setTimeout(readMoves, 150); });
function drawError(err) {
  errBox.hidden = !err;
  errText.textContent = err ? err.message : "";
  errWhere.textContent = err ? err.where : "";
  box.setAttribute("aria-invalid", String(!!err));
  host.toggleAttribute("data-stale", !!err);
}

// ── the View menu ──
const pop = document.getElementById("viewPop"), btnView = document.getElementById("btnView");
const checks = { letters: document.getElementById("optLetters"), mirrors: document.getElementById("optMirrors"), spring: document.getElementById("optSpring") };
for (const [key, input] of Object.entries(checks)) {
  input.checked = state.opts[key];
  input.addEventListener("change", () => {
    store.set("opts", { ...state.opts, [key]: input.checked });
    storage.set(OPTIONS_KEY, { v: VERSION, ...state.opts });
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

// ── every change, once per frame ──
store.on((s, dirty) => {
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
