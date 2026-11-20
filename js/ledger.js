// The twist ledger panel (PLAN.md section 6): each top-layer corner's twist in thirds of a
// turn, the total of those four and the total of the four under them. The sum comes from
// lib/ledger.js; this only lays it out as an sd-table.
import { h } from "./ui.js";
import { twistLedger } from "./lib/ledger.js";

const MINUS = "−";
const text = (n) => (n > 0 ? "+1" : n < 0 ? MINUS + "1" : "0");

export function mountLedger() {
  const rows = [0, 1, 2, 3].map(() => ({ name: h("th", { scope: "row" }), val: h("td", { class: "sd-num" }) }));
  const top = { name: h("th", { scope: "row", text: "Top corners: total" }), val: h("td", { class: "sd-num" }) };
  const lower = { name: h("th", { scope: "row", text: "Lower corners: total" }), val: h("td", { class: "sd-num" }) };
  const tr = (r) => h("tr", null, r.name, r.val);
  const el = h("section", { class: "ledger", id: "ledger", "aria-labelledby": "ledgerTitle", hidden: true },
    h("h3", { id: "ledgerTitle", text: "Twist ledger" }),
    h("table", { class: "sd-table" },
      h("caption", { text: "Each top corner's twist in thirds of a turn: +1 clockwise, " + MINUS + "1 anticlockwise." }),
      h("thead", null, h("tr", null, h("th", { scope: "col", text: "Corner" }), h("th", { scope: "col", class: "sd-num", text: "Twist" }))),
      h("tbody", null, rows.map(tr)),
      h("tfoot", null, tr(top), tr(lower))),
    h("p", { class: "sd-hint", text: "Both totals together are always 0 mod 3, so a twist up here is paid for below: the lower layers look broken until every corner is done." }));
  let last = null;
  const put = (cell, n) => { cell.val.textContent = text(n); cell.val.dataset.twist = String(n); };
  return {
    el,
    /** Fill the table for `state` held as `holding`, only when one of them changed. */
    update(state, holding) {
      if (last && last.state === state && last.holding === holding) return;
      last = { state, holding };
      const l = twistLedger(state, holding);
      l.corners.forEach((c, i) => { rows[i].name.textContent = c.name; put(rows[i], c.twist); });
      put(top, l.top);
      put(lower, l.lower);
    },
  };
}
