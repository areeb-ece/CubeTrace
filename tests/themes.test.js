// The drawing colours come from the shared palette, so they have to stay readable in
// every theme it has (the copy in assets/design/ is the master's). The sticker colours
// are fixed, so they are checked once: against the cube's body and against each other.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BODY, STICKERS, LETTERS, inkOn } from "../js/palette.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(ROOT, "assets/design/tokens.css"), "utf8");
const palette = fs.readFileSync(path.join(ROOT, "js/palette.js"), "utf8");

function themes() {
  const out = {};
  for (const m of css.matchAll(/(?::root, |:root\[data-theme="[\w-]+"\], )\[data-theme="([\w-]+)"\] \{([^}]*)\}/g)) {
    const vars = {};
    for (const v of m[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
    out[m[1]] = vars;
  }
  return out;
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => rgb(hex).reduce((n, c, k) => n + lin(c) * [0.2126, 0.7152, 0.0722][k], 0);
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

// sRGB → CIELAB (D65), and the plain distance between two colours in it
function lab(hex) {
  const [r, g, b] = rgb(hex).map(lin);
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

// role → token, read from js/palette.js so the test follows the code
const roles = Object.fromEntries([...palette.matchAll(/^\s+(\w+): "(--c\d)",/gm)].map((m) => [m[1], m[2]]));

test("the palette module names a token for each role", () => {
  assert.deepEqual(Object.keys(roles).sort(), ["insert", "setup", "trail", "trigger"]);
  assert.equal(new Set(Object.values(roles)).size, 4, "one token per role");
});

test("there are themes to check", () => {
  const all = themes();
  assert.ok(Object.keys(all).length >= 15, `found ${Object.keys(all).length} themes`);
  assert.ok(all.dark && all.light);
});

for (const [name, vars] of Object.entries(themes())) {
  test(`drawing colours are readable in the ${name} theme`, () => {
    for (const [role, token] of Object.entries(roles)) {
      for (const ground of ["--sheet", "--bg"]) {
        const c = contrast(vars[token], vars[ground]);
        assert.ok(c >= 3, `${role} (${token} ${vars[token]}) on ${ground} (${vars[ground]}) is ${c.toFixed(2)}:1`);
      }
    }
    for (const token of ["--ink", "--ink-2", "--ink-3"]) assert.ok(contrast(vars[token], vars["--sheet"]) >= 4.5, `${token} as text`);
    // the cube's outline is --ink-3, drawn on the sheet's neighbours
    for (const ground of ["--bg", "--card"]) assert.ok(contrast(vars["--ink-3"], vars[ground]) >= 3, `--ink-3 outline on ${ground}`);
  });
}

test("every sticker stands out from the cube's body", () => {
  for (const [face, hex] of Object.entries(STICKERS)) assert.ok(contrast(hex, BODY) >= 3, `${face} ${hex} on the body ${BODY}: ${contrast(hex, BODY).toFixed(2)}:1`);
});

test("no two stickers can be mistaken for each other", () => {
  const faces = Object.keys(STICKERS);
  assert.deepEqual(faces.sort(), ["B", "D", "F", "L", "R", "U"]);
  for (const a of faces) for (const b of faces) {
    if (a < b) assert.ok(deltaE(STICKERS[a], STICKERS[b]) >= 20, `${a} and ${b}: ΔE ${deltaE(STICKERS[a], STICKERS[b]).toFixed(1)}`);
  }
});

test("letters are one per colour and readable on their sticker", () => {
  assert.equal(new Set(Object.values(LETTERS)).size, 6);
  for (const [face, hex] of Object.entries(STICKERS)) assert.ok(contrast(inkOn(hex), hex) >= 4.5, `${face}: letter on ${hex}`);
});
