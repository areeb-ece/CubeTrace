// The transport strip under the stage: play, step, scrub, speed, play a chunk. Reads
// and writes only the player and the store's play and seq keys.
import { icon } from "./ui.js";

const SPEEDS = [0.25, 0.5, 1, 2];
export const isSpeed = (v) => SPEEDS.includes(v);

export function mountTransport(strip, store, player, { onSpeed, onFull }) {
  const $ = (id) => strip.querySelector("#" + id);
  const btnPlay = $("btnPlay"), btnBack = $("btnBack"), btnFwd = $("btnFwd"), btnChunk = $("btnChunk"), btnFull = $("btnFull"), range = $("timeRange"), seg = $("speedSeg");
  btnBack.append(icon("prev"));
  btnFwd.append(icon("next"));
  btnBack.addEventListener("click", () => player.step(-1));
  btnFwd.addEventListener("click", () => player.step(1));
  btnPlay.addEventListener("click", () => player.toggle());
  btnChunk.addEventListener("click", () => player.playChunk());
  btnFull.addEventListener("click", () => onFull());
  range.addEventListener("input", () => player.seek(Number(range.value)));
  for (const b of seg.querySelectorAll("button")) b.addEventListener("click", () => onSpeed(Number(b.dataset.speed)));

  let shownIcon = "";
  function update(s) {
    const { index, t, playing, speed } = s.play, n = s.seq.n;
    const none = n === 0;
    range.max = String(n);
    range.disabled = none;
    // the position, unless the thumb is being dragged (it already shows it)
    if (document.activeElement !== range || Math.abs(Number(range.value) - (index + t)) > 1e-6) range.value = String(index + t);
    range.setAttribute("aria-valuetext", `${index} of ${n} moves done`);
    btnPlay.disabled = btnChunk.disabled = none;
    const want = playing ? "pause" : "play";
    if (want !== shownIcon) {
      shownIcon = want;
      btnPlay.replaceChildren(icon(want));
      btnPlay.setAttribute("aria-label", playing ? "Pause" : "Play");
      btnPlay.title = playing ? "Pause [Space]" : "Play [Space]";
    }
    btnBack.disabled = none || index + t <= 0;
    btnFwd.disabled = none || index >= n;
    btnFull.setAttribute("aria-pressed", String(!!s.opts.full));
    strip.toggleAttribute("data-busy", !!s.busy);
    for (const b of seg.querySelectorAll("button")) b.setAttribute("aria-checked", String(Number(b.dataset.speed) === speed));
  }
  return { update };
}
