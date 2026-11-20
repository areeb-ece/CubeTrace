# Cube Trace: plan

Status: **approved and built.** Approved on 2026-11-19 ("go ahead with the plan") with
the recommended option for every decision, D1 to D9; all ten milestones are done.
Section 14 lists what changed while building.

The brief this answers is the one you gave on 2026-11-19 (sections 0 to 12 below are
mine; "brief §n" points at yours).

---

## 1. What I found in the existing repos

Read in depth: `areeb-ece.github.io` (`CLAUDE.md`, `PRODUCT.md`, `CONTENT_GUIDE.md`'s
Tool buttons section, every file in `public/design/`) and `LaplaceAnalyser` as the
template (`CLAUDE.md`, `PLAN.md`, `README.md`, `index.html`, `css/style.css`,
`js/theme.js`, `js/palette.js`, `js/store.js`, `js/dock.js`, `js/legend.js`,
`js/export/render.js`, `scripts/vendor.js`, `tests/`, `.github/workflows/test.yml`).

### What the template gives this repo

| Piece | In LaplaceAnalyser | Here |
| --- | --- | --- |
| Shell | `index.html` with the CSP `<meta>`, `header.sd-bar`, a strip under the bar, a docked workspace | same shape; CSP **without** `style-src-attr` (no KaTeX) |
| Design wiring | own `css/style.css` (Night and Paper fallback values), then `/design/tokens.css`, `ui.css`, `fonts.css`, `theme.js`, then `js/theme.js` linking `assets/design/` when `/design/` is missing | identical, storage key `cubetrace.theme` |
| State | `js/store.js`: one store, dirty keys, one redraw per animation frame | copied as is |
| Colours for canvas | `js/palette.js` resolves tokens through a hidden probe element, re-resolves on theme change | same mechanism, new roles, plus the fixed sticker palette (section 7) |
| Views | each draws through a pure `paint(g, state, o)`; keys come from `legend.js` | same rule |
| Docking | `js/dock.js` (309 lines): split tree of tab stacks, keyboard splitters, panel menus | copied (D9) |
| Pictures | `js/export/`: one renderer for page and file, a hand-written GIF writer in `js/lib/gif.js` | PNG and GIF (D7) |
| Tests | `node --test "tests/*.test.js"`; `tests/serve.js` serves at the Pages path and stubs `/design/`; `tests/browser-check.js` (Playwright 1.56.1, `--no-save`, SwiftShader) | same files, adapted |
| CI | `.github/workflows/test.yml`: unit job; browser job pinned to `ubuntu-24.04`, apt cache, a second run against the live `/design/` files | copied |

### The shared design system

- 15 themes in `tokens.css`. Five are light (Paper, Ink, Sepia, Solar light, Rosé);
  four are close to monochrome (Void, Console, Amber, Ink). **Paper, Ink and Rosé use a
  pure white `--card`**, which matters for D3.
- Shared scales: `--fs-1..8`, `--sp-1..10`, `--ctl-h*`, `--dur-1..3` (zeroed by
  `prefers-reduced-motion` and by `data-motion="off"`), `--z-*`, `--ring*`, and mixed
  colours (`--tint`, `--well`, `--field`, `--hover`, `--row-line`…).
- `ui.css` has every component the brief names (`sd-bar`, `sd-wordmark`, `sd-btn`,
  `sd-seg`, `sd-tabs`, `sd-select`, `sd-range`, `sd-table`, `sd-callout`, `sd-tag`,
  `sd-kbd`, `sd-dialog`, `sd-toast`), plus `sd-check`, `sd-sw` (switch), `sd-note` and
  `sd-hint`.
- The settings panel (`ui.js`) is shared and has no hook for a site's own options, so
  the tool's own switches can't live there without changing `public/design/` (D8).

### Things that differ from the brief

- **The draft notes page and the `cubetrace` reserved slug are not on the portfolio's
  `main`.** They exist only on the unmerged branch `claude/cubetrace-tools-page`
  (commit `d28df07`: `content/tools/cubetrace-notes/index.md`, `reservedSlugs`,
  `CONTENT_GUIDE.md`, `tests/config.test.ts`). The section 11 follow-up should start from
  that branch, or that branch should merge first. I haven't touched it.
- **The shared files' header comments still say "five sites"** (`tokens.css`, `ui.css`,
  `ui.js`, `theme.js`), though LaplaceAnalyser already made six. Cube Trace makes seven.
  Fixing them means editing `public/design/`, so it's listed in section 13, not done.
- **"Every sticker at 3:1 against `--card` and `--bg` in all 15 themes" can't pass** with
  any palette that has a white and a yellow sticker: on Paper's white card, white is 1:1.
  D3 proposes testing against the cube's body instead.
- **CubeTrace's `README.md` is a single blank line.** The real README comes in the last
  milestone.

---

## 2. Decisions that need your sign-off

### D1. Stack: no build step, vanilla ES modules (recommended)

Same as every tool: `index.html` + `css/` + `js/`, types through JSDoc, `node --test`,
GitHub Pages serving the `main` branch root at `/CubeTrace/`. `package.json` has
scripts and no dependencies.

Alternative: Vite + TypeScript. Better tooling, but a different setup from the five
siblings for no gain at this size.

### D2. The 3D cube: hand-written Canvas 2D (recommended) or Three.js 0.183.0

A Rubik's cube is an unusually easy 3D scene: 26 boxes on a grid, flat stickers, one
turning slab at a time. That makes a hand-written projected renderer practical, and it
fits this tool better than WebGL.

**Recommended: Canvas 2D, about 400 lines, no library.**

- The renderer projects each cubie's visible faces (back faces culled) and paints them
  far to near. Ordering is exact where it matters: during a turn the cube is two convex
  groups (the slab and the rest) on either side of a plane, and the camera's side of
  that plane says which to paint first. Inside a group, cubies on a grid are ordered by
  depth.
- The scene (polygons, their depth order, what each one is) is built by a pure module
  in `js/lib/`, so a Node test can check the painter's order against a brute-force
  per-pixel depth test for every move at sampled camera angles.
- **Everything the brief asks to draw is native 2D:** hatching on displaced pieces,
  dashed ghost outlines, curved turn arrows, the axis line, letters on stickers, accent
  outlines. In WebGL each of these is a texture, a line geometry or an overlay canvas.
- **One `paint` function draws the page, the saved picture, the GIF frames and the 41
  F2L thumbnails**, at any size, with no render-to-texture step.
- Picking (click a sticker, brushing, Predict) is point-in-polygon on the projected
  quads.
- **No WebGL means no WebGL fallback** (brief §8): the cube works everywhere the net
  does. The browser check stops depending on SwiftShader, which LaplaceAnalyser needs
  90-second timeouts for.
- Lighting is flat shading per face direction, which is all flat stickers need.

**Alternative: Three.js 0.183.0, core module only, vendored by `npm run vendor`** at
LaplaceAnalyser's version.

- Gains: exact depth buffer, real lighting, bevelled cubies, shadows if wanted.
- Costs: about 730 KB minified (about 180 KB gzipped) per visit. "One Three.js for the
  family" holds for the version, but not the download: each repo serves its own copy
  under its own path, so browsers cache them separately.
- It also brings a no-WebGL fallback to build and test, and an overlay canvas for every
  2D mark.

What would change my mind: wanting a photoreal cube (rounded cubies, soft shadows).

### D3. Sticker colours (the one fixed palette)

Sticker colours are identities, not theme hues: the four near-monochrome themes would
make a theme-coloured cube unreadable. That much is as the brief says. What I'd change
is what the stickers are tested against.

**Recommended: a fixed six-colour palette on a fixed dark cube body, the same in every
theme.**

- Standard scheme: white opposite yellow, green opposite blue, red opposite orange;
  white U, green F, red R in the starting hold.
- Like a real black-plastic cube, every sticker sits on the body with a gap, on the 3D
  cube, the net and the last-layer diagram alike. A sticker never touches the page, so
  one palette works on a dark and a light sheet and **no light variant is needed**.
- The body's silhouette gets a hairline in `--ink-3`, so the cube's outline reads on
  any background, Void's pure black included.
- The six hex values live in `js/palette.js` (`STICKERS`), the one documented exception
  to "no raw colours", written into `CLAUDE.md`. CSS never sees them.

What `tests/themes.test.js` checks (replacing the brief's "against `--card` and `--bg`",
which white and yellow can't pass on Paper):

1. Every sticker against the body: at least 3:1.
2. Every pair of stickers distinguishable: CIELAB distance at least 20. Blue on black
   and red against orange are the tight ones; the values will be tuned until they pass.
3. The silhouette hairline (`--ink-3`) against `--bg` and `--card`: at least 3:1 in all
   15 themes.
4. Role colours: `kept` (desaturated) stays at least 3:1 on the body and distinct from
   its full colour; `ignored` grey stays visibly distinct from the body.

Alternative (the brief's): no body, stickers straight on the sheet, with a light-scheme
variant picked by `data-scheme`. It needs darker "white" and "yellow" on light themes,
which no longer look white and yellow, and the 3:1 test still fails on white cards.

**D3b. Letters on stickers (`W Y G B R O`).** A switch in the tool's View menu (D8),
remembered.

- Recommended default: **off in every theme.** With fixed stickers, a monochrome theme
  doesn't make the cube harder to read.
- The real risk is colour-vision deficiency (red against orange, green against
  orange), which doesn't depend on theme. The switch is one click away, and the first
  run of the notation primer points at it.
- Alternative (the brief's): on by default in Void, Console, Amber and Ink.

### D4. Orientation conventions

**Beginner method.** White on **U** for steps 1 and 2, then an animated whole-cube
rotation so yellow is on U from step 3.

- **Recommended flip: `z2`.** Green stays in front, so steps 3 to 7 hold the cube
  exactly as CFOP does (yellow U, green F, which puts orange on R), and an algorithm
  shared by both methods looks identical in both.
- Alternative: `x2` keeps red on R but brings blue to the front, so the shared
  algorithms look different between the two methods.

**CFOP.** Cross on **D** (white D, green F, so yellow U and orange R) from the first
step, as speedsolvers hold it. F2L cases use the front-right slot; their mirrors use
the front-left. Last-layer diagrams are drawn from above with F at the bottom.

**Both:** the engine colours stickers by piece identity, so the colour on each face
always follows from the rotations applied. Nothing is drawn from a fixed face-to-colour
table.

### D5. Content in the first release: everything in brief §4 (recommended)

The first release is milestones 2 to 10 and includes full OLL (57) and PLL (21).

- The coverage tests in brief §4.3 make transcribed algorithms trustworthy, and the
  data is bounded: 41 F2L cases (plus mirrors), 57 OLL, 21 PLL, the 2-look subsets and
  the beginner steps.
- Hand-written chunks and captions go on the beginner algorithms and the 2-look sets,
  as the brief says. The full sets use automatic annotation plus a short recognition
  line each.
- I'd split milestone 8 into three commits so each lands green: 8a cross and F2L,
  8b 2-look OLL/PLL, 8c full OLL/PLL.

Alternative: ship 2-look only in the first release and the full sets after. Less to
check up front, but brief §12 asks me not to postpone anything in §4 without asking,
and I don't think it needs postponing.

### D6. Name and address: Cube Trace (recommended, as given)

Title "Cube Trace", wordmark `CUBE<span>/</span>TRACE`, repo `CubeTrace`, served at
`/CubeTrace/`, storage keys `cubetrace.*`. It matches the portfolio's draft page and
reserved slug. Changing it later means renaming those (brief §11).

### D7. Save image: PNG and an animated GIF (recommended)

- **PNG:** the chosen views, drawn by the same `paint` functions in the current, Night
  or Paper sheet.
- **GIF:** the current algorithm playing, one frame set per move.
- The GIF writer is LaplaceAnalyser's `js/lib/gif.js` (hand-written, pure, unit
  tested), copied with its tests. No new dependency.
- The save dialog is a smaller version of LaplaceAnalyser's: views, size, sheet,
  transparent background, title block on or off.
- Alternatives: PNG only (smaller milestone 10), or LaplaceAnalyser's full set with
  video through `MediaRecorder`.

### D8. Where the tool's own options live: a View menu in the header (recommended)

- The shared settings panel can't take site-specific switches without a change to
  `public/design/ui.js`.
- So the tool's options go in its own View menu (an `sd-btn` opening a small popover of
  `sd-sw` switches), remembered in `cubetrace.options`: letters on stickers, mirror
  panes, spring back after orbiting, net and last-layer arrows.
- **Full colour** and **Mirror** stay on the transport strip, as the brief puts them.
- Alternative: add a "this site's options" hook to the shared panel, which needs your
  go-ahead on `public/design/`.

### D9. Docking: copy LaplaceAnalyser's `dock.js` (recommended)

- The stage has three panels: **Cube** (with its mirror panes), **Net** and **Last
  layer**. `dock.js` already does what the brief asks: keyboard splitters, a panel menu
  to move panels without dragging, reopening from a menu, saved layouts, and a stacked
  column on phones.
- It's a copy, so the top of the file names its source and the date, to keep the two in
  step.
- Alternative: a fixed grid with show/hide toggles, about 100 lines. Simpler, but the
  layout can't be rearranged.

---

## 3. Architecture

```
index.html              shell: bar, side panel, docked stage, transport strip, CSP
css/style.css           layout and local components (tokens only) + Night/Paper fallback
js/theme.js             offline design fallback (as LaplaceAnalyser)
js/app.js               boot, wiring, keyboard, persistence
js/store.js             shared state, one redraw per animation frame (copied)
js/dock.js              docking stage (copied, D9)
js/palette.js           theme roles for canvas + the fixed sticker palette (D3)
js/timing.js            every duration and the pause rules, in one place
js/player.js            playback: cursor, speed, chunk pauses, reduced motion
js/announce.js          the polite live region's sentences
js/legend.js            keys under views (copied pattern)
js/views/
  cube.js               3D cube + mirror panes (Canvas 2D, D2)
  net.js                2D net with rim and cycle arrows
  ll.js                 last-layer diagram with net-change arrows and twist marks
  panel.js              side panel: steps, case grid, timeline, captions, recognition
  timeline.js           move chips, inverse brackets, chunk bands
  primer.js             notation primer dialog
  ledger.js             twist ledger (beginner step 7)
js/export/              save dialog and picture renderer (D7)
js/lib/                 THE ENGINE: pure, no DOM, runs in Node, imports only from js/lib/
  rot.js                  the 24 rotation matrices and their product table
  cube.js                 26 cubies: position in {-1,0,1}^3 + rotation index; apply a move
  moves.js                every move as (axis, layer set, quarter turns), WCA directions
  notation.js             tokenizer, parser, formatter; NotationError with position
  pieces.js               piece identity, names ("white-red edge"), cp/co/ep/eo
  algebra.js              inverse, mirror L/R, mirror across the FR diagonal, AUF, compare mod U
  trace.js                per-move diff: who moved, from where to where, twist delta; net change
  structure.js            inverse pairs, conjugates, commutators, triggers, chunking
  roles.js                role predicates and per-step role sets
  scene.js                camera, projection, painter's order, hit polygons (D2)
  layout2d.js             net and last-layer cell geometry
  goals.js                step goal predicates
  gif.js                  GIF writer (copied, D7)
  content/
    primer.js             notation cards
    beginner.js           the 7 steps
    cfop.js               cross and F2L concepts, worked examples
    f2l.js  oll.js  pll.js the case sets
vendor/                 empty under D2's recommendation (Three.js lives here otherwise)
assets/                 icon.svg, fonts/ (mononoki + OFL), design/ (offline copy)
tests/                  *.test.js (node --test), serve.js, browser-check.js
```

Content counts as data, so it lives inside `js/lib/` where Node tests can import it.

## 4. State model

One store (LaplaceAnalyser's). Views subscribe and get the set of changed keys.

| Key | Contents | Written by |
| --- | --- | --- |
| `mode` | `learn` / `explore` / `predict` | header `sd-seg` |
| `sel` | method, step, case id, chosen algorithm, mirrored | side panel, mirror toggle |
| `alg` | derived: parsed moves, chunks, inverse pairs, start state, per-move traces, net change | store, on `sel` change |
| `play` | cursor (move index + fraction of the current turn), playing, speed | transport, timeline, keys |
| `explore` | the free state, its move history, applied role set | Explore controls, keys, cube drags |
| `predict` | target piece, chosen slot, answer shown, session streak | Predict mode |
| `hover` | brushed piece id or null | every view |
| `camera` | orbit angles, spring target | cube view |
| `opts` | full colour, letters, mirror panes, spring back, arrows | View menu, strip |
| `layout` | dock tree | dock |

- **Persisted** (versioned, validated, wrapped in `try/catch`): `opts`, `layout`, speed,
  and the last method, step and case.
- **Not stored:** the Predict streak (memory only, as the brief asks) and Explore states.

## 5. Engine (brief §5)

**Representation.** A state is 26 cubies, each with a position $p \in \{-1,0,1\}^3$ and
an orientation $R$, one of the 24 rotation matrices with integer entries.

- A move is an axis, a set of layers on that axis, and a number of quarter turns. It
  applies $p \mapsto Mp$ and $R \mapsto MR$ to every cubie whose coordinate on the axis
  is in the set.
- Face turns, slices, wide moves and rotations are all the same operation. Centres are
  cubies too, so `M`, `E`, `S` and `x y z` move them, and which colour is on U is read
  from the state, never assumed.
- `cp/co/ep/eo` (with the standard reference stickers) are derived for tests and
  analysis.
- A sticker's colour is a property of the piece: face $n$ of cubie $c$ shows the colour
  of its home face $R_c^{-1}n$.

**Notation.**

- `U D L R F B`, with suffixes `'`, `2`, `2'`.
- Wide moves `Rw` and `r` (all six faces), slices `M E S`, rotations `x y z`.
- Parentheses with repeats, as in `(R U R' U')3`, and `//` comments.
- WCA directions: `M` turns like `L`, `E` like `D`, `S` like `F`; `x` like `R`, `y` like
  `U`, `z` like `F`; `r` is `R M'`.
- Errors are `NotationError(position, message)` saying what was expected and what to
  type instead, e.g. "`Q` at 7 isn't a move: the faces are U D L R F B".
- Anything ambiguous is refused, not guessed. For example `R2'` is fine but `R'2` is
  asked about ("did you mean `R2`?").
- Lowercase `u d l f b` are wide moves, as in standard notation.

**Operations.**

- `inverse`.
- `mirrorLR`: reflect through the M plane. L and R swap (`R` becomes `L'`), turns
  about the other two axes reverse (`U` becomes `U'`), and `x` and `M` stay as they
  are. Used for left/right pairs.
- `mirrorFR`: reflect through the plane holding the U–D axis and the FR edge. F and R
  swap, L and B swap, every direction reverses. The 41 F2L cases fall into such pairs
  (`R U' R'` against `F' U F`), plus a few that are their own mirror. The case grid pairs
  them, and a test checks them.
- AUF normalisation; compare modulo `U` before, after or both.
- Per-move diff, net change of a sequence (permutation cycles and twists).

**Structure** (brief §3.5):

- **Inverse pairs:** move $i$ pairs with the nearest later $j$ where $m_j = m_i^{-1}$ and
  nothing between them turns the same layer. In `R U R' U'` that gives two crossing arcs,
  `R…R'` and `U…U'`.
- **Conjugate:** the longest prefix $X$ whose inverse is the suffix, giving
  $X\,Y\,X^{-1}$.
- **Commutator:** $[X, Y] = X\,Y\,X^{-1}\,Y^{-1}$, tried at every split of the middle.
- **Triggers:** a small dictionary and its mirrors (sexy move, sledgehammer, the two
  inserts, Sune, `F · [R, U] · F'`). The longest match wins.
- Authored chunks override all of this.
- **Commutator view:** the pieces moved by both $X$ and $Y$.

**Roles** (brief §3.2) come from predicates on piece identity ("has a white sticker",
"the FR pair", "home in D"), so any step's role set applies to any state in Explore.

**Group sanity tests:** $R^4 = I$, $(R\,U)^{105} = I$, $(R\,U\,R'\,U')^6 = I$, inverse and
mirror are involutions, and both mirrors commute with inversion.

## 6. Teaching views (brief §3)

### The cube view

- **Default camera** shows U, F and R. Drag to orbit; it springs back on release unless
  the View menu turns that off. Arrow keys orbit when the stage has focus and Shift is
  held.
- **Mirror panes:** B, L and D reflected on three small panes beside the cube, painted
  from the same scene.
- **Turn anatomy** (brief §3.3), during a turn:
  - the slab gets a `--tint` outline and lifts slightly along its axis;
  - a thin axis line runs through it;
  - a curved arrow shows the direction as seen from outside that face (for `L`, `D` and
    `B` the arrow is drawn from that face's side, which is the point).
- **Roles** (brief §3.2):
  - `focus`: full colour, accent outline around the piece.
  - `kept`: desaturated.
  - `top-only`: only the U-colour sticker coloured.
  - `ignored`: flat grey.
  - The **Full colour** switch restores everything.
- **Disturb and restore** (brief §3.4): a displaced kept piece gets hatching; its home
  slot shows a dashed ghost until it returns.
- **Orientation marks** (brief §3.7): a small notch on each piece's reference sticker, so
  a twisted corner visibly points the wrong way.
- **Explore and Predict:** dragging across a sticker turns its layer; clicking a slot
  answers a prediction.

### The net

- Standard cross layout (U above F; L F R B in a row; D below), with the same roles,
  hatching and ghosts.
- With a turn selected, it draws the 4 rim triplets with arrows to where each goes, and
  the corner and edge 4-cycles as two cycle arrows. Together these answer "why does `R`
  change U, F, D and B?"

### The last-layer diagram

- The U face plus each last-layer piece's side strip, as OLL/PLL sheets draw them.
- Net change as permutation arrows (one per cycle) and twist marks.
- **Net change only** shows it side by side with the playback.

### The side panel

- Step list, then the case grid: small last-layer diagrams for OLL and PLL; small cube
  thumbnails for F2L, painted by the cube view's own `paint`.
- Then the selected case's timeline, chunk captions, recognition notes and "Also used
  in…" links.
- Alternative algorithms in an `sd-select`, shown only when a case has more than one.

### The timeline

- Mononoki move chips; the current one is marked; clicking a chip seeks there.
- Bracket arcs above the chips join inverse pairs.
- Chunk bands below: `setup` and its `undo` share one colour (a conjugate reads as a
  sandwich); `trigger` and `insert` have their own.
- One caption per chunk.

### The twist ledger

Beginner step 7, and on demand in Explore.

- Each corner's twist as `0`, `+1` or `−1` (thirds of a turn), plus the running total.
- The total is always $\sum_i t_i \equiv 0 \pmod 3$, which is why the bottom layer looks
  broken mid-way and fixes itself.

### The notation primer

A dialog, and the first thing a new visitor is offered.

- One card per face with its prime and double, then `M E S`, wide moves and `x y z`.
- Each card plays the move with the full turn anatomy.
- Piece identity (20 moving pieces around 6 fixed centres) is the first card.

### Brushing

Hovering or focusing a piece in any view sets `hover`; every view outlines it.

## 7. Colour

- **Stickers:** the fixed palette (D3), in `js/palette.js` as `STICKERS`.
- **Everything else is theme tokens, one role each,** resolved like LaplaceAnalyser's
  palette. Every role also has a shape cue:

| Quantity | Token | Shape cue |
| --- | --- | --- |
| `focus` outline, Predict target | `--accent` | thick outline |
| Turning slab | `--tint` + `--accent` edge | outline + lift |
| `ignored` stickers, ghost holes | `--ink-4`, `--rule` | flat grey; dashed outline |
| Displaced kept pieces | `--ink-2` | hatching |
| `setup` / `undo` chunk band | `--c0` | band under the chips, same pattern both ends |
| `trigger` chunk band | `--c2` | band + trigger name |
| `insert` chunk band | `--c5` | band + label |
| Tracked-piece trail, Predict answer | `--c3` | dotted path, arrowhead |
| Inverse-pair brackets | `--ink-3` | arcs |
| Turn arrows, rim and cycle arrows | `--ink` | arrowheads |
| Cube silhouette hairline | `--ink-3` | line |

- `tests/themes.test.js` checks every `--c*` role at 3:1 against `--sheet` and `--bg` in
  all 15 themes (LaplaceAnalyser's test), plus the sticker checks in D3.
- `kept` desaturation is computed from the sticker colour and the theme's `--sheet`, so
  "kept" looks quieter in every theme.

## 8. Layout

- **Header** (`sd-bar`): wordmark, "by areeb", mode `sd-seg` (Learn / Explore /
  Predict), method `sd-select` (Beginner / CFOP), Notation, View (D8), Keys, Save image,
  the gear, and the hidden offline Light/Dark button.
- **Left panel** on `--sheet`: as in section 6.
- **Stage** over the sky: the dock with Cube, Net and Last layer. Two presets: **Learn**
  (cube large, net and last layer stacked beside it) and **Cube only**.
- **Transport strip** on `--bg`:
  - play/pause, step back and forward, scrub (`sd-range`);
  - speed `sd-seg` (¼×, ½×, 1×, 2×);
  - play this chunk;
  - Mirror and Full colour toggles.
  - No "move 7 of 12": the timeline already marks the position (display rule 1).
- **Phone (below 760 px):** stage on top, panel as a drawer from a menu button (page
  behind made inert, Escape closes), transport pinned to the bottom, dock replaced by
  one column.
- No horizontal scroll at 1440 px or 390 px; checked in the browser test.

## 9. Accessibility and motion

- **Keys.** These turn the cube only while the stage has focus, so typing in the alg box
  never turns it:

  | Keys | Action |
  | --- | --- |
  | `U D L R F B` | turn that face (Shift for prime) |
  | `M E S`, `x y z` | slices and rotations |
  | `Space` | play/pause |
  | `←` / `→` | step back / forward |
  | `[` / `]` | previous / next chunk |

  A Keys dialog lists them with `sd-kbd`.
- **Live region (polite):** one sentence per move about the focus pieces, e.g. "R: the
  white-red edge moves from front-right to down-right." Sentences come from `trace.js`
  and `pieces.js`.
- **Focus and contrast:** visible `--ring` focus everywhere; WCAG 2.2 AA text contrast
  in all 15 themes, from the shared tokens.
- **Turn timing:** a turn lasts $2 \times$ `--dur-3` at 1× (520 ms), divided by the
  speed, read from the computed tokens.
- **Reduced motion:** the OS setting or the shared Animations switch zero `--dur-*`, so
  turns jump with no extra code path.
  - The arrows, outlines, hatching and ghosts of each move stay on screen; only the
    motion is lost.
  - Playing then steps one move per dwell (`js/timing.js`), because pressing Play is an
    explicit request.
- **Step through by default:** playback pauses at every chunk boundary.

## 10. Verification

**`npm test` (Node):**

- Engine and parser (section 5), including parser errors and the formatter round trip.
- Painter's order against a per-pixel depth test (D2).
- Palette contrast (D3, section 7).
- Store and storage fallbacks.
- **Content (brief §4.3), the gate for every algorithm:**
  - Every algorithm parses and round-trips.
  - **Preservation:** applied to a solved cube, a step's algorithm touches only what
    that step may touch.
  - **Goal:** applied to its case, every algorithm reaches the step's goal.
  - **Coverage**, computed:
    - OLL: 216 orientation states, 58 classes modulo `U`, so 57 algorithms must cover
      the 57 non-solved classes exactly once.
    - PLL: 288 permutation states, 22 classes modulo `U` before and after, so 21
      algorithms cover 21 classes once each.
    - F2L: one pair has 150 positions in its slot and the U layer; modulo `U` that is
      $24 + 6 + 6 + 6 = 42$ classes (both pieces in U, corner in slot, edge in slot,
      both in slot), so 41 cases plus solved.
    - I checked all three counts with a throwaway script before writing this.
  - **Mirrors:** each mirrored algorithm equals `mirrorLR` of its partner; F2L diagonal
    pairs equal `mirrorFR`.
  - **Beginner rules:** `(R' D' R D)6 = I`; step 2's 1/3/5 repetitions per white-sticker
    direction; step 4's dot, L and line rules reach the cross; step 5 swaps exactly the
    front and left edges; step 7's two-or-four rule; step 3's pair are mirrors.
  - An algorithm that fails doesn't ship. If a rule the brief states fails, I stop and
    tell you rather than change it.

**`npm run test:browser`** (Playwright 1.56.1, installed with `--no-save`), run offline
and with `DESIGN_DIR=../areeb-ece.github.io/public/design`:

- No script errors, CSP violations or requests outside the page's own files.
- No sideways scroll at 1440 px and 390 px.
- The cube canvas isn't blank.
- Playing a beginner case ends in its goal state, read from the rendered net.
- Keyboard turns work only with the stage focused.
- Reduced motion still shows the arrows.
- Offline fallback works; storage can be missing.

**CI:** LaplaceAnalyser's workflow (unit job; browser job on `ubuntu-24.04` with the apt
cache; a second run against the live `/design/` files).

**By eye:** screenshots in Night, Paper and Console reviewed before each milestone is
called done.

## 11. Milestones (one commit each, tests green at each)

| | Milestone | Done when |
| --- | --- | --- |
| 1 | This plan | your sign-off |
| 2 | Engine, parser, tests; `CLAUDE.md` (adapted, with the display rules verbatim and the sticker exception) | group sanity, parser and algebra tests green |
| 3 | Shell, CSP, design wiring and fallback, layout, static cube and net, palette + contrast test | browser check green offline and with `DESIGN_DIR` |
| 4 | Animation, transport, turn anatomy, notation primer | every primer card plays; reduced motion shows arrows |
| 5 | Roles, piece tracking, ghosts, hatching, net change, last-layer diagram | `R U R'` opens and closes the FR ghost |
| 6 | Timeline, inverse brackets, chunks, automatic annotation, commutator view | the trigger dictionary and conjugate/commutator tests pass |
| 7 | Beginner method, fully authored, with its tests | every beginner rule in section 10 green |
| 8a | Cross and F2L: concepts, 41 cases, mirrors | F2L coverage = 42 |
| 8b | 2-look OLL and PLL | goal and preservation tests |
| 8c | Full OLL and PLL | coverage 57 and 21, exactly once |
| 9 | Explore, Predict, twist ledger | Predict round trip in the browser check |
| 10 | Accessibility pass, Save image (D7), README per `readme-standard` with a screenshot in `docs/images/`, CI | everything in section 10 green; screenshots reviewed |

## 12. Small choices (closest to the existing repos)

- MIT licence; mononoki and its OFL text copied from LaplaceAnalyser's `assets/fonts/`.
- `CLAUDE.md` arrives in milestone 2, not 10, so the rules hold while the code is
  written.
- No footer; the source link sits in the bar, as in the siblings.
- The live region, the Keys dialog and the primer all use the shared `sd-dialog`,
  `sd-kbd` and `sd-callout`; local styles are marked "local".
- `localStorage` keys: `cubetrace.options`, `cubetrace.layout`, `cubetrace.sel`,
  `cubetrace.theme` (offline fallback only).

## 13. Outside this repo (not done without your say-so)

- **Portfolio, after the tool is live** (brief §11): a PR to `areeb-ece.github.io` built
  on `claude/cubetrace-tools-page`:
  - rewrite the notes page from this README, add `banner.webp` and `bannerAlt`, remove
    `draft: true`;
  - list the tool in `CLAUDE.md`, `PRODUCT.md` and `ONBOARDING.md`;
  - update the site counts;
  - run `npm run check`.
- **`public/design/` header comments** say "five sites": seven with this tool. Only with
  your go-ahead.
- **D8's alternative** (a site-options hook in the shared panel) would be a
  `public/design/` change.
- **GitHub:** turn on Pages for `CubeTrace` (`main`, root) once the branch merges.
- No other sibling repo is touched.

## 14. What changed while building

- **Milestones 7 and 8 shipped together** (one PR): the lessons UI is the same panel for
  both methods. The content itself (every algorithm and its tests) landed earlier, as
  soon as the engine could check it.
- **Three F2L algorithms written from memory were wrong**: they duplicated other cases.
  The coverage test named the three missing pair positions, and the standard algorithms
  for those replaced them.
- **Every beginner rule in the brief held**, with one correction to the wording: in
  step 7, `R' D' R D` borrows the middle layer as well as the bottom, so the captions say
  "the lower two layers".
- **Two cases don't start from "the algorithm undone"**: a dot only reaches an L or a
  line in one go, and one corner can't be twisted on its own. These cases name another
  algorithm to start from (`from` in the content).
- **The left/right mirror**, as first written here, said every direction reverses; `x`
  and `M` in fact stay as they are (section 5 is corrected).
- **Stickers are checked against the cube's body**, not against `--card` (D3): kept
  stickers drain toward grey, then 8% toward the theme's sheet; ignored stickers use the
  theme's `--ink-4` as it is. Both are tested in all 15 themes.
- **The back mirror pane slides out to the right**: straight behind the cube it was
  hidden by the cube from the usual camera.
- **A Show chooser** (Explore) applies any step's roles and holding to free moves.
- **Predict waits for "Next"** after each answer, so the right slot (solid) and a wrong
  pick (dashed) can be read; turn arrows are hidden while a question is open.
- **Save image** is PNG or GIF, as D7 recommended; the CSP didn't need `blob:` because
  the preview is drawn on a canvas.
- **Known limitation:** an automatic chunking reads `R U R' D R U' R' D'` as two inserts
  rather than a commutator's halves; the commutator note still shows it as `[X, Y]`.
