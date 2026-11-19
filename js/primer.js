// The notation primer: a dialog of cards, each with a small cube that plays the move
// (with the same turn anatomy and timing as the main cube).
import { h } from "./ui.js";
import { solved, applyMoves } from "./lib/cube.js";
import { parseMoves } from "./lib/notation.js";
import { moveText } from "./lib/moves.js";
import { DEFAULT_CAMERA } from "./lib/scene.js";
import { paintCube } from "./views/cube.js";
import { mountCanvas } from "./views/canvas.js";
import { turnMs, tween } from "./timing.js";

const deg = (v) => (v * Math.PI) / 180;
// A camera that shows the side a move turns: the default sees U F R; the mirrored one U F L;
// from behind sees U B R; from below sees D F R.
const CAMS = {
  front: DEFAULT_CAMERA,
  left: { ...DEFAULT_CAMERA, yaw: -DEFAULT_CAMERA.yaw },
  back: { ...DEFAULT_CAMERA, yaw: deg(148) },
  below: { ...DEFAULT_CAMERA, pitch: -DEFAULT_CAMERA.pitch },
};
const group = (name, cam) => ({ name, cam, moves: parseMoves(`${name} ${name}' ${name}2`) });

const CARDS = [
  { title: "Pieces, not stickers", text: "A cube is 8 corners, 12 edges and 6 centres. The centres never move relative to each other. A piece keeps its stickers together, so a turn carries whole pieces." },
  { title: "U: up", text: "U turns the up face clockwise, seen from above. U' turns it back; U2 turns it twice.", groups: [group("U", "front")] },
  { title: "D: down", text: "D turns the down face clockwise, seen from below, so from the front it looks the other way. D' back; D2 twice.", groups: [group("D", "below")] },
  { title: "L: left", text: "L turns the left face clockwise, seen from the left, so from the front it looks the other way. L' back; L2 twice.", groups: [group("L", "left")] },
  { title: "R: right", text: "R turns the right face clockwise, seen from the right. R' turns it back; R2 turns it twice.", groups: [group("R", "front")] },
  { title: "F: front", text: "F turns the front face clockwise, seen from the front. F' turns it back; F2 turns it twice.", groups: [group("F", "front")] },
  { title: "B: back", text: "B turns the back face clockwise, seen from behind, so from the front it looks the other way. B' back; B2 twice.", groups: [group("B", "back")] },
  { title: "Slices: M E S", text: "The middle layers. M follows L, E follows D, S follows F: each turns the way that face does.", groups: [group("M", "left"), group("E", "below"), group("S", "front")] },
  { title: "Wide: r = Rw", text: "A lower-case face, or w after a capital, turns two layers: the face and the middle slice beside it. r is Rw; l, u, d, f, b work the same way.", groups: [group("r", "front")] },
  { title: "Rotations: x y z", text: "These turn the whole cube. x follows R, y follows U, z follows F.", groups: [group("x", "front"), group("y", "front"), group("z", "front")] },
];

function card(c, store) {
  const el = h("section", { class: "pcard" }, h("h3", { text: c.title }));
  const text = h("p", { text: c.text });
  if (!c.groups) { el.append(text); return el; }
  // this card's own little scene: a solved cube with the first move's guides, until one plays
  const scene = { state: solved(), turn: null, guide: null, cam: CAMS[c.groups[0].cam] };
  const idle = () => { scene.state = solved(); scene.turn = null; scene.guide = { move: c.groups[0].moves[0], t: 0, faint: false }; };
  idle();
  const box = h("div", { class: "pcube" });
  const fake = { state: scene };
  const view = mountCanvas(box, fake, (g, s) => paintCube(g, s.state, { camera: s.cam, turn: s.turn, guide: s.guide }), `${c.title}: a cube that plays the move`);
  let cancel = null, timer = 0;
  const play = (g, m) => {
    cancel?.(); clearTimeout(timer);
    scene.cam = CAMS[g.cam];
    scene.state = solved();
    scene.turn = null;
    const end = applyMoves(solved(), [m]), ms = turnMs(store.state.play.speed);
    const rest = () => { scene.state = end; scene.turn = null; scene.guide = { move: m, t: 0, faint: false }; view.draw(); };
    if (!ms) { rest(); return; }
    scene.guide = { move: m, t: 0, faint: false };
    cancel = tween(ms, (e) => { scene.turn = { move: m, t: e }; scene.guide = { move: m, t: e, faint: false }; view.draw(); }, () => { cancel = null; rest(); });
    view.draw();
  };
  const rows = c.groups.map((g) => h("div", { class: "prow", role: "group", "aria-label": `Play ${g.name}` },
    g.moves.map((m) => h("button", { class: "sd-btn sd-small sd-mono", type: "button", text: moveText(m), on: { click: () => { play(g, m); } } }))));
  el.append(box, h("div", { class: "pplay" }, rows), text); // cubes first, so they line up across cards
  el.redraw = () => view.draw();
  return el;
}

/** Fills the dialog on first open; the cards' cubes are drawn once it is visible. */
export function mountPrimer(dialog, store, { onOpen }) {
  const body = dialog.querySelector(".sd-body");
  let cards = null;
  const open = () => {
    if (!cards) { cards = CARDS.map((c) => card(c, store)); body.append(...cards); }
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => cards.forEach((c) => c.redraw?.()));
    onOpen?.();
  };
  return { open };
}
