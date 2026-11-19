// The cube panel's keys (PLAN.md section 9). They act only while the panel has focus,
// so typing in the moves box never turns the cube.
const TURNS = { KeyU: "U", KeyD: "D", KeyL: "L", KeyR: "R", KeyF: "F", KeyB: "B", KeyM: "M", KeyE: "E", KeyS: "S", KeyX: "x", KeyY: "y", KeyZ: "z" };

/** The move a key press writes ("R", "R'", "x'"), or null. Shift is the prime. */
export const moveForKey = (e) => (TURNS[e.code] ? TURNS[e.code] + (e.shiftKey ? "'" : "") : null);

/** Calls the handlers for the keys pressed on el; ignores keys aimed at fields and buttons. */
export function mountKeys(el, { turn, player }) {
  el.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target !== el) return;
    const mv = moveForKey(e);
    if (mv) { turn(mv); e.preventDefault(); return; }
    if (e.code === "Space") player.toggle();
    else if (e.key === "ArrowLeft" && !e.shiftKey) player.step(-1);
    else if (e.key === "ArrowRight" && !e.shiftKey) player.step(1);
    else if (e.key === "[") player.prevStop();
    else if (e.key === "]") player.nextStop();
    else return;
    e.preventDefault();
  });
}
