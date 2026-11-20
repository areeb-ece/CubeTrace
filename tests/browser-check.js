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
import { solved, stickers, kindOf, applyMoves, occupant } from "../js/lib/cube.js";
import { parseMoves } from "../js/lib/notation.js";
import { facesAt } from "../js/lib/pieces.js";
import { METHODS } from "../js/lib/content/index.js";
import { stickerAt, pieceAt } from "../js/views/cube.js";
import { DEFAULT_CAMERA } from "../js/lib/scene.js";
import { resolve } from "../js/lib/lesson.js";
import { trace } from "../js/lib/trace.js";
import { chunksFor } from "../js/lib/chunks.js";
import { roles, HOLDINGS } from "../js/lib/roles.js";
import { units, pickTarget } from "../js/lib/predict.js";
import { twistLedger } from "../js/lib/ledger.js";
import { cellsAtPos } from "../js/lib/cells.js";
import { posIndex } from "../js/lib/rot.js";
import { gifPlan } from "../js/lib/picture.js";

// Playwright from this folder's node_modules, or a machine-wide install.
const { chromium } = await import("playwright").catch(() => createRequire(import.meta.url)("playwright"));

const SHOTS = path.join(ROOT, "test-results", "screenshots");
const { server, origin, design } = await serve();
const base = origin + BASE_PATH;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
fs.mkdirSync(SHOTS, { recursive: true });

const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// Learn is the default mode; the older checks drive the moves box, so they start in Explore
// (more.learn keeps Learn).
async function open(viewport, init, { learn, ...more } = {}) {
  const context = await browser.newContext({ viewport, ...more });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [], outside = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) outside.push(r.url()); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  });
  await page.goto(base);
  await page.waitForSelector(".dk-stack");
  if (!learn) await page.click('#modeSeg [data-mode="explore"]');
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
const settle = async (page) => { await frame(page); await page.waitForFunction(() => !document.getElementById("strip").hasAttribute("data-busy"), null, { timeout: 8000 }); await frame(page); };
const VIEW = '.view[data-view="cube"]', SIDE = "#side";
// wait until the lesson's own chips are up, after a turn-over (whose chips start with `first`)
const untilChips2 = (page, first) => page.waitForFunction((t) => { const c = document.querySelector("#timeline .tl-chip"); return c && c.textContent !== t; }, first, { timeout: 8000 });
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
    assert.deepEqual(await openViews(page), ["cube", "net", "ll"]);
    assert.equal(await page.$eval("#moves", (t) => t.value), "");
    assert.ok(await page.isHidden("#movesError"));
    assert.match(await page.getAttribute(CUBE, "aria-label"), /^Cube: no moves yet\. Seen from the up, front and right faces\.$/);
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

    // orbiting: dragging off the cube turns the view, letting go springs it back
    const cubeBefore = await picture(page, CUBE);
    const box = await page.locator(CUBE).boundingBox();
    // (from a corner of the panel: in Explore a press on the cube itself turns a layer)
    await page.mouse.move(box.x + 12, box.y + 12);
    await page.mouse.down();
    await page.mouse.move(box.x + 12 + 140, box.y + 12 + 60, { steps: 6 });
    await frame(page);
    assert.notEqual(await picture(page, CUBE), cubeBefore, "dragging turns the cube");
    await page.mouse.up();
    await page.mouse.move(2, 2); // off the cube: a piece under the pointer would be outlined
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
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("cubetrace.options"))), { v: 1, letters: true, mirrors: false, spring: true, speed: 1, roleSet: "all", full: false, netChange: false });
    await page.keyboard.press("Escape");
    await shot(page, `laptop-letters-${design ? "shared" : "offline"}`);
    await clean("laptop");
    await page.reload();
    await page.waitForSelector(".dk-stack");
    assert.equal(await page.evaluate(() => [optLetters.checked, optMirrors.checked]).then((v) => v.join()), "true,false");
    await page.evaluate(() => localStorage.removeItem("cubetrace.options"));

    // panels: close one, reopen from the View menu, and the layout survives a reload
    await page.click('[data-key="close:net"]');
    assert.deepEqual(await openViews(page), ["cube", "ll"]);
    await page.reload();
    await page.waitForSelector(".dk-stack");
    assert.deepEqual(await openViews(page), ["cube", "ll"], "the layout is remembered");
    await page.click("#btnView");
    await page.click("#btnReset");
    assert.deepEqual(await openViews(page), ["cube", "net", "ll"]);
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

  // ── phone: the stage on top, the panel a drawer, nothing sideways ──
  {
    const { page, clean } = await open({ width: 390, height: 844 }, null, { hasTouch: true });
    assert.ok(await page.isVisible("#btnMenu"), "the menu button");
    assert.ok(await page.isHidden(".side"), "the panel is a drawer, closed at first");
    await page.click("#btnMenu");
    assert.ok(await page.isVisible(".side"), "the Menu button opens it");
    assert.equal(await page.getAttribute("#btnMenu", "aria-expanded"), "true");
    assert.deepEqual(await page.evaluate(() => ["stage", "strip"].map((id) => document.getElementById(id).inert)), [true, true], "the page behind is inert");
    await typeMoves(page, "R U R' U'");
    await page.keyboard.press("Escape");
    await page.waitForSelector(".side", { state: "hidden" });
    assert.deepEqual(await page.evaluate(() => ["stage", "strip"].map((id) => document.getElementById(id).inert)), [false, false], "Escape gives the page back");
    assert.deepEqual(await openViews(page), ["cube", "net", "ll"]);
    const [cube, net, tl] = await Promise.all([CUBE, NET, "#tlDock .tl"].map((s) => page.locator(s).boundingBox()));
    assert.ok(cube.height > 150 && net.height > 150 && cube.y < net.y && net.y < tl.y, `a column: cube ${cube.y}, net ${net.y}, timeline ${tl.y}`);
    assert.ok(cube.width <= 390 && net.width <= 390 && tl.width <= 390);
    assert.ok((await painted(page, CUBE)) > 2000, "the cube is drawn on the phone");
    const strip = await page.locator("#strip").boundingBox();
    assert.ok(strip.y + strip.height <= 845 && strip.width <= 390, `the transport is pinned at the bottom: ${JSON.stringify(strip)}`);
    const themes = design ? [["night", "dark"], ["paper", "light"], ["console", "console"]] : [["night", "dark"], ["paper", "light"]];
    for (const [label, theme] of themes) {
      if (design) await page.evaluate((t) => window.SiteDesign.set({ theme: t }), theme);
      else await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await frame(page);
      await page.screenshot({ path: path.join(SHOTS, `390-${label}.png`), fullPage: true });
    }
    // the lessons: choosing a case closes the drawer and the cube shows it
    await page.click('#modeSeg [data-mode="learn"]');
    await page.click("#btnMenu");
    await page.click('#learnPanel [data-step="white-corners"]');
    await page.waitForTimeout(100);
    assert.ok(await page.isVisible("#learnPanel .case"), "the case grid is in the drawer");
    const [grid, side] = await Promise.all(["#learnPanel .cases", ".side"].map((s) => page.locator(s).boundingBox()));
    assert.ok(grid.x >= side.x && grid.x + grid.width <= side.x + side.width + 1, "the grid fits the drawer");
    await page.click('#learnPanel .case[aria-label="White facing down"]');
    await page.waitForSelector(".side", { state: "hidden" });
    await frame(page);
    assert.equal(await page.$$eval("#timeline .tl-chip", (c) => c.length), 12, "the case's algorithm is under the cube");
    await clean("phone");
    await page.context().close();
  }

  // ── playback: the strip, the keys, the guides ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 });
    assert.ok(await page.isVisible("#strip"), "the transport strip");
    assert.ok(await page.isDisabled("#btnPlay"), "nothing to play yet");
    await typeMoves(page, "R U");
    const end = await picture(page, NET);
    assert.equal(await page.getAttribute(CUBE, "data-guide"), "", "paused at the end: no move is next");

    // stepping back animates the inverse, twice: solved
    await page.click("#btnBack");
    await settle(page);
    assert.equal(await page.getAttribute(CUBE, "data-guide"), "U", "paused at 1: the next move's guides");
    assert.ok((await page.getAttribute(CUBE, "data-faint")) !== null, "…shown faintly");
    await page.click("#btnBack");
    await settle(page);
    await assertSolvedNet(page, "stepped back twice");
    assert.ok(await page.isDisabled("#btnBack"), "can't step back from the start");

    // play: one chunk, so it runs to the end
    await page.click("#btnPlay");
    await settle(page);
    assert.equal(await picture(page, NET), end, "playing R U ends on the R U state");
    assert.equal(await page.getAttribute("#btnPlay", "aria-label"), "Play");

    // the scrub: 0 is solved, 2 is the end, 0.5 is a turn partway with its guides
    const scrub = async (v) => { await page.evaluate((v) => { const r = document.getElementById("timeRange"); r.value = v; r.dispatchEvent(new Event("input", { bubbles: true })); }, v); await frame(page); };
    await scrub(0);
    await assertSolvedNet(page, "scrubbed to 0");
    const flat = await picture(page, CUBE);
    await scrub(0.5);
    assert.equal(await page.getAttribute(CUBE, "data-guide"), "R");
    assert.equal(await page.getAttribute(CUBE, "data-faint"), null, "a turn in progress is not faint");
    assert.notEqual(await picture(page, CUBE), flat, "a turn partway shows");
    await shot(page, "guides-cube");
    await scrub(2);
    assert.equal(await picture(page, NET), end);

    // speed is remembered
    await page.click('#speedSeg [data-speed="2"]');
    await frame(page);
    assert.equal(await page.getAttribute('#speedSeg [data-speed="2"]', "aria-checked"), "true");
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("cubetrace.options")))).speed, 2);
    await page.click('#speedSeg [data-speed="1"]');

    // keys act only on the cube panel
    await typeMoves(page, "");
    await page.focus("#moves");
    await page.keyboard.type("U");
    await page.waitForTimeout(350);
    assert.equal(await page.$eval("#moves", (t) => t.value), "U", "typing in the box doesn't turn the cube");
    await typeMoves(page, "");
    await page.focus(VIEW);
    await page.keyboard.press("KeyR");
    assert.match(await page.$eval("#moves", (t) => t.value), /R$/, "R appends R");
    await settle(page);
    for (let row = 0; row < 3; row++) await assertSticker(page, "U", row, 2, "F", "after the R key");
    await page.keyboard.press("Shift+KeyR");
    assert.match(await page.$eval("#moves", (t) => t.value), /R R'$/);
    await settle(page);
    await assertSolvedNet(page, "R then R'");
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    for (let row = 0; row < 3; row++) await assertSticker(page, "U", row, 2, "F", "stepped back to after R");
    await page.keyboard.press("Space");
    await settle(page);
    await assertSolvedNet(page, "played on to the end");
    assert.equal(await page.$eval(".live", (e) => e.getAttribute("aria-live")), "polite");

    // the dialogs
    assert.ok(await page.isVisible("#primerCallout"), "first visit: the primer is offered");
    await page.click("#btnNotation");
    assert.ok(await page.$eval("#primer", (d) => d.open));
    assert.ok((await page.$$("#primer .pcard")).length >= 10, "a card for each part of the notation");
    const mini = "#primer .pcard:nth-of-type(5) canvas";
    await page.waitForTimeout(150);
    assert.ok((await painted(page, mini)) > 500, "a card's cube is drawn");
    await page.click("#primer .pcard:nth-of-type(5) .prow button >> nth=0");
    await page.waitForTimeout(900);
    assert.ok((await painted(page, mini)) > 500, "…and plays");
    await shot(page, "primer");
    await page.keyboard.press("Escape");
    assert.equal(await page.$eval("#primer", (d) => d.open), false, "Escape closes it");
    assert.ok(await page.isHidden("#primerCallout"), "opening the primer ends the offer");
    assert.equal(await page.evaluate(() => localStorage.getItem("cubetrace.primerSeen")), "true");
    await page.click("#btnKeys");
    assert.ok(await page.$eval("#keysDialog", (d) => d.open));
    assert.ok((await page.$$("#keysDialog .sd-kbd")).length >= 10);
    await page.keyboard.press("Escape");
    await page.reload();
    await page.waitForSelector(".dk-stack");
    assert.ok(await page.isHidden("#primerCallout"), "and it stays ended");
    await clean("playback");
    await page.context().close();
  }

  // ── the net's arrows ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 });
    await typeMoves(page, "R U");
    await page.evaluate(() => { const r = document.getElementById("timeRange"); r.value = 0; r.dispatchEvent(new Event("input", { bubbles: true })); });
    await frame(page);
    await shot(page, "guides-net");
    await clean("net arrows");
    await page.context().close();
  }

  // ── motion off: jumps, but the guides stay up for a dwell ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 }, null, { reducedMotion: "reduce" });
    await typeMoves(page, "R U");
    await page.click("#btnBack");
    await frame(page);
    assert.equal(await page.getAttribute(CUBE, "data-guide"), "U'", "the move just undone is guided");
    assert.equal(await page.getAttribute(CUBE, "data-faint"), null);
    // (the D face: the guided U's arrows are all up on the other faces)
    for (let row = 0; row < 3; row++) await assertSticker(page, "D", row, 2, "B", "jumped to after R");
    await page.waitForTimeout(1000);
    assert.equal(await page.getAttribute(CUBE, "data-guide"), "U", "then the next move, faint");
    assert.notEqual(await page.getAttribute(CUBE, "data-faint"), null);
    await page.click("#btnFwd");
    await frame(page);
    assert.equal(await page.getAttribute(CUBE, "data-guide"), "U");
    assert.equal(await page.getAttribute(CUBE, "data-faint"), null);
    await shot(page, "guides-reduced");
    await page.waitForTimeout(1000);
    assert.equal(await page.getAttribute(CUBE, "data-guide"), "", "at the end nothing is next");
    // playing advances a move per dwell
    await page.click("#btnBack");
    await page.click("#btnBack");
    await page.click("#btnPlay");
    await page.waitForTimeout(3500);
    assert.equal(await page.getAttribute("#btnPlay", "aria-label"), "Play");
    await clean("motion off");
    await page.context().close();
  }

  // ── roles: what matters is in colour, the rest is grey ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 });
    const LL = '.view[data-view="ll"] canvas';
    assert.ok((await painted(page, LL)) > 1000, "the last-layer panel isn't blank");
    assert.equal(await page.$eval("#roleSet", (s) => s.value), "all", "everything is shown by default");
    assert.equal(await page.$$eval("#roleSet option", (o) => o.length), 12);
    const grey = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ink-4").trim());
    const sameColour = async (face, row, col, want, what) => {
      const [r, g, b, a] = await netColour(page, face, row, col), w = hex(want);
      assert.ok(a === 255 && [r, g, b].every((v, i) => Math.abs(v - w[i]) <= 6), `${what}: ${face}${row}${col} is rgb(${r} ${g} ${b}), want ${want}`);
    };

    // the white cross: its four edges and the centres in colour, every other cell flat grey
    await page.selectOption("#roleSet", "white-cross");
    await frame(page);
    for (const st of stickers(solved())) {
      const mine = kindOf(st.id) === "centre" || (kindOf(st.id) === "edge" && facesAt(st.id).includes("U"));
      await sameColour(st.face, st.row, st.col, mine ? STICKERS[st.home] : grey, "white cross");
    }
    await shot(page, "roles-white-cross");

    // Full colour brings everything back, and it is remembered
    await page.click("#btnFull");
    await frame(page);
    assert.equal(await page.getAttribute("#btnFull", "aria-pressed"), "true");
    await sameColour("U", 0, 0, STICKERS.U, "full colour");
    await sameColour("F", 2, 2, STICKERS.F, "full colour");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cubetrace.options")));
    assert.equal(saved.full, true);
    assert.equal(saved.roleSet, "white-cross");
    await page.click("#btnFull");
    await frame(page);
    assert.equal(await page.getAttribute("#btnFull", "aria-pressed"), "false");
    await sameColour("U", 0, 0, grey, "full colour off again");
    await clean("white cross");

    // F2L: the moves start yellow up; taking the pair out leaves holes, putting it back none
    await page.selectOption("#roleSet", "f2l");
    await frame(page);
    await sameColour("U", 1, 1, STICKERS.D, "yellow up");
    await sameColour("F", 1, 1, STICKERS.F, "green in front");
    await typeMoves(page, "R U");
    assert.ok(Number(await page.getAttribute(CUBE, "data-holes")) > 0, "holes on the cube");
    assert.ok(Number(await page.getAttribute(NET, "data-holes")) > 0, "holes on the net");
    await shot(page, "roles-f2l-ru");
    await typeMoves(page, "R U U' R'");
    assert.equal(await page.getAttribute(CUBE, "data-holes"), "0");
    assert.equal(await page.getAttribute(NET, "data-holes"), "0");

    // the live region says what happened to the pieces that matter (white cross: R carries the white-red edge)
    await page.selectOption("#roleSet", "white-cross");
    await typeMoves(page, "R");
    await page.click("#btnBack");
    await settle(page);
    await page.click("#btnFwd");
    await settle(page);
    await page.waitForTimeout(400);
    assert.equal(await page.$eval(".live", (e) => e.textContent), "R: the right face, clockwise. The white-red edge moves from up-right to back-right.");
    await page.selectOption("#roleSet", "all");
    await page.click("#btnBack");
    await settle(page);
    await page.click("#btnFwd");
    await settle(page);
    await page.waitForTimeout(400);
    assert.equal(await page.$eval(".live", (e) => e.textContent), "R: the right face, clockwise.", "all pieces: only the move");

    // the last-layer diagram: net change on and off
    await page.selectOption("#roleSet", "oll");
    await typeMoves(page, "R U R' U R U2 R'");
    const follows = await picture(page, LL);
    await page.click('.view[data-view="ll"] .ll-bar button');
    await frame(page);
    assert.equal(await page.getAttribute('.view[data-view="ll"] .ll-bar button', "aria-pressed"), "true");
    assert.equal(await page.getAttribute(LL, "data-change"), "on");
    assert.ok((await painted(page, LL)) > 1000);
    assert.notEqual(await picture(page, LL), follows, "net change draws the start and the arrows");
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("cubetrace.options")))).netChange, true);
    await shot(page, "roles-ll-net-change");
    await page.click('.view[data-view="ll"] .ll-bar button');
    await frame(page);
    assert.equal(await page.getAttribute(LL, "data-change"), "off");
    assert.equal(await picture(page, LL), follows, "off, it follows playback again");

    // tracking: a click on the net follows that piece, another click lets go; so do the keys
    await typeMoves(page, "R U");
    const before = await picture(page, NET);
    const size = await page.$eval(NET, (c) => [c.clientWidth, c.clientHeight]);
    const c = netCell(netLayout(...size), "F", 0, 2), box = await page.locator(NET).boundingBox();
    await page.mouse.click(box.x + c.x + c.size / 2, box.y + c.y + c.size / 2);
    await frame(page);
    assert.notEqual(await page.getAttribute(NET, "data-track"), "", "clicking a piece follows it");
    assert.equal(await page.getAttribute(CUBE, "data-track"), await page.getAttribute(NET, "data-track"), "in every view");
    assert.notEqual(await picture(page, NET), before, "its path and outline are drawn");
    await shot(page, "roles-tracking");
    await page.mouse.click(box.x + c.x + c.size / 2, box.y + c.y + c.size / 2);
    await frame(page);
    assert.equal(await page.getAttribute(NET, "data-track"), "", "clicking it again lets go");
    await page.mouse.move(2, 2);
    await page.focus(NET);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await frame(page);
    assert.notEqual(await page.getAttribute(NET, "data-track"), "", "the keys follow a piece too");
    await clean("roles");

    // the choice is remembered
    await page.reload();
    await page.waitForSelector(".dk-stack");
    assert.equal(await page.$eval("#roleSet", (s) => s.value), "oll");
    await page.context().close();
  }

  // ── the timeline and the commutator view ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 });
    assert.ok(await page.isHidden("#timeline"), "no timeline for no moves");
    await typeMoves(page, "F R U R' U' F'");
    assert.equal(await page.$$eval("#timeline .tl-chip", (c) => c.length), 6);
    assert.equal(await page.$$eval("#timeline path.tl-arc", (c) => c.length), 3, "three bracket arcs");
    for (const role of ["setup", "trigger", "undo"]) assert.equal(await page.$$eval(`#timeline .tl-band[data-role="${role}"]`, (c) => c.length), 1, role + " band");
    assert.ok(await page.isHidden("#timeline .tl-comm"), "a conjugate has no commutator note");
    assert.match(await page.textContent("#timeline .tl-caption"), /^Undo the setup/, "at the end: the last chunk's caption");
    assert.equal(await page.$eval("#timeline [aria-current]", (c) => c.textContent), "F'");
    const chip = (i) => page.locator(`#timeline .tl-chip[data-i="${i}"]`);
    await chip(3).click();
    await settle(page);
    assert.equal(await page.$eval("#timeline [aria-current]", (c) => c.dataset.i), "3");
    assert.match(await page.textContent("#timeline .tl-caption"), /^Sexy move: /);
    assert.equal(await page.$$eval("#timeline .tl-chip[tabindex='0']", (c) => c.length), 1, "one tab stop");
    // the net is the state after three moves
    // (not the R face: the faint guide of the next move, R', lies over it)
    for (const st of stickers(applyMoves(solved(), parseMoves("F R U"))).filter((x) => x.face !== "R")) await assertSticker(page, st.face, st.row, st.col, st.home, "after the 4th chip");
    await typeMoves(page, "F R U R' U' F'");
    await chip(2).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.i), "3", "arrows move between chips");
    await page.keyboard.press("Enter");
    await settle(page);
    assert.equal(await page.$eval("#timeline [aria-current]", (c) => c.dataset.i), "3");
    await shot(page, "timeline-conjugate");

    await typeMoves(page, "R U R' U'");
    assert.ok(await page.isVisible("#timeline .tl-comm"));
    assert.equal(await page.textContent("#timeline .tl-note"), "[R U, R' U']".replace("R U, R' U'", "R, U"));
    const off = await picture(page, NET), offCube = await picture(page, CUBE);
    await page.click("#timeline .tl-comm button");
    await frame(page);
    assert.equal(await page.getAttribute("#timeline .tl-comm button", "aria-pressed"), "true");
    assert.notEqual(await picture(page, NET), off, "the meeting pieces are outlined on the net");
    assert.notEqual(await picture(page, CUBE), offCube, "and on the cube");
    await page.click("#timeline .tl-comm button");
    await frame(page);
    assert.equal(await picture(page, NET), off, "off again");
    for (const t of ["R' D' R D", "R U R' D R U' R' D'"]) {
      await typeMoves(page, t);
      assert.ok(await page.isVisible("#timeline .tl-comm"), t);
    }
    await page.click("#timeline .tl-comm button");
    await frame(page);
    await shot(page, "timeline-commutator");
    await typeMoves(page, "R U R' U R U2 R'");
    assert.ok(await page.isHidden("#timeline .tl-comm"), "Sune is not a commutator");
    assert.equal(await page.$$eval("#timeline .tl-band[data-role='trigger']", (c) => c.length), 1);
    await clean("timeline");
    await page.context().close();
  }

  // ── Learn: the beginner method and CFOP, step by step ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 }, null, { learn: true });
    const SIDE = "#side", chips = () => page.$$eval("#timeline .tl-chip", (c) => c.map((x) => x.textContent));
    const scrubTo = async (v) => { await page.evaluate((v) => { const r = document.getElementById("timeRange"); r.value = v; r.dispatchEvent(new Event("input", { bubbles: true })); }, v); await frame(page); };
    const toEnd = async () => scrubTo(await page.$eval("#timeRange", (r) => r.max));
    // every sticker of the faces (rows: which rows) is its face's centre colour on the net, in full colour
    const faceSolid = async (faces, rows, what) => {
      for (const f of faces) {
        const mid = await netColour(page, f, 1, 1);
        for (const r of rows) for (let c = 0; c < 3; c++) {
          const got = await netColour(page, f, r, c);
          assert.ok(got.every((v, i) => Math.abs(v - mid[i]) <= 6), `${what}: ${f}${r}${c} is rgb(${got}), its centre is rgb(${mid})`);
        }
      }
    };
    const fullColour = async () => { if ((await page.getAttribute("#btnFull", "aria-pressed")) !== "true") { await page.click("#btnFull"); await frame(page); } };
    const untilChips = (first) => page.waitForFunction((t) => document.querySelector("#timeline .tl-chip")?.textContent !== t, first, { timeout: 8000 });

    // the defaults: Learn, Beginner, its seven steps, the first case, paused at the start
    assert.equal(await page.getAttribute('#modeSeg [data-mode="learn"]', "aria-checked"), "true");
    assert.equal(await page.$eval("#method", (s) => s.value), "beginner");
    assert.ok(await page.isVisible("#methodBox") && await page.isHidden("#moves"), "Learn shows the method, not the moves box");
    assert.equal((await page.$$("#learnPanel .steps button")).length, 7);
    assert.equal(await page.getAttribute("#learnPanel .steps button >> nth=0", "aria-current"), "step");
    assert.equal(await page.$$eval("#learnPanel .steps [aria-current]", (b) => b.length), 1);
    assert.match(await page.textContent("#learnPanel .intro"), /^Put the four white edges/);
    assert.ok(await page.isHidden("#roleSet"), "no Show chooser in Learn");
    assert.equal(await page.getAttribute("#side", "data-goal"), null);
    await assertSticker(page, "D", 1, 1, "D", "step 1 holds the cube white up (yellow at the bottom)");

    // second layer: the cube turns over (z2), then "Edge goes right" plays to the first two layers
    await page.click('#learnPanel [data-step="second-layer"]');
    await untilChips("z2");
    await settle(page);
    assert.equal(await page.getAttribute('#learnPanel [data-step="second-layer"]', "aria-current"), "step");
    await assertSticker(page, "U", 1, 1, "D", "after the turn-over, yellow is up");
    assert.ok(await page.isVisible("#learnPanel .lead button"), "a button turns it over again");
    await page.click('#learnPanel .case[aria-label="Edge goes right"]');
    await frame(page);
    assert.equal(await page.textContent("#learnPanel .case-name"), "Edge goes right");
    assert.equal((await chips()).join(" "), "U R U' R' U' F' U F");
    assert.equal(await page.getAttribute(SIDE, "data-goal"), null, "no goal before the end");
    await fullColour();
    await toEnd();
    await faceSolid(["D"], [0, 1, 2], "second layer");
    await faceSolid(["F", "R", "B", "L"], [1, 2], "second layer");
    assert.equal(await page.getAttribute(SIDE, "data-goal"), "met");
    assert.ok(await page.isHidden("#learnPanel .detail .sd-callout"), "no warning");
    await scrubTo(0);
    assert.equal(await page.getAttribute(SIDE, "data-goal"), null, "leaving the end clears it");
    await shot(page, "learn-second-layer");

    // the mirror: this case has a partner (switch to it), a case without one has none
    assert.equal(await page.getAttribute("#btnMirror", "aria-disabled"), "false");
    assert.equal(await page.getAttribute("#btnMirror", "aria-pressed"), "false");
    await page.click("#btnMirror");
    await frame(page);
    assert.equal(await page.textContent("#learnPanel .case-name"), "Edge goes left");
    assert.equal(await page.getAttribute("#btnMirror", "aria-pressed"), "true");
    await page.click('#learnPanel [data-step="white-corners"]');
    await frame(page);
    assert.equal(await page.getAttribute("#btnMirror", "aria-disabled"), "true", "no partner for a white corner");
    assert.match(await page.getAttribute("#btnMirror", "title"), /no left or right partner/);
    const before = await chips();
    await page.click("#btnMirror", { force: true });
    assert.deepEqual(await chips(), before, "a disabled toggle does nothing");

    // turning over, both ways round: step 2 to step 3 ends with yellow up; the button does it again
    await untilChips("z2").catch(() => {});
    await page.click('#learnPanel [data-step="second-layer"]');
    await untilChips("z2");
    await settle(page);
    await assertSticker(page, "U", 1, 1, "D", "yellow up in step 3");
    await page.click("#learnPanel .lead button");
    await untilChips("z2");
    await settle(page);
    await assertSticker(page, "U", 1, 1, "D", "yellow up again");
    await page.click('#learnPanel [data-step="yellow-cross"]');
    await frame(page);
    assert.ok(await page.isHidden("#learnPanel .lead button"), "only the second-layer step has the turn-over button");
    await assertSticker(page, "U", 1, 1, "D", "no second turn between yellow steps");

    // CFOP: PLL has 21 thumbnails; T perm solves the whole cube
    await page.selectOption("#method", "cfop");
    await frame(page);
    assert.equal(await page.$$eval("#learnPanel .steps button", (b) => b.length), 6);
    await page.click('#learnPanel [data-step="pll"]');
    await frame(page);
    assert.equal((await page.$$("#learnPanel .case")).length, 21);
    assert.equal(await page.$$eval("#learnPanel .group h3", (h) => h.length), 3, "grouped");
    await page.waitForTimeout(150);
    assert.ok((await painted(page, "#learnPanel .case canvas")) > 200, "a thumbnail is drawn");
    await page.click('#learnPanel .case[aria-label="T perm"]');
    await frame(page);
    assert.equal((await chips()).join(" "), "R U R' U' R' F R2 U' R' U' R U R' F'");
    await toEnd();
    await faceSolid(["U", "D", "F", "R", "B", "L"], [0, 1, 2], "T perm");
    assert.equal(await page.getAttribute(SIDE, "data-goal"), "met");
    await shot(page, "learn-pll");

    // the OLL grid: 57 cases, drawn as they scroll in
    await page.click('#learnPanel [data-step="oll"]');
    await frame(page);
    assert.equal((await page.$$("#learnPanel .case")).length, 57);
    const drawnCount = () => page.$$eval("#learnPanel .case canvas", (cs) => cs.filter((cv) => { const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; return d.some((v, i) => i % 4 === 3 && v); }).length);
    await page.waitForTimeout(200);
    const first = await drawnCount();
    assert.ok(first > 0 && first < 57, `thumbnails are drawn lazily (${first} of 57 so far)`);
    await shot(page, "learn-oll");

    // F2L: the four ideas, 41 cases, and the mirror shows the left slot's algorithm
    await page.click('#learnPanel [data-step="f2l"]');
    await frame(page);
    assert.equal((await page.$$("#learnPanel .concept")).length, 4);
    assert.equal((await page.$$("#learnPanel .case")).length, 41);
    const names = await page.$$eval("#learnPanel .case", (b) => b.map((x) => x.getAttribute("aria-label")));
    assert.equal(new Set(names).size, 41, "every thumbnail has a name of its own");
    const f2l = METHODS[1].steps.find((st) => st.id === "f2l"), c0 = f2l.cases[0];
    assert.equal((await chips()).join(" "), c0.alg);
    assert.equal(await page.getAttribute("#btnMirror", "aria-disabled"), "false");
    await page.click("#btnMirror");
    await frame(page);
    assert.equal(await page.getAttribute("#btnMirror", "aria-pressed"), "true");
    assert.equal((await chips()).join(" "), c0.mirrorAlg, "the left slot's version");
    assert.notEqual(c0.mirrorAlg, c0.alg);
    await toEnd();
    assert.equal(await page.getAttribute(SIDE, "data-goal"), "met", "the mirror reaches the goal too");
    await page.click("#btnMirror");
    await frame(page);
    assert.equal((await chips()).join(" "), c0.alg, "and back");
    // a concept's algorithm loads as a case
    await page.click("#learnPanel .concept .chips button >> nth=1");
    await frame(page);
    assert.equal((await chips()).join(" "), "F' U' F");
    await shot(page, "learn-f2l");

    // "also used in" jumps
    await page.click('#learnPanel [data-step="oll2"]');
    await frame(page);
    await page.click('#learnPanel .case[aria-label="Line"]');
    await frame(page);
    await page.click("#learnPanel .also button");
    await frame(page);
    assert.equal(await page.$eval("#method", (m) => m.value), "beginner");
    assert.equal(await page.getAttribute('#learnPanel [data-step="yellow-cross"]', "aria-current"), "step");
    await clean("learn");

    // the choice survives a reload; Explore is remembered too
    await page.selectOption("#method", "cfop");
    await page.click('#learnPanel [data-step="oll"]');
    await page.click('#learnPanel .case[data-case="oll-21"]');
    await frame(page);
    await page.reload();
    await page.waitForSelector(".dk-stack");
    await frame(page);
    assert.equal(await page.$eval("#method", (m) => m.value), "cfop");
    assert.equal(await page.getAttribute('#learnPanel [data-step="oll"]', "aria-current"), "step");
    assert.equal(await page.getAttribute('#learnPanel .case[data-case="oll-21"]', "aria-current"), "true");
    assert.equal(await page.getAttribute('#modeSeg [data-mode="learn"]', "aria-checked"), "true");
    // Explore and back: the moves box keeps what was typed, and the lesson comes back
    await page.click('#modeSeg [data-mode="explore"]');
    await typeMoves(page, "R U");
    await page.click('#modeSeg [data-mode="learn"]');
    await frame(page);
    assert.equal((await chips()).join(" "), METHODS[1].steps.find((st) => st.id === "oll").cases.find((c) => c.id === "oll-21").alg);
    await page.click('#modeSeg [data-mode="explore"]');
    await frame(page);
    assert.equal(await page.$eval("#moves", (t) => t.value), "R U");
    assert.equal((await chips()).join(" "), "R U");
    await page.reload();
    await page.waitForSelector(".dk-stack");
    assert.equal(await page.getAttribute('#modeSeg [data-mode="explore"]', "aria-checked"), "true", "Explore is remembered");
    await page.context().close();
  }

  // ── Learn with motion off: the turn-over jumps ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 }, null, { learn: true, reducedMotion: "reduce" });
    await page.click('#learnPanel [data-step="second-layer"]');
    await frame(page);
    assert.equal((await page.$$eval("#timeline .tl-chip", (c) => c.map((x) => x.textContent))).join(" "), "U R U' R' U' F' U F", "no turn to wait for");
    await assertSticker(page, "U", 1, 1, "D", "yellow is up at once");
    await clean("learn, motion off");
    await page.context().close();
  }

  // ── Explore: dragging across the cube turns a layer; Scramble and Reset ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 });
    const box = await page.locator(CUBE).boundingBox();
    const view = [box.width, box.height], o = { camera: DEFAULT_CAMERA, mirrors: false };
    // the middle of the sticker on face `face` of the piece at grid position `at`, found by scanning with the view's own hit test
    const stickerPoint = (state, at, face) => {
      const id = occupant(state)[posIndex(at)], pts = [];
      for (let x = 0; x < view[0]; x += 3) for (let y = 0; y < view[1]; y += 3) {
        const hit = stickerAt(state, o, ...view, x, y);
        if (hit && hit.id === id && hit.face === face) pts.push([x, y]);
      }
      assert.ok(pts.length > 20, `${face} sticker of ${at} is on screen`);
      return [box.x + pts.reduce((t, q) => t + q[0], 0) / pts.length, box.y + pts.reduce((t, q) => t + q[1], 0) / pts.length];
    };
    const drag = async ([x, y], [dx, dy]) => {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 6 });
      await page.mouse.up();
      await settle(page);
    };
    const front = stickerPoint(solved(), [1, 1, 1], "F"); // the front face's top-right sticker
    await drag(front, [0, -50]);
    assert.equal(await page.$eval("#moves", (t) => t.value), "R", "dragging it up turns the right face");
    for (let row = 0; row < 3; row++) await assertSticker(page, "U", row, 2, "F", "after the dragged R");
    // the cube turned, so its pieces are elsewhere: scan the state the page now shows
    const afterR = applyMoves(solved(), parseMoves("R"));
    await drag(stickerPoint(afterR, [-1, 1, 1], "F"), [50, 0]);
    assert.equal(await page.$eval("#moves", (t) => t.value), "R U'", "dragging a top-row sticker right turns the top layer back");
    // a drag that starts off the cube orbits it and writes nothing
    const orbitFrom = await picture(page, CUBE);
    await page.mouse.move(box.x + 6, box.y + box.height - 6);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + box.height - 40, { steps: 5 });
    await frame(page);
    assert.notEqual(await picture(page, CUBE), orbitFrom, "the view turns");
    await page.mouse.up();
    assert.equal(await page.$eval("#moves", (t) => t.value), "R U'", "…and no move is written");
    // a centre sticker turns a slice
    await typeMoves(page, "");
    await drag(stickerPoint(solved(), [0, 0, 1], "F"), [0, -50]);
    assert.equal(await page.$eval("#moves", (t) => t.value), "M'", "the front centre dragged up is a middle slice");

    // Scramble: 20 turns in the box, and the cube shows where they end
    await page.click("#btnScramble");
    await settle(page);
    const scrambled = await page.$eval("#moves", (t) => t.value.trim().split(/\s+/));
    assert.equal(scrambled.length, 20);
    assert.ok(scrambled.every((m) => /^[UDLRFB]['2]?$/.test(m)), scrambled.join(" "));
    const want = applyMoves(solved(), parseMoves(scrambled.join(" ")));
    await assertSticker(page, "F", 1, 1, "F", "centres stay home");
    for (const st of stickers(want)) if (st.row !== 1 || st.col !== 1) { await assertSticker(page, st.face, st.row, st.col, st.home, "the scramble's end state"); }
    // Reset: empty box, solved cube
    await page.click("#btnClearMoves");
    await settle(page);
    assert.equal(await page.$eval("#moves", (t) => t.value), "");
    await assertSolvedNet(page, "after Reset");

    // the twist ledger on demand: four corners and two totals, from the engine's numbers
    assert.ok(await page.isHidden("#ledger"));
    await page.click("#btnLedger");
    assert.equal(await page.getAttribute("#btnLedger", "aria-pressed"), "true");
    assert.ok(await page.isVisible("#ledger"));
    const cells = () => page.$$eval("#ledger tbody th, #ledger tbody td, #ledger tfoot th, #ledger tfoot td", (c) => c.map((x) => x.textContent));
    const show = (n) => (n > 0 ? "+1" : n < 0 ? "\u22121" : "0");
    const rows = (l) => [...l.corners.flatMap((c) => [c.name, show(c.twist)]), "Top corners: total", show(l.top), "Lower corners: total", show(l.lower)];
    assert.deepEqual(await cells(), rows(twistLedger(solved(), HOLDINGS.whiteUp)));
    await typeMoves(page, "R' D' R D");
    await settle(page);
    const twisted = twistLedger(applyMoves(solved(), parseMoves("R' D' R D")), HOLDINGS.whiteUp);
    assert.deepEqual(await cells(), rows(twisted));
    assert.ok(twisted.top !== 0 && twisted.lower === -twisted.top, "one trigger leaves a top corner twisted, and the lower ones paying for it");
    assert.ok(await page.$eval("#ledger", (e) => e.getBoundingClientRect().width <= 320 + 1), "it fits the panel");
    await page.click("#btnLedger");
    assert.ok(await page.isHidden("#ledger"), "the toggle hides it again");
    await shot(page, "explore-drag");
    await clean("explore drag");
    await page.context().close();
  }

  // ── Predict: a marked piece, a click on its slot, the answer ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 }, null, { learn: true });
    await page.click('#learnPanel [data-step="second-layer"]');
    await untilChips2(page, "z2");
    await settle(page);
    await page.click('#learnPanel .case[aria-label="Edge goes right"]');
    await frame(page);
    assert.ok(await page.isHidden("#pbar"), "the questions are Predict's alone");
    assert.ok(await page.isHidden("#ledger"), "and the ledger is for step 7");
    await page.click('#modeSeg [data-mode="predict"]');
    await frame(page);
    assert.equal(await page.getAttribute('#modeSeg [data-mode="predict"]', "aria-checked"), "true");
    assert.ok(await page.isVisible("#pbar"));
    assert.ok(await page.isHidden("#btnPlay"), "Predict decides when the cube turns");
    assert.equal(await page.textContent("#pStreak"), "Streak: 0");

    const r = resolve({ method: "beginner", step: "second-layer", case: "sl-right" }), tr = trace(r.start, r.moves), roleOf = roles(r.roles);
    const chunks = chunksFor(r.moves, r.parts);
    const NETBOX = async () => page.locator(NET).boundingBox();
    // the page's own view of the net and cube, for finding where to click
    const clickNet = async (pos) => {
      const size = await page.$eval(NET, (c) => [c.clientWidth, c.clientHeight]), b = await NETBOX();
      const cell = netCell(netLayout(...size), ...Object.values(cellsAtPos(pos)[0]).slice(0, 3));
      await page.mouse.click(b.x + cell.x + cell.size / 2, b.y + cell.y + cell.size / 2);
    };
    const clickCube = async (state, pos) => {
      const id = occupant(state)[pos], b = await page.locator(CUBE).boundingBox(), found = [];
      for (let x = 0; x < b.width; x += 3) for (let y = 0; y < b.height; y += 3) if (pieceAt(state, { camera: DEFAULT_CAMERA, mirrors: true }, b.width, b.height, x, y) === id) found.push([x, y]);
      assert.ok(found.length > 20, "the slot's piece shows on the cube");
      // the middle of the piece's visible area
      const mid = found[Math.floor(found.length / 2)];
      await page.mouse.click(b.x + mid[0], b.y + mid[1]);
    };
    const said = (re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector(".live").textContent), re.source, { timeout: 6000 });
    const next = async () => { await page.click("#pNext"); await frame(page); };
    const targetAttr = (sel) => page.getAttribute(sel, "data-target");

    // 1: by move, answered on the net, right
    const [f0, t0] = units(chunks, r.moves.length, "move")[0];
    const target0 = pickTarget(tr.states[f0], tr.states[t0], roleOf, 0);
    assert.equal(await targetAttr(NET), String(target0), "the marked piece is the one the engine picks");
    assert.equal(await targetAttr(CUBE), String(target0));
    assert.match(await page.textContent("#pQuestion"), /^Where will the .+ go\?/);
    assert.ok(await page.isDisabled("#pNext"), "Next waits for an answer");
    await shot(page, "predict-ask");
    await clickNet(tr.states[t0].pos[target0]);
    await said(/^Right: /);
    assert.equal(await page.textContent("#pStreak"), "Streak: 1");
    assert.equal(await page.getAttribute("#pQuestion", "data-verdict"), "right");
    assert.equal(await page.getAttribute("#pbar", "data-phase"), "shown");
    assert.ok(await page.isEnabled("#pNext"));
    await next();

    // 2: answered on the cube, where the learner clicks the place the piece is in now (before the move)
    const [f1, t1] = units(chunks, r.moves.length, "move")[1];
    const target1 = pickTarget(tr.states[f1], tr.states[t1], roleOf, 1);
    assert.equal(await targetAttr(NET), String(target1));
    await clickCube(tr.states[f1], tr.states[t1].pos[target1]);
    await said(/^Right: /);
    assert.equal(await page.textContent("#pStreak"), "Streak: 2");
    await next();

    // 3: a wrong click, on the net: the answer is said, the streak ends
    const [f2, t2] = units(chunks, r.moves.length, "move")[2];
    const target2 = pickTarget(tr.states[f2], tr.states[t2], roleOf, 2);
    const answer2 = tr.states[t2].pos[target2], wrong = posIndex(answer2 === posIndex([0, 0, 1]) ? [0, 0, -1] : [0, 0, 1]);
    await clickNet(wrong);
    await said(/^Not quite: the .+ went to [a-z-]+\.$/);
    assert.equal(await page.textContent("#pStreak"), "Streak: 0");
    assert.equal(await page.getAttribute("#pQuestion", "data-verdict"), "wrong");
    await frame(page);
    await shot(page, "predict-wrong");
    await next();

    // the keyboard: the net's cursor and Enter name a slot
    await page.focus(NET);
    await page.keyboard.press("Enter");
    await said(/^(Right|Not quite): /);
    assert.equal(await page.getAttribute("#pbar", "data-phase"), "shown");
    await next();

    // by chunk: one question for each chunk of the algorithm
    await page.click('#pBy [data-by="chunk"]');
    await frame(page);
    assert.equal(await page.getAttribute('#pBy [data-by="chunk"]', "aria-checked"), "true");
    const [fc, tc] = units(chunks, r.moves.length, "chunk")[0];
    assert.deepEqual([fc, tc], [0, 4]);
    const targetC = pickTarget(tr.states[fc], tr.states[tc], roleOf, 0);
    assert.equal(await targetAttr(NET), String(targetC));
    await clickNet(tr.states[tc].pos[targetC]);
    await said(/^Right: /);
    await page.waitForFunction(() => document.getElementById("pbar").dataset.phase === "shown");
    assert.equal(await page.$eval("#timeRange", (r) => r.value), "4", "the whole chunk was played");
    await next();
    // …and the last one ends the case
    const [fl, tl] = units(chunks, r.moves.length, "chunk")[1];
    const targetL = pickTarget(tr.states[fl], tr.states[tl], roleOf, 1);
    await clickNet(tr.states[tl].pos[targetL]);
    await said(/^Right: /);
    await next();
    assert.match(await page.textContent("#pQuestion"), /whole case/);
    assert.equal(await page.textContent("#pNext"), "Again");
    assert.equal(await targetAttr(NET), "");
    assert.equal(await page.getAttribute(SIDE, "data-goal"), "met", "the case played through to its goal");
    // choosing another case starts the questions again, and the streak carries on
    await page.click('#learnPanel .case[aria-label="Edge goes left"]');
    await frame(page);
    await frame(page);
    assert.notEqual(await targetAttr(NET), "", "a new case, a new question");
    assert.equal(await page.textContent("#pStreak"), "Streak: 2");
    await clean("predict");

    // the streak is memory only: nothing about Predict is stored
    const stored = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join(" "));
    assert.ok(!/streak/i.test(stored));

    // Learn again: the questions go, the playback controls come back
    await page.click('#modeSeg [data-mode="learn"]');
    await frame(page);
    assert.ok(await page.isHidden("#pbar"));
    assert.ok(await page.isVisible("#btnPlay"));
    assert.equal(await targetAttr(NET), "");
    await page.context().close();
  }

  // ── the twist ledger: step 7, in Learn and in Predict ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 }, null, { learn: true });
    await page.click('#learnPanel [data-step="yellow-twist"]');
    await page.waitForFunction(() => document.querySelectorAll("#timeline .tl-chip").length === 8 && !document.getElementById("strip").hasAttribute("data-busy"), null, { timeout: 8000 });
    await frame(page);
    assert.ok(await page.isVisible("#ledger"), "the ledger is on step 7");
    const r = resolve({ method: "beginner", step: "yellow-twist", case: "yt-right" }), tr = trace(r.start, r.moves);
    const cells = () => page.$$eval("#ledger tbody td, #ledger tfoot td", (c) => c.map((x) => x.textContent));
    const show = (n) => (n > 0 ? "+1" : n < 0 ? "\u22121" : "0");
    const expect = (i) => { const l = twistLedger(tr.states[i], HOLDINGS.yellowUp); return [...l.corners.map((c) => show(c.twist)), show(l.top), show(l.lower)]; };
    assert.deepEqual(await cells(), expect(0));
    assert.ok((await cells()).slice(0, 4).some((v) => v !== "0"), "a corner starts twisted");
    const scrubTo2 = async (v) => { await page.evaluate((v) => { const el = document.getElementById("timeRange"); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v); await frame(page); await frame(page); };
    await scrubTo2(r.moves.length);
    assert.deepEqual(await cells(), expect(r.moves.length), "the ledger follows the playback");
    assert.notDeepEqual(await cells(), expect(0), "…and what it says changes");
    assert.ok((await cells()).slice(4).some((v) => v !== "0"), "mid-way the lower corners hold what the top gave up");
    assert.match(await page.textContent("#ledger .sd-hint"), /0 mod 3/);
    const mono = await page.$eval("#ledger tbody td", (e) => getComputedStyle(e).fontFamily);
    assert.match(mono, /mononoki/, "the figures are in mononoki");
    await shot(page, "ledger-step7");
    await page.click('#modeSeg [data-mode="predict"]');
    await frame(page);
    assert.ok(await page.isVisible("#ledger"), "and in Predict");
    await page.click('#learnPanel [data-step="yellow-cross"]');
    await frame(page);
    assert.ok(await page.isHidden("#ledger"), "no other step has it");
    await clean("ledger");
    await page.context().close();
  }


  // ── Save image: the dialog, a PNG and a GIF, and what they are drawn in ──
  {
    const { page, clean } = await open({ width: 1440, height: 900 }, null, { learn: true });
    await page.click('#learnPanel [data-step="second-layer"]');
    await untilChips2(page, "z2");
    await settle(page);
    await page.click('#learnPanel .case[aria-label="Edge goes right"]');
    await frame(page);
    const r = resolve({ method: "beginner", step: "second-layer", case: (await page.getAttribute('#learnPanel .case[aria-label="Edge goes right"]', "data-case")) }, false);
    await page.click("#btnImage");
    await page.waitForSelector("dialog.export[open]");
    const PREVIEW = ".export .ex-canvas";
    assert.ok((await painted(page, PREVIEW)) > 3000, "the preview is drawn");
    assert.equal(await page.getAttribute(PREVIEW, "role"), "img");
    // the sheet: Night is dark and Paper is light, whatever the page is in
    const corner = () => page.$eval(PREVIEW, (cv) => { const d = cv.getContext("2d").getImageData(2, 2, 1, 1).data; return [d[0], d[1], d[2], d[3]]; });
    await page.click('.export [aria-label="Sheet"] [data-v="light"]');
    await page.waitForTimeout(200);
    assert.ok((await corner())[0] > 200, "the Paper sheet is light");
    await page.click('.export [aria-label="Sheet"] [data-v="dark"]');
    await page.waitForTimeout(200);
    assert.ok((await corner())[0] < 80, "the Night sheet is dark");
    await page.check('.export label:has-text("See-through background") input');
    await page.waitForTimeout(200);
    assert.equal((await corner())[3], 0, "a see-through picture has no background");
    await page.uncheck('.export label:has-text("See-through background") input');
    await page.click('.export [aria-label="Sheet"] [data-v="current"]');
    // the file: a PNG at the chosen width
    const read = async (dl) => (await import("node:fs")).readFileSync(await dl.path());
    await page.click('.export [aria-label="Size"] [data-v="s"]');
    await page.check('.export label:has-text("Last layer") input');
    await page.waitForTimeout(200);
    let [dl] = await Promise.all([page.waitForEvent("download"), page.click(".export footer .sd-primary")]);
    assert.match(dl.suggestedFilename(), /^cube-trace-edge-goes-right\.png$/);
    let bytes = await read(dl);
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), 960, "a small PNG is 960 wide");
    // the GIF: the whole algorithm, a few frames a turn
    await page.click('.export [aria-label="Format"] [data-v="gif"]');
    await page.waitForTimeout(150);
    [dl] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.click(".export footer .sd-primary")]);
    assert.match(dl.suggestedFilename(), /\.gif$/);
    bytes = await read(dl);
    assert.equal(bytes.subarray(0, 6).toString(), "GIF89a");
    assert.equal(bytes.readUInt16LE(6), 480, "a small GIF is 480 wide");
    let frames = 0;
    for (let i = 0; i < bytes.length - 3; i++) if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) frames++;
    assert.equal(frames, gifPlan(r.moves.length).length, "one frame for each moment of the algorithm");
    // nothing ticked: Save says why it can't
    for (const id of ["cube", "net", "ll"]) await page.uncheck(`.export label:has-text("${{ cube: "Cube", net: "Net", ll: "Last layer" }[id]}") input`);
    assert.equal(await page.getAttribute(".export footer .sd-primary", "aria-disabled"), "true");
    assert.match(await page.getAttribute(".export footer .sd-primary", "title"), /at least one view/);
    await page.keyboard.press("Escape");
    assert.ok(!(await page.$eval("dialog.export", (d) => d.open)), "Escape closes the save dialog");
    await clean("save image");
    await page.context().close();
  }


  // ── keyboard and names: an axe-like pass, without dependencies ──
  {
    // Every control a person can reach has a name; every canvas is a picture with a name or hidden.
    const unnamed = (page) => page.evaluate(() => {
      const visible = (el) => el.getClientRects().length > 0 && !el.closest("[hidden], [inert]") && getComputedStyle(el).visibility !== "hidden";
      const nameOf = (el) => {
        const by = el.getAttribute("aria-labelledby");
        if (by) { const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim(); if (t) return t; }
        const al = el.getAttribute("aria-label");
        if (al && al.trim()) return al.trim();
        if (el.labels?.length) { const t = [...el.labels].map((l) => l.textContent).join(" ").trim(); if (t) return t; }
        if (!["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) return el.textContent.trim();
        return el.type === "button" || el.type === "submit" ? el.value : "";
      };
      const bad = [];
      const q = 'button, input, select, textarea, summary, a[href], [role="tab"], [role="radio"], [role="separator"][tabindex], [tabindex]:not([tabindex="-1"]), canvas';
      for (const el of document.querySelectorAll(q)) {
        if (!visible(el)) continue;
        const d = el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
        if (el.tagName === "CANVAS") {
          if (el.getAttribute("aria-hidden") === "true" || el.closest('[aria-hidden="true"]')) continue;
          if (!["img", "application"].includes(el.getAttribute("role")) || !nameOf(el)) bad.push(d + " (canvas without a role and name)");
        } else if (!nameOf(el)) bad.push(d);
      }
      return bad;
    });
    // Tab all the way round: focus only lands on things you can see, each shows a ring, and it comes back to the start.
    const tabRound = async (page, what) => {
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      const seen = [], ids = new Set();
      for (let i = 0; i < 200; i++) {
        await page.keyboard.press("Tab");
        const measure = () => page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return { body: true };
          const cs = getComputedStyle(el), box = el.getBoundingClientRect();
          el.__stop ??= (window.__stops = (window.__stops || 0) + 1);
          return {
            uid: el.__stop, id: el.id || el.className?.toString().split(" ")[0] || el.tagName,
            shown: el.getClientRects().length > 0 && !el.closest("[hidden], [inert]") && cs.visibility !== "hidden" && box.width > 0 && box.height > 0,
            ring: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none" || el.classList.contains("dk-gutter"),
            onScreen: box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight,
          };
        });
        let at = await measure();
        if (at.body) { if (seen.length > 5) break; continue; } // focus left the page: it has come round
        if (!at.onScreen) { await page.waitForTimeout(350); at = await measure(); } // the skip link slides in
        if (ids.has(at.uid)) break; // back at the start
        ids.add(at.uid);
        assert.ok(at.shown, `${what}: focus landed on something hidden (${at.id})`);
        assert.ok(at.ring, `${what}: no focus ring on ${at.id}`);
        assert.ok(at.onScreen, `${what}: focus is off screen on ${at.id}`);
        seen.push(at.id);
      }
      assert.ok(seen.length > 10 && seen.length < 190, `${what}: Tab goes round and doesn't trap focus (${seen.length} stops)`);
      return seen;
    };

    const { page, clean } = await open({ width: 1440, height: 900 }, null, { learn: true });
    assert.deepEqual(await unnamed(page), [], "Learn: every control has a name");
    // the case grid is one tab stop, and the arrows move across it
    assert.equal(await page.$$eval("#learnPanel .case", (b) => b.filter((x) => x.tabIndex === 0).length), 1, "the case grid is one tab stop");
    const stops = await tabRound(page, "Learn");
    assert.equal(stops.filter((id) => id === "case").length, 1, "Tab visits the case grid once");
    await page.focus("#learnPanel .case[tabindex='0']");
    const first = await page.evaluate(() => document.activeElement.dataset.case);
    await page.keyboard.press("ArrowRight");
    const second = await page.evaluate(() => [document.activeElement.dataset.case, document.activeElement.tabIndex]);
    assert.notEqual(second[0], first, "the right arrow moves to the next case");
    assert.equal(second[1], 0, "…and that case is now the tab stop");
    await page.keyboard.press("ArrowDown");
    assert.ok(await page.evaluate(() => document.activeElement.classList.contains("case")), "the down arrow stays in the grid");
    await page.keyboard.press("Home");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.case), await page.$eval("#learnPanel .case", (b) => b.dataset.case), "Home goes to the first case");
    // a radiogroup is one tab stop, and the arrows choose
    assert.equal(await page.$$eval("#speedSeg [role=radio]", (b) => b.filter((x) => x.tabIndex === 0).length), 1);
    await page.focus('#speedSeg [aria-checked="true"]');
    await page.keyboard.press("ArrowRight");
    await frame(page);
    assert.equal(await page.getAttribute('#speedSeg [data-speed="2"]', "aria-checked"), "true", "the arrow chooses the next speed");
    await page.keyboard.press("ArrowLeft");
    await frame(page);
    // a name that follows the case and the position
    await page.click('#learnPanel [data-step="second-layer"]');
    await untilChips2(page, "z2");
    await settle(page);
    await page.click('#learnPanel .case[aria-label="Edge goes right"]');
    await frame(page);
    assert.match(await page.getAttribute(CUBE, "aria-label"), /^Cube: .+, before the first move\. Seen from/);
    await page.click("#btnFwd");
    await settle(page);
    assert.match(await page.getAttribute(CUBE, "aria-label"), /^Cube: .+, before move 2 of \d+\./);
    assert.match(await page.getAttribute(NET, "aria-label"), /^Net: .+, before move 2 of \d+\./);
    assert.match(await page.getAttribute('.view[data-view="ll"] canvas', "aria-label"), /^Last layer: .+, before move 2 of \d+\./);
    // Escape closes every dialog and the View popover
    for (const [btn, dlg] of [["#btnKeys", "#keysDialog"], ["#btnNotation", "#primer"], ["#btnImage", "dialog.export"]]) {
      await page.click(btn);
      assert.ok(await page.$eval(dlg, (d) => d.open), `${btn} opens its dialog`);
      assert.ok(await page.evaluate((d) => document.querySelector(d).contains(document.activeElement), dlg), `${btn}: focus moves into the dialog`);
      await page.keyboard.press("Escape");
      assert.ok(!(await page.$eval(dlg, (d) => d.open)), `Escape closes ${dlg}`);
      assert.equal(await page.evaluate(() => document.activeElement?.id), btn.slice(1), `${btn}: focus comes back to the button`);
    }
    await page.click("#btnView");
    assert.ok(await page.$eval("#viewPop", (p) => p.matches(":popover-open")));
    await page.keyboard.press("Escape");
    assert.ok(!(await page.$eval("#viewPop", (p) => p.matches(":popover-open"))), "Escape closes the View popover");
    // Explore and Predict
    await page.click('#modeSeg [data-mode="explore"]');
    await frame(page);
    assert.deepEqual(await unnamed(page), [], "Explore: every control has a name");
    await tabRound(page, "Explore");
    await page.click('#modeSeg [data-mode="predict"]');
    await frame(page);
    assert.deepEqual(await unnamed(page), [], "Predict: every control has a name");
    assert.equal(await page.getAttribute("#pNext", "aria-disabled"), "true");
    assert.match(await page.getAttribute("#pNext", "title"), /Answer/, "a blocked Next says why");
    await tabRound(page, "Predict");
    await clean("keyboard pass");
    await page.context().close();
  }
  // the phone: the drawer's controls are named, and Escape closes the drawer
  {
    const { page, clean } = await open({ width: 390, height: 844 }, null, { learn: true });
    await page.click("#btnMenu");
    await frame(page);
    assert.equal(await page.getAttribute("#btnMenu", "aria-expanded"), "true");
    assert.ok(await page.evaluate(() => document.getElementById("side").contains(document.activeElement)), "focus moves into the drawer");
    await page.keyboard.press("Escape");
    await frame(page);
    assert.equal(await page.getAttribute("#btnMenu", "aria-expanded"), "false", "Escape closes the drawer");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "btnMenu", "focus comes back to Menu");
    await clean("phone keyboard");
    await page.context().close();
  }

  // ── no storage (private mode, or blocked): everything still works, nothing is kept ──
  {
    const { page, clean } = await open({ width: 1280, height: 720 }, () => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
    });
    assert.deepEqual(await openViews(page), ["cube", "net", "ll"]);
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
    assert.deepEqual(await openViews(page), ["cube", "net", "ll"]);
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
