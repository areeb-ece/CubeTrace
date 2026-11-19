// Canvas can't read CSS variables, so the drawing colours are resolved here from the
// shared palette, once per theme. One role, one token, in every view.
//
// The sticker colours and the cube's body are the one exception to "no raw colours":
// they are identities, not theme hues, so they are the same in every theme and never
// reach CSS. tests/themes.test.js checks them against the body and each other. Nothing
// here touches the document until palette() is called, so Node can import the constants.
import { luminance, mix, desaturate, toHex } from "./lib/colour.js";

const ROLES = {
  setup: "--c0",      // the pieces an algorithm sets up (and puts back)
  trigger: "--c2",    // the repeated core of an algorithm
  insert: "--c5",     // the move that inserts
  trail: "--c3",      // where a piece has been
  ink: "--ink", ink2: "--ink-2", ink3: "--ink-3", ink4: "--ink-4",
  rule: "--rule", rule2: "--rule-2", sheet: "--sheet", card: "--card", bg: "--bg",
  accent: "--accent", tint: "--tint", well: "--well",
};

/** The plastic: near-black, so a sticker never touches the page and one palette suits every sheet. */
export const BODY = "#101114";
/** Sticker colour by home face: white U, yellow D, green F, blue B, red R, orange L. */
export const STICKERS = { U: "#F2F2EE", D: "#FFD60A", F: "#18A957", B: "#2A62D6", R: "#D4261E", L: "#FF7F11" };
/** The letter written on a sticker when letters are on. */
export const LETTERS = { U: "W", D: "Y", F: "G", B: "B", R: "R", L: "O" };

/** Black on a light sticker, white on a dark one. */
export const inkOn = (hex) => (luminance(hex) > 0.18 ? "#000000" : "#FFFFFF");

/**
 * A kept piece's sticker: its colour half drained (toward the grey of the same
 * brightness, so it keeps its contrast with the plastic) and 8% toward the sheet, so it
 * sits back in every theme. tests/themes.test.js checks it in all of them.
 */
export const keptColour = (hex, sheet) => mix(desaturate(hex, 0.5), sheet, 0.08);
// An ignored sticker is the theme's own --ink-4, flat (pal.ink4): it is the one grey
// that is far enough from white and from the body in all 15 themes.

const caches = new Map();
let probeEl = null;

// "rgb(1 2 3)", "rgba(1, 2, 3, .5)" or "color(srgb .1 .2 .3)" → [r, g, b] in 0–1.
function parse(text) {
  const n = (text.match(/-?[\d.]+(e-?\d+)?%?/g) || []).map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v)));
  if (/^color\(/.test(text)) return n.slice(0, 3);
  return n.slice(0, 3).map((v) => v / 255);
}
const css = (c, a = 1) => `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)} / ${a})`;

/**
 * The colours to draw with. theme is "current" (what the page shows) or the name of a
 * theme, whose colours are read from a hidden element carrying that data-theme: the
 * master defines every theme on such elements too, so a picture can be saved in the
 * dark or the light sheet whatever the page is in.
 */
export function palette(theme = "current") {
  if (caches.has(theme)) return caches.get(theme);
  if (!probeEl) { probeEl = document.createElement("i"); probeEl.hidden = true; document.body.append(probeEl); }
  if (theme === "current") { probeEl.removeAttribute("data-theme"); probeEl.removeAttribute("data-scheme"); }
  else { probeEl.setAttribute("data-theme", theme); probeEl.setAttribute("data-scheme", theme === "light" ? "light" : "dark"); }
  const root = getComputedStyle(document.documentElement), rgb = {};
  for (const [role, token] of Object.entries(ROLES)) {
    probeEl.style.setProperty("color", `var(${token})`);
    rgb[role] = parse(getComputedStyle(probeEl).color);
  }
  const scheme = theme === "current" ? root.colorScheme : getComputedStyle(probeEl).colorScheme;
  const p = { rgb, theme, light: /light/.test(scheme) && !/dark/.test(scheme) };
  for (const role of Object.keys(ROLES)) p[role] = css(rgb[role]);
  p.alpha = (role, a) => css(rgb[role], a);
  // sticker colours for kept pieces on this sheet, and the flat grey of ignored ones
  const sheet = toHex(rgb.sheet);
  p.kept = Object.fromEntries(Object.entries(STICKERS).map(([face, hex]) => [face, keptColour(hex, sheet)]));
  p.ignored = p.ink4;
  p.mono = root.getPropertyValue("--font-mono").trim() || "monospace";
  p.text = root.getPropertyValue("--font-text").trim() || "sans-serif";
  caches.set(theme, p);
  return p;
}

/** Calls fn after the theme (or the visitor's accent or corners) changes. */
export function onThemeChange(fn) {
  let queued = false;
  const go = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; caches.clear(); fn(); });
  };
  new MutationObserver(go).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme", "style"] });
  // a stylesheet that arrives late (the offline copy of the design) changes the colours too
  addEventListener("load", go);
  document.fonts?.ready.then(go);
}
