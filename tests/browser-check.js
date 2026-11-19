/* End-to-end check in a real browser (needs Playwright: `npm i --no-save playwright@1.56.1`).
 * Serves the site at /CubeTrace/ as GitHub Pages does and asserts: no script errors, no
 * Content Security Policy violations, no request leaves the page's own files, no sideways
 * scrolling at laptop or phone width; both canvases are drawn; typing moves changes the
 * net, and a move the parser refuses is reported in words while the last good state stays;
 * the cube springs back after an orbit; the View options are remembered; storage can be
 * missing. Screenshots go to test-results/screenshots/.
 *
 * The shared theme, settings panel and night sky live in the portfolio repo
 * (areeb-ece.github.io, public/design/). Without them the page must fall back to its own
 * copy (assets/design/) and its light/dark switch, which is what runs by default. To
 * check the real thing:
 *   DESIGN_DIR=../areeb-ece.github.io/public/design npm run test:browser */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { serve, ROOT, BASE_PATH } from "./serve.js";
import { netLayout, netCell } from "../js/lib/layout2d.js";
import { STICKERS } from "../js/palette.js";

// Playwright from this folder's node_modules, or a machine-wide install.
const { chromium } = await import("playwright").catch(() => createRequire(import.meta.url)("playwright"));

const SHOTS = path.join(ROOT, "test-results", "screenshots");
const { server, origin, design } = await serve();
const base = origin + BASE_PATH;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
fs.mkdirSync(SHOTS, { recursive: true });

const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function open(viewport, init, more = {}) {
  const context = await browser.newContext({ viewport, ...more });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [], outside = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) outside.push(r.url()); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  });
  await page.goto(base);
  await page.waitForSelector(".dk-stack");
  // Hold the sky still: nothing checked here moves, and its drift repaints every frame.
  if (design) await page.evaluate(() => window.SiteDesign?.set({ motion: false }));
  await frame(page);
  const clean = async (what) => {
    assert.deepEqual(errors, [], `${what}: script errors`);
    assert.deepEqual(await page.evaluate(() => window.__csp), [], `${what}: CSP violations`);
    assert.deepEqual(outside, [], `${what}: requests leaving the site`);
    const wide = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert.ok(wide[0] <= wide[1] + 1, `${what} scrolls sideways: ${wide}`);
  };
  return { page, context, clean };
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + ".png") });

// ── the canvases ──
const NET = '.view[data-view="net"] canvas', CUBE = '.view[data-view="cube"] canvas';
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// The colour at the middle of sticker (row, col) of a face on the net, found with the same
// layout code the view draws with.
async function netColour(page, face, row, col) {
  const size = await page.$eval(NET, (c) => [c.clientWidth, c.clientHeight]);
  const c = netCell(netLayout(...size), face, row, col);
  return page.$eval(NET, (cv, [x, y]) => {
    const r = cv.width / cv.clientWidth, d = cv.getContext("2d").getImageData(Math.round(x * r), Math.round(y * r), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, [c.x + c.size / 2, c.y + c.size / 2]);
}
async function assertSticker(page, face, row, col, home, what) {
  const [r, g, b, a] = await netColour(page, face, row, col), want = hex(STICKERS[home]);
  assert.ok(a === 255 && [r, g, b].every((v, i) => Math.abs(v - want[i]) <= 6), `${what}: ${face}${row}${col} is rgb(${r} ${g} ${b}), want ${home} ${STICKERS[home]}`);
}
// every face's middle sticker is its own colour on a solved cube
const assertSolvedNet = async (page, what) => { for (const f of "UDLRFB") await assertSticker(page, f, 1, 1, f, what); await assertSticker(page, "U", 0, 0, "U", what); };
const painted = (page, sel) => page.$eval(sel, (cv) => {
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] !== d[3] || d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) n++;
  return n;
});
const picture = (page, sel) => page.$eval(sel, (cv) => cv.toDataURL());
const typeMoves = async (page, text) => { await page.fill("#moves", text); await page.waitForTimeout(350); await frame(page); };
const openViews = (page) => page.$$eval(".dk-stack", (els) => els.map((e) => e.dataset.view));

let failed = false;
try {
  // ── laptop ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 });
    if (design) {
      assert.ok(await page.isVisible("#designSettings"), "shared settings button");
      assert.ok(await page.isHidden("#btnTheme"), "fallback switch hidden");
      assert.ok((await page.$$eval("#stage .sky circle", (c) => c.length)) > 0, "stars behind the panels");
    } else {
      assert.ok(await page.isVisible("#btnTheme"), "offline light/dark switch");
    }
    assert.deepEqual(await openViews(page), ["cube", "net"]);
    assert.equal(await page.$eval("#moves", (t) => t.value), "");
    assert.ok(await page.isHidden("#movesError"));
    assert.match(await page.getAttribute(CUBE, "aria-label"), /^Cube seen from the up, front and right faces$/);
    assert.equal(await page.getAttribute(CUBE, "role"), "img");

    // both canvases show a cube
    assert.ok((await painted(page, CUBE)) > 5000, "the cube canvas isn't blank");
    await assertSolvedNet(page, "solved");

    // typing R: the right column of F goes up to U
    await typeMoves(page, "R");
    for (let row = 0; row < 3; row++) await assertSticker(page, "U", row, 2, "F", "after R");
    for (let row = 0; row < 3; row++) await assertSticker(page, "U", row, 0, "U", "after R");
    assert.ok(await page.isHidden("#movesError"));
    const afterR = await picture(page, NET);

    // a move that isn't one: said in words, the last good picture stays
    await typeMoves(page, "R Q");
    assert.ok(await page.isVisible("#movesError"));
    assert.match(await page.textContent("#errorText"), /Q/);
    assert.match(await page.textContent("#errorWhere"), /R Q\n\s+\^/);
    assert.equal(await page.getAttribute("#moves", "aria-invalid"), "true");
    for (let row = 0; row < 3; row++) await assertSticker(page, "U", row, 2, "F", "after R Q");
    await shot(page, `laptop-error-${design ? "shared" : "offline"}`);
    await typeMoves(page, "");
    assert.ok(await page.isHidden("#movesError"));
    await assertSolvedNet(page, "emptied");
    await typeMoves(page, "R");
    assert.equal(await picture(page, NET), afterR, "R draws the same net again");

    // orbiting: dragging turns the cube, letting go springs it back
    const cubeBefore = await picture(page, CUBE);
    const box = await page.locator(CUBE).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2 + 60, { steps: 6 });
    await frame(page);
    assert.notEqual(await picture(page, CUBE), cubeBefore, "dragging turns the cube");
    await page.mouse.up();
    await page.waitForTimeout(900);
    await frame(page);
    assert.equal(await picture(page, CUBE), cubeBefore, "the cube springs back");

    // the View options: mirror panes on, letters off, remembered
    await page.click("#btnView");
    assert.equal(await page.isChecked("#optMirrors"), true);
    assert.equal(await page.isChecked("#optLetters"), false);
    await page.check("#optLetters");
    await frame(page);
    assert.notEqual(await picture(page, CUBE), cubeBefore, "letters change the cube");
    await page.uncheck("#optMirrors");
    await frame(page);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("cubetrace.options"))), { v: 1, letters: true, mirrors: false, spring: true });
    await page.keyboard.press("Escape");
    await shot(page, `laptop-letters-${design ? "shared" : "offline"}`);
    await clean("laptop");
    await page.reload();
    await page.waitForSelector(".dk-stack");
    assert.equal(await page.evaluate(() => [optLetters.checked, optMirrors.checked]).then((v) => v.join()), "true,false");
    await page.evaluate(() => localStorage.removeItem("cubetrace.options"));

    // panels: close one, reopen from the View menu, and the layout survives a reload
    await page.click('[data-key="close:net"]');
    assert.deepEqual(await openViews(page), ["cube"]);
    await page.reload();
    await page.waitForSelector(".dk-stack");
    assert.deepEqual(await openViews(page), ["cube"], "the layout is remembered");
    await page.click("#btnView");
    await page.click("#btnReset");
    assert.deepEqual(await openViews(page), ["cube", "net"]);
    await page.context().close();
  }

  // ── the screenshots, in each sheet ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 });
    await typeMoves(page, "R U R' U' R' F R2 U' R' U' R U R' F'");
    const themes = design ? [["night", "dark"], ["paper", "light"], ["console", "console"]] : [["night", "dark"], ["paper", "light"]];
    for (const [label, theme] of themes) {
      if (design) await page.evaluate((t) => window.SiteDesign.set({ theme: t }), theme);
      else await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await page.waitForTimeout(150);
      await frame(page);
      await shot(page, `1440-${label}`);
      assert.ok((await painted(page, CUBE)) > 5000, `${label}: cube drawn`);
    }
    await clean("sheets at 1440");
    await page.context().close();
  }

  // ── phone: one column, nothing sideways ──
  {
    const { page, clean } = await open({ width: 390, height: 844 }, null, { hasTouch: true });
    await typeMoves(page, "R U R' U'");
    assert.deepEqual(await openViews(page), ["cube", "net"]);
    const [cube, net, side] = await Promise.all([CUBE, NET, ".side"].map((s) => page.locator(s).boundingBox()));
    assert.ok(cube.height > 150 && net.height > 150 && cube.y < net.y && net.y < side.y, `a column: cube ${cube.y}, net ${net.y}, moves ${side.y}`);
    assert.ok(cube.width <= 390 && net.width <= 390 && side.width <= 390);
    assert.ok((await painted(page, CUBE)) > 2000, "the cube is drawn on the phone");
    const themes = design ? [["night", "dark"], ["paper", "light"], ["console", "console"]] : [["night", "dark"], ["paper", "light"]];
    for (const [label, theme] of themes) {
      if (design) await page.evaluate((t) => window.SiteDesign.set({ theme: t }), theme);
      else await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await frame(page);
      await page.screenshot({ path: path.join(SHOTS, `390-${label}.png`), fullPage: true });
    }
    await clean("phone");
    await page.context().close();
  }

  // ── no storage (private mode, or blocked): everything still works, nothing is kept ──
  {
    const { page, clean } = await open({ width: 1280, height: 720 }, () => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
    });
    assert.deepEqual(await openViews(page), ["cube", "net"]);
    await typeMoves(page, "R");
    await assertSticker(page, "U", 0, 2, "F", "without storage");
    await page.click("#btnView");
    await page.check("#optLetters");
    await clean("without storage");
    await page.context().close();
  }

  // ── saved data that makes no sense is ignored ──
  {
    const { page, clean } = await open({ width: 1280, height: 720 }, () => {
      try {
        localStorage.setItem("cubetrace.layout", '{"v":1,"tree":{"type":"split","children":[{"type":"stack","tabs":["nope"]}]}}');
        localStorage.setItem("cubetrace.options", '{"v":1,"letters":"yes","mirrors":3}');
      } catch (e) { /* none */ }
    });
    assert.deepEqual(await openViews(page), ["cube", "net"]);
    assert.equal(await page.evaluate(() => [optLetters.checked, optMirrors.checked, optSpring.checked].join()), "false,true,true");
    await clean("with broken saved data");
    await page.context().close();
  }

  console.log(`browser check passed (${design ? "with the shared design" : "offline fallback design"})`);
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
