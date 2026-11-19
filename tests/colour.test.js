import test from "node:test";
import assert from "node:assert/strict";
import { parseHex, toHex, toLinear, toSrgb, luminance, contrast, mix, desaturate, lab, deltaE } from "../js/lib/colour.js";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test("hex round-trips, and sRGB ↔ linear are inverses", () => {
  assert.deepEqual(parseHex("#FF8000").map((v) => Math.round(v * 255)), [255, 128, 0]);
  assert.equal(toHex(parseHex("#12AB9F")), "#12AB9F");
  assert.equal(toHex([2, -1, 0.5]), "#FF0080", "clamped");
  for (const c of [0, 0.002, 0.04, 0.3, 0.8, 1]) near(toSrgb(toLinear(c)), c);
});

test("luminance and contrast match the WCAG figures", () => {
  near(luminance("#FFFFFF"), 1);
  near(luminance("#000000"), 0);
  near(contrast("#FFFFFF", "#000000"), 21, 1e-9);
  near(contrast("#000000", "#FFFFFF"), 21, 1e-9);
  near(contrast("#777777", "#777777"), 1);
  assert.ok(Math.abs(contrast("#767676", "#FFFFFF") - 4.54) < 0.01, "the classic 4.5:1 grey");
});

test("mix runs from a to b in linear light", () => {
  assert.equal(mix("#102030", "#F0E0D0", 0), "#102030");
  assert.equal(mix("#102030", "#F0E0D0", 1), "#F0E0D0");
  assert.equal(mix("#000000", "#FFFFFF", 0.5), "#BCBCBC", "half-way in light is not half-way in code values");
});

test("desaturate drains colour and keeps brightness", () => {
  const c = "#D4261E";
  assert.equal(desaturate(c, 0), c);
  const grey = parseHex(desaturate(c, 1));
  near(grey[0], grey[1], 0.005);
  near(grey[1], grey[2], 0.005);
  near(luminance(desaturate(c, 0.5)), luminance(c), 0.01);
  assert.ok(lab(desaturate(c, 0.5)).slice(1).map(Math.abs).every((v, i) => v < Math.abs(lab(c)[i + 1])), "less chroma on both axes");
});

test("ΔE76 is the distance in CIELAB", () => {
  const [l, a, b] = lab("#FFFFFF");
  near(l, 100, 0.01);
  near(a, 0, 0.05);
  near(b, 0, 0.05);
  near(lab("#000000")[0], 0, 1e-6);
  near(deltaE("#FFFFFF", "#000000"), 100, 0.01);
  near(deltaE("#336699", "#336699"), 0);
  near(deltaE("#336699", "#996633"), deltaE("#996633", "#336699"));
  assert.ok(deltaE("#FF0000", "#00FF00") > 80);
  near(lab("#FF0000")[1], 80.1, 0.2); // the textbook red
});
