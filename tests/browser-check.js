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
import { solved, stickers, kindOf } from "../js/lib/cube.js";
import { facesAt } from "../js/lib/pieces.js";

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
const settle = async (page) => { await frame(page); await page.waitForFunction(() => !document.getElementById("strip").hasAttribute("data-busy"), null, { timeout: 8000 }); await frame(page); };
const VIEW = '.view[data-view="cube"]';
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

  // ── phone: one column, nothing sideways ──
  {
    const { page, clean } = await open({ width: 390, height: 844 }, null, { hasTouch: true });
    await typeMoves(page, "R U R' U'");
    assert.deepEqual(await openViews(page), ["cube", "net", "ll"]);
    const [cube, net, side] = await Promise.all([CUBE, NET, ".side"].map((s) => page.locator(s).boundingBox()));
    assert.ok(cube.height > 150 && net.height > 150 && cube.y < net.y && net.y < side.y, `a column: cube ${cube.y}, net ${net.y}, moves ${side.y}`);
    assert.ok(cube.width <= 390 && net.width <= 390 && side.width <= 390);
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
