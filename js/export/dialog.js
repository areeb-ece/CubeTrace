// "Save image": which views, how big, which sheet, and whether it is the position now (a
// PNG) or the whole algorithm playing (a GIF). The preview is the picture itself, drawn
// smaller by the same renderer.
import { h, storage, rovingRadios } from "../ui.js";
import { renderFrame, planPicture, frameState, nowState } from "./render.js";
import { histogramOf, buildPalette, GifWriter } from "../lib/gif.js";
import { gifPlan, WIDTHS } from "../lib/picture.js";

const KEY = "cubetrace.image";
const VIEWS = [["cube", "Cube"], ["net", "Net"], ["ll", "Last layer"]];
const DEFAULTS = { views: ["cube", "net"], size: "m", theme: "current", format: "png", transparent: false, title: true };
const tick = () => new Promise((r) => setTimeout(r));

/** The prefs as saved, kept to what exists (a stale or hand-edited entry falls back to the default). */
export function cleanPrefs(raw) {
  const o = raw && typeof raw === "object" ? raw : {}, ids = VIEWS.map((v) => v[0]);
  return {
    views: Array.isArray(o.views) ? ids.filter((id) => o.views.includes(id)) : DEFAULTS.views,
    size: ["s", "m", "l"].includes(o.size) ? o.size : DEFAULTS.size,
    theme: ["current", "dark", "light"].includes(o.theme) ? o.theme : DEFAULTS.theme,
    format: o.format === "gif" ? "gif" : "png",
    transparent: typeof o.transparent === "boolean" ? o.transparent : DEFAULTS.transparent,
    title: typeof o.title === "boolean" ? o.title : DEFAULTS.title,
  };
}

/**
 * store: the app's store. title(): { name, alg } for the title block (what is on screen
 * now: a case and its algorithm, or the moves typed in Explore).
 */
export function createExporter({ store, title }) {
  const prefs = cleanPrefs(storage.get(KEY));
  let dlg = null, busy = null, timer = 0;
  const ui = {};

  const seg = (options, get, set, label) => {
    const el = h("div", { class: "sd-seg", role: "radiogroup", "aria-label": label },
      options.map(([value, text]) => h("button", { type: "button", role: "radio", "data-v": value, on: { click: () => { set(value); changed(); } } }, text)));
    el.sync = () => { for (const b of el.children) b.setAttribute("aria-checked", String(b.dataset.v === get())); };
    el.sync();
    rovingRadios(el);
    return el;
  };
  const check = (label, get, set) => {
    const box = h("input", { type: "checkbox", on: { change: () => { set(box.checked); changed(); } } });
    const el = h("label", { class: "sd-check" }, box, label);
    el.sync = () => { box.checked = get(); };
    el.box = box;
    return el;
  };
  const group = (name, ...kids) => h("fieldset", { class: "sd-fieldset" }, h("legend", { text: name }), ...kids);

  const spec = (width) => ({
    views: VIEWS.map((v) => v[0]).filter((id) => prefs.views.includes(id)), theme: prefs.theme, transparent: prefs.transparent,
    title: prefs.title ? title() : null, width: width ?? WIDTHS[prefs.format][prefs.size],
  });
  const slug = () => {
    const t = title(), text = (t.name || t.alg || "").toLowerCase().replace(/'/g, "p").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return "cube-trace" + (text ? "-" + text : "");
  };

  function build() {
    ui.views = VIEWS.map(([id, name]) => check(name,
      () => prefs.views.includes(id), (on) => { prefs.views = on ? prefs.views.concat(id) : prefs.views.filter((v) => v !== id); }));
    ui.format = seg([["png", "PNG"], ["gif", "GIF"]], () => prefs.format, (v) => (prefs.format = v), "Format");
    ui.formatNote = h("p", { class: "sd-hint", id: "exFormat" });
    ui.size = seg([["s", "S"], ["m", "M"], ["l", "L"]], () => prefs.size, (v) => (prefs.size = v), "Size");
    ui.theme = seg([["current", "This theme"], ["dark", "Night"], ["light", "Paper"]], () => prefs.theme, (v) => (prefs.theme = v), "Sheet");
    ui.transparent = check("See-through background", () => prefs.transparent, (on) => (prefs.transparent = on));
    ui.title = check("Title block", () => prefs.title, (on) => (prefs.title = on));
    ui.canvas = h("canvas", { class: "ex-canvas", role: "img", "aria-label": "Preview of the picture" });
    ui.frame = h("div", { class: "ex-frame" }, ui.canvas);
    ui.note = h("p", { class: "sd-hint", id: "exNote" });
    ui.status = h("p", { class: "ex-status", role: "status", "aria-live": "polite" });
    ui.progress = h("progress", { max: 1, value: 0, hidden: true, "aria-label": "Making the GIF" });
    ui.save = h("button", { class: "sd-btn sd-primary", type: "button", on: { click: () => save() } }, "Save");
    ui.stop = h("button", { class: "sd-btn", type: "button", hidden: true, on: { click: () => { if (busy) busy.stop = true; } } }, "Stop");
    dlg = h("dialog", { class: "sd-dialog export", "aria-labelledby": "exTitle" },
      h("header", null, h("h2", { id: "exTitle", text: "Save image" }), h("button", { class: "sd-x", type: "button", "aria-label": "Close", on: { click: () => dlg.close() } }, "×")),
      h("div", { class: "sd-body ex-grid" },
        h("div", { class: "ex-opts" },
          group("Views", ...ui.views),
          group("Format", ui.format, ui.formatNote),
          group("Size", ui.size),
          group("Sheet", ui.theme, ui.transparent),
          group("Show", ui.title)),
        h("div", { class: "ex-side" }, ui.frame, ui.note)),
      h("footer", null, ui.progress, ui.status, ui.stop, ui.save));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { if (busy) busy.stop = true; });
    dlg.addEventListener("cancel", (e) => { if (busy) { busy.stop = true; e.preventDefault(); } }); // Escape stops a GIF in the making first
    document.body.append(dlg);
  }

  const none = () => !spec().views.length;
  function sync() {
    for (const el of [...ui.views, ui.format, ui.size, ui.theme, ui.transparent, ui.title]) el.sync();
    ui.formatNote.textContent = prefs.format === "gif" ? "The whole algorithm playing, move by move." : "The position on screen now.";
    ui.save.textContent = prefs.format === "gif" ? "Save GIF" : "Save PNG";
    ui.save.setAttribute("aria-disabled", String(none() || !!busy));
    ui.save.title = none() ? "Tick at least one view" : "";
    ui.frame.toggleAttribute("data-clear", prefs.transparent);
    const t = ui.title.box;
    t.disabled = !title().name && !title().alg;
    ui.title.title = t.disabled ? "There are no moves to write" : "";
  }
  function changed() {
    storage.set(KEY, prefs);
    sync();
    clearTimeout(timer);
    timer = setTimeout(preview, 60);
  }
  // The preview is the picture, drawn smaller. A GIF is previewed halfway through its first move.
  const at = () => {
    const s = store.state;
    if (prefs.format === "png" || !s.seq.n) return nowState(s);
    return frameState(s, 0, 0.5);
  };
  function preview() {
    if (busy || !dlg.open) return;
    if (none()) { ui.canvas.width = ui.canvas.width; ui.note.textContent = "Tick at least one view."; return; }
    const sp = spec(Math.min(900, Math.max(320, Math.round(ui.frame.clientWidth * (devicePixelRatio || 1)))));
    const s = at(), plan = planPicture(ui.canvas, sp, s);
    renderFrame(ui.canvas, sp, s, plan);
    const real = planPicture(document.createElement("canvas"), spec(), s);
    ui.note.textContent = `${real.width.toLocaleString()} × ${real.height.toLocaleString()} px`;
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = h("a", { href: url, download: name });
    dlg.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const say = (text) => { ui.status.textContent = text; };

  async function save() {
    if (none() || busy) return;
    busy = { stop: false };
    ui.progress.hidden = ui.stop.hidden = prefs.format !== "gif";
    ui.progress.value = 0;
    say("");
    sync();
    try {
      const name = slug(), sp = spec(), canvas = document.createElement("canvas");
      if (prefs.format === "png") {
        renderFrame(canvas, sp, nowState(store.state));
        const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
        download(blob, name + ".png");
        say(`Saved ${name}.png`);
      } else {
        const bytes = await gif(canvas, sp, busy);
        if (!bytes) say("Stopped. Nothing was saved.");
        else { download(new Blob([bytes], { type: "image/gif" }), name + ".gif"); say(`Saved ${name}.gif (${(bytes.length / 1048576).toFixed(1)} MB)`); }
      }
    } catch (e) { say("That didn't work: " + e.message); }
    busy = null;
    ui.progress.hidden = ui.stop.hidden = true;
    sync();
    preview();
  }

  // The algorithm from its first position to its last: a few frames a turn, a hold at each end.
  async function gif(canvas, sp, job) {
    const s = store.state, plan = gifPlan(s.seq.n), shape = planPicture(canvas, sp, s);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = () => ctx.getImageData(0, 0, shape.width, shape.height).data;
    const frameAt = (f) => renderFrame(canvas, sp, frameState(s, f.index, f.t), shape);
    // choose the colours from a few frames spread across the clip
    const probes = Math.min(plan.length, 8);
    let hist;
    for (let i = 0; i < probes; i++) {
      frameAt(plan[Math.round((i * (plan.length - 1)) / Math.max(1, probes - 1))]);
      hist = histogramOf([pixels()], hist);
      await tick();
      if (job.stop) return null;
    }
    const out = new GifWriter(shape.width, shape.height, buildPalette(hist, 255), { loop: true, transparent: sp.transparent, dither: false });
    for (let k = 0; k < plan.length; k++) {
      frameAt(plan[k]);
      out.addFrame(pixels(), { delay: plan[k].delay });
      ui.progress.value = (k + 1) / plan.length;
      await tick();
      if (job.stop) return null;
    }
    return out.finish();
  }

  return {
    open() {
      if (!dlg) build();
      say("");
      dlg.showModal();
      sync();
      preview();
    },
    get dialog() { return dlg; },
  };
}
