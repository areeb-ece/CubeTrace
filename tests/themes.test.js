// The drawing colours come from the shared palette, so they have to stay readable in
// every theme it has (the copy in assets/design/ is the master's). The sticker colours
// are fixed, so they are checked once: against the cube's body and against each other.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BODY, STICKERS, LETTERS, inkOn, keptColour } from "../js/palette.js";
import { contrast, deltaE } from "../js/lib/colour.js";

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

// Roles (PLAN.md section 6): a kept piece's sticker is its colour quieted toward the sheet,
// an ignored one is the theme's --ink-4. Both must stay readable on the plastic and tell
// the stickers apart, whatever the theme.
for (const [name, vars] of Object.entries(themes())) {
  test(`kept and ignored stickers hold up in the ${name} theme`, () => {
    const kept = Object.fromEntries(Object.entries(STICKERS).map(([face, hex]) => [face, keptColour(hex, vars["--sheet"])]));
    const faces = Object.keys(kept);
    for (const f of faces) assert.ok(contrast(kept[f], BODY) >= 3, `kept ${f} ${kept[f]} on the body: ${contrast(kept[f], BODY).toFixed(2)}:1`);
    for (const a of faces) for (const b of faces) {
      if (a < b) assert.ok(deltaE(kept[a], kept[b]) >= 15, `kept ${a} and ${b}: ΔE ${deltaE(kept[a], kept[b]).toFixed(1)}`);
    }
    const grey = vars["--ink-4"];
    assert.ok(contrast(grey, BODY) >= 1.6, `ignored grey ${grey} on the body: ${contrast(grey, BODY).toFixed(2)}:1`);
    for (const [f, hex] of Object.entries(STICKERS)) assert.ok(deltaE(grey, hex) >= 20, `ignored grey ${grey} and ${f}: ΔE ${deltaE(grey, hex).toFixed(1)}`);
  });
}
