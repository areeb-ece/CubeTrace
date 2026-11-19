// Colour maths on "#rrggbb" strings: contrast, mixing, desaturating and perceptual
// distance. Pure, so the drawing code and the theme tests share one definition.

/** "#rrggbb" → [r, g, b] in 0–1 (sRGB, gamma-encoded). */
export const parseHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
/** [r, g, b] in 0–1 → "#rrggbb" (clamped, rounded). */
export const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

export const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** WCAG relative luminance. */
export const luminance = (hex) => parseHex(hex).reduce((n, c, k) => n + toLinear(c) * [0.2126, 0.7152, 0.0722][k], 0);
/** WCAG contrast ratio, 1 to 21. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** a mixed with b: t = 0 is a, t = 1 is b. Done in linear light, as light really mixes. */
export function mix(a, b, t) {
  const x = parseHex(a).map(toLinear), y = parseHex(b).map(toLinear);
  return toHex(x.map((v, i) => toSrgb(v + (y[i] - v) * t)));
}

/** Toward the grey of the same luminance: t = 0 unchanged, t = 1 colourless. Keeps contrast with the ground. */
export function desaturate(hex, t) {
  const y = luminance(hex);
  return mix(hex, toHex([toSrgb(y), toSrgb(y), toSrgb(y)]), t);
}

/** sRGB → CIELAB (D65). */
export function lab(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** CIE76 colour difference: the plain distance in CIELAB. About 2.3 is just noticeable. */
export function deltaE(a, b) {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
