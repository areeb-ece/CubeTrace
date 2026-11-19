# CLAUDE.md

Cube Trace: a static, no-build web tool in areeb's family of tools (`areeb-ece.github.io`,
`prereqflow`, `otucalendar`, `satisfactorytools`, `PrayerCalendar`, `LaplaceAnalyser`),
served at `/CubeTrace/`. It teaches the beginner method and CFOP by tracking pieces
through every turn. `README.md` has the architecture and the commands; `PLAN.md` has the
reasoning behind the design.

## Hard rules

- **No build step, no framework, no dependencies in `package.json`.** Vanilla ES modules.
  `vendor/` is empty: the cube is drawn with Canvas 2D (PLAN.md D2). Don't add a library
  without asking areeb.
- **The look comes from the master design files** (`areeb-ece.github.io/public/design/`,
  served at `/design/`). `css/style.css` uses their tokens only: no raw colours, sizes or
  durations. `assets/design/` is an offline copy; refresh it when the master changes,
  never edit it. Use the `sd-` components wherever one fits; local styles are marked
  "local". States are attributes (`aria-*`, `data-*`), not classes.
- **Sticker colours are the one exception to "no raw colours".** The six sticker colours
  and the cube body live in `js/palette.js` (`STICKERS`, `BODY`), the same in every
  theme, never in CSS. `tests/themes.test.js` checks them against the body and each
  other. Everything that isn't a sticker is one theme token per quantity, each with a
  cue that isn't colour (outline, hatching, dashes, arrows).
- **The engine (`js/lib/`) is pure**: no DOM, runs in Node, never imports from outside
  its folder. Views draw what it returns and do no cube maths of their own.
- **Track pieces, not stickers.** Every highlight, label, trail and role belongs to a
  piece (a cubie id) and moves with it.
- **A view draws through its `paint` function only**, which must not touch the DOM or
  the store: the same function draws the page, every saved picture and the thumbnails.
- **Never show a silently wrong result.** Notation the parser can't read is refused
  with a `NotationError` that says where, what's wrong and what to type instead.
  Anything ambiguous (`R'2`) is asked about, not guessed.
- **Content is data and is tested.** An algorithm that fails its preservation, goal,
  coverage or mirror test doesn't ship. Cases are made by undoing the algorithm, so a
  case can never disagree with its algorithm.
- **CSP stays strict** (`index.html`): no `style-src-attr` at all, no inline scripts or
  styles, no `style="…"` in markup (use `el.style.setProperty`), no external requests.
  The browser check fails on any violation.
- **Tests before commits:** `npm test`, then `npm run test:browser` offline and with
  `DESIGN_DIR=../areeb-ece.github.io/public/design`.

## Display rules

No inferable bloat in the UI or in exports (image, SVG, PDF, print, text). Displayed
text is bloat if any of these apply:

1. **Inferable from the view:** it restates what the viewer can already see or count on
   the same screen or export (totals of visible cards, per-column counts, "7 to go" next
   to a list of those 7).
2. **Not about this view:** it describes data that isn't shown (whole-sheet totals on an
   export of the goal path). Any number that stays is computed from exactly what that
   view displays.
3. **Trivia:** it doesn't help the user decide or do anything (link, card or machine
   counts, layout mode, generation dates and timestamps).
4. **Raw internal format:** an internal code where a human label exists ("1-1" →
   "Year 1 Sem 1", "202701" → "Winter 2027").
5. **Duplicate:** the same fact twice on one view. Keep the one in the most useful place.

Test for every candidate: given what's still visible, would the user lose anything they
need if it were gone? If not, leave it out.

Keep: legends and keys, a status label that is the only non-colour cue for that status,
titles, and any fact the user needs that appears nowhere else on the view. Useful text
in the wrong place gets moved, not deleted.
