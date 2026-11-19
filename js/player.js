// Playback over the moves in the moves box. The one place that knows where the cube is
// in time: pos = index + t, with index moves done and t how far through moves[index].
//
// Published to the store:
//   play   { index, t, playing, speed }
//   seq    { n, chunks }                      (the moves' length and their chunks)
//   start  the cube the moves are played from (the role set's holding); trace its states
//   state  the cube the net shows: the state at the start of the move being turned
//   shown  { state, turn }                    what the 3D cube draws (turn: { move, t } or null)
//   guide  { move, t, faint } or null         the turn anatomy to draw (faint: the next move, paused)
// Typing sets the moves and shows the end state, paused. Stepping back animates the
// inverse of the move before. With motion off (--dur-3 is 0) turns jump, and the guides
// of the move just made stay up for a dwell instead.
import { trace } from "./lib/trace.js";
import { inverseMove } from "./lib/moves.js";
import { autoChunks } from "./lib/structure.js";
import { turnMs, dwellMs, tween, boundaries, nextStop, prevStop } from "./timing.js";
import { roles } from "./lib/roles.js";
import { announce, describeMove, describeMoved } from "./announce.js";

const EPS = 1e-9;

export function createPlayer(store) {
  let moves = [], tr = store.state.trace, chunks = [], stops = [0];
  let cancel = null, aim = 0, holdTimer = 0, hold = null, dir = 1;
  const play = () => store.state.play;
  const n = () => moves.length;
  const pos = () => play().index + play().t;

  function publish() {
    const { index, t, playing } = play();
    let guide = null, net = tr.states[index];
    if (t > 0) {
      if (dir < 0) { net = tr.states[index + 1]; guide = { move: inverseMove(moves[index]), t: 1 - t, faint: false }; }
      else guide = { move: moves[index], t, faint: false };
    } else if (hold) guide = { move: hold, t: 0, faint: false };
    else if (index < n()) guide = { move: moves[index], t: 0, faint: !playing && !cancel };
    if (store.state.state !== net) store.set("state", net);
    store.set("shown", { state: tr.states[index], turn: t > 0 ? { move: moves[index], t } : null });
    store.set("guide", guide);
    store.set("busy", !!(cancel || playing || holdTimer));
  }
  function setPos(p) {
    p = Math.min(n(), Math.max(0, p));
    let index = Math.min(n(), Math.floor(p + EPS));
    const t = index >= n() ? 0 : Math.max(0, p - index);
    store.patch("play", { index, t: t < EPS ? 0 : t });
    publish();
  }
  function clearHold() { clearTimeout(holdTimer); holdTimer = 0; hold = null; }
  // stops any turn in flight; snap: finish it at once instead of leaving it partway
  function halt(snap) {
    if (cancel) { cancel(); cancel = null; if (snap) setPos(aim); }
    clearHold();
  }
  // The move, then what it did to the pieces that matter (index i of the trace's steps; back: undone)
  const say = (m, i, back) => {
    const changes = (tr.steps[i] || []).map((c) => (back ? { ...c, from: c.to, to: c.from } : c));
    announce(describeMove(m) + describeMoved(changes, roles(store.state.opts.roleSet)));
  };

  // Move to integer index `target` (one move away): animated, or a jump that holds the guides.
  function glide(target, done) {
    halt(true);
    const from = pos(), d = target - from, ms = turnMs(play().speed) * Math.abs(d);
    if (Math.abs(d) < EPS) { done?.(); return; }
    dir = d < 0 ? -1 : 1;
    const back = dir < 0, made = back ? inverseMove(moves[target]) : moves[target - 1];
    if (!ms) {
      setPos(target);
      hold = made;
      say(made, back ? target : target - 1, back);
      holdTimer = setTimeout(() => { holdTimer = 0; hold = null; publish(); done?.(); }, dwellMs(play().speed));
      publish();
      return;
    }
    aim = target;
    cancel = tween(ms, (e) => setPos(from + d * e), () => {
      cancel = null;
      setPos(target);
      say(made, back ? target : target - 1, back);
      done?.();
    });
    publish();
  }

  function runTo(stop) {
    const next = () => {
      if (!play().playing) return;
      if (play().index >= stop) { pause(); return; }
      glide(play().index + 1, next);
    };
    next();
  }
  function pause() {
    if (play().playing) store.patch("play", { playing: false });
    publish();
  }

  const api = {
    /** New moves from the moves box: show the end state, paused. */
    setMoves(list) {
      halt(false);
      moves = list;
      tr = trace(store.state.start, moves);
      store.set("trace", tr);
      chunks = autoChunks(moves);
      stops = boundaries(chunks, n());
      store.set("seq", { n: n(), chunks });
      store.patch("play", { index: n(), t: 0, playing: false });
      publish();
    },
    /** Play the same moves from another cube (a different holding), staying where we are in them. */
    setStart(start) {
      halt(true);
      store.set("start", start);
      tr = trace(start, moves);
      store.set("trace", tr);
      store.set("state", tr.states[play().index]);
      publish();
    },
    /** Moves with one more on the end: stay at the old end, then turn the new move. */
    append(list) {
      const was = n();
      api.setMoves(list);
      setPos(was);
      glide(was + 1);
    },
    play() {
      if (!n()) return;
      halt(true);
      if (play().index >= n()) setPos(0);
      store.patch("play", { playing: true });
      runTo(nextStop(stops, play().index));
    },
    pause,
    toggle() { play().playing ? pause() : api.play(); },
    /** Play on to the end of the chunk holding the current move (the last chunk again at the end). */
    playChunk() {
      if (!n()) return;
      halt(true);
      if (play().index >= n()) setPos(chunks.length ? chunks.at(-1).start : 0);
      const i = play().index, c = chunks.find((c) => c.start <= i && i < c.end);
      store.patch("play", { playing: true });
      runTo(c ? c.end : nextStop(stops, i));
    },
    step(d) {
      halt(true);
      pause();
      const p = pos();
      const target = d > 0 ? Math.floor(p + EPS) + 1 : Math.ceil(p - EPS) - 1;
      if (target < 0 || target > n()) return;
      glide(target);
    },
    /** Jump to index i (or a fractional position: a turn partway). */
    seek(p) {
      halt(false);
      dir = p >= pos() ? 1 : -1;
      store.patch("play", { playing: false });
      setPos(p);
    },
    prevStop() { api.seek(prevStop(stops, Math.ceil(pos() - EPS))); },
    nextStop() { api.seek(nextStop(stops, Math.floor(pos() + EPS))); },
    setSpeed(v) { store.patch("play", { speed: v }); },
    get length() { return n(); },
  };
  return api;
}
