const b = {
  connection: "Connection",
  defaults: "Defaults",
  advanced: "Advanced"
}, y = ["connection", "defaults", "advanced"];
function o(a) {
  return String(a ?? "").replace(
    /[&<>"']/g,
    (t) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[t]
  );
}
function p(a, t, e) {
  var r;
  return ((r = a == null ? void 0 : a[t]) == null ? void 0 : r[e]) ?? "";
}
function x(a, t) {
  if (t !== "" && t != null) return t;
  const e = a.default;
  return e == null ? "" : Array.isArray(e) ? e.join(", ") : String(e);
}
function f(a, t) {
  const e = `atp-cfg-${a.key}`, r = a.required ? ' <span class="text-red-600" title="Required">*</span>' : "", s = `
		<label for="${e}" class="block text-xs font-semibold text-gray-700 mb-1">
			${o(a.label)}${r}
		</label>`, n = a.doc ? `<p class="mt-1 text-xs text-gray-500 leading-snug">${o(a.doc)}</p>` : "", i = _(a, t, e);
  return `<div class="mb-3">${s}${i}${n}</div>`;
}
function m(a) {
  return a.type === "string" && a.key.endsWith("_dir");
}
function _(a, t, e) {
  const r = x(a, t), s = "w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  switch (a.type) {
    case "integer":
      return `<input id="${e}" data-atp-field="${a.key}" data-atp-type="integer" type="number" value="${o(r)}" class="${s}">`;
    case "boolean":
      return `<label class="inline-flex items-center gap-2 cursor-pointer">
				<input id="${e}" data-atp-field="${a.key}" data-atp-type="boolean" type="checkbox"${r === !0 || r === "true" ? " checked" : ""} class="cursor-pointer">
				<span class="text-xs text-gray-600">${o(a.doc ?? "")}</span>
			</label>`;
    case "string_list":
      return `<input id="${e}" data-atp-field="${a.key}" data-atp-type="string_list" type="text" value="${o(r)}" placeholder="comma or space separated" class="${s}">`;
    case "string":
    default: {
      const n = a.secret ? "password" : "text";
      return m(a) ? `
					<div class="flex gap-2">
						<input id="${e}" data-atp-field="${a.key}" data-atp-type="string" type="text" value="${o(r)}" class="${s} flex-1" autocomplete="off">
						<button type="button" data-atp-browse="${a.key}" class="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100 whitespace-nowrap transition-colors">📁 Browse…</button>
					</div>
					<div data-atp-picker="${a.key}" class="hidden mt-2 border border-gray-300 rounded bg-white"></div>` : `<input id="${e}" data-atp-field="${a.key}" data-atp-type="string" type="${n}" value="${o(r)}" class="${s}" autocomplete="off">`;
    }
  }
}
function g(a) {
  if (!a)
    return '<div class="p-3 text-xs text-gray-500 italic">Loading…</div>';
  const { path: t, parent: e, entries: r, error: s, drives: n } = a, i = e == null ? " opacity-40 cursor-not-allowed" : "", c = r.length === 0 ? `<li class="px-3 py-2 text-xs text-gray-400 italic">${s ? "" : "(no subdirectories)"}</li>` : r.map(
    (d) => `<li><button type="button" data-atp-picker-nav="${o(d.name)}" class="w-full text-left px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-blue-50 border-none bg-transparent">📁 ${o(d.name)}</button></li>`
  ).join(""), l = s ? `<div class="px-3 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">${o(s)}</div>` : "";
  return `
		${n && n.length > 0 ? `<div class="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
					<span class="text-xs font-semibold text-gray-500 mr-1">Drives:</span>
					${n.map((d) => {
    const h = (t == null ? void 0 : t.toUpperCase().startsWith(d.toUpperCase())) ? " bg-blue-100 border-blue-400 text-blue-800" : " bg-white border-gray-300 text-gray-700";
    return `<button type="button" data-atp-picker-goto="${o(d)}" class="px-2 py-1 text-xs font-mono border rounded cursor-pointer hover:bg-gray-100${h}">${o(d)}</button>`;
  }).join("")}
				</div>` : ""}
		<div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
			<button type="button" data-atp-picker-up class="px-2 py-1 text-xs font-medium border border-gray-300 rounded bg-white cursor-pointer hover:bg-gray-100${i}"${e == null ? " disabled" : ""}>↑ Up</button>
			<button type="button" data-atp-picker-home class="px-2 py-1 text-xs font-medium border border-gray-300 rounded bg-white cursor-pointer hover:bg-gray-100">🏠 Home</button>
			<span class="flex-1 text-xs font-mono text-gray-700 truncate" title="${o(t)}">${o(t)}</span>
		</div>
		${l}
		<ul class="m-0 p-0 list-none max-h-56 overflow-y-auto">${c}</ul>
		<div class="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
			<button type="button" data-atp-picker-select class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border-none rounded cursor-pointer hover:bg-blue-700">Select this folder</button>
			<button type="button" data-atp-picker-cancel class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100">Cancel</button>
		</div>`;
}
function v(a) {
  const t = { connection: [], defaults: [], advanced: [] };
  for (const e of a)
    (t[e.group] ?? t.advanced).push(e);
  return t;
}
function k(a, t, e, r) {
  if (!t.length) return "";
  const s = t.map((n) => f(n, p(e, r, n.key))).join("");
  return a === "advanced" ? `
			<details class="mt-4 border-t border-gray-200 pt-3">
				<summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">${b.advanced}</summary>
				<div class="mt-3">${s}</div>
			</details>` : `
		<section class="mb-4">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">${b[a]}</h3>
			${s}
		</section>`;
}
function $(a, t, e) {
  const r = v(a);
  return y.map((s) => k(s, r[s], t, e)).join("");
}
function w(a, t, e) {
  return !a || a.length === 0 ? "" : `
		<section class="mt-4 border-t border-gray-200 pt-3">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Connection extras</h3>
			${a.map((s) => L(s, t, e)).join("")}
		</section>`;
}
function L(a, t, e) {
  const r = `atp-cfg-extra-${a.key}`, s = p(t, e, a.key), n = s === !0 || s === "true" ? " checked" : "", i = a.doc ? `<p class="mt-1 ml-6 text-xs text-gray-500 leading-snug">${o(a.doc)}</p>` : "";
  return `
		<div class="mb-2">
			<label for="${r}" class="inline-flex items-center gap-2 cursor-pointer">
				<input id="${r}" data-atp-field="${a.key}" data-atp-type="boolean" type="checkbox"${n} class="cursor-pointer">
				<span class="text-xs font-semibold text-gray-700">${o(a.label)}</span>
			</label>
			${i}
		</div>`;
}
function q({ kind: a, message: t }) {
  return `<div class="mb-4 p-3 border rounded text-xs leading-snug ${a === "info" ? "bg-blue-50 text-blue-900 border-blue-200" : "bg-amber-50 text-amber-900 border-amber-200"}">${o(t)}</div>`;
}
function E(a) {
  return a ? a.kind === "ok" ? '<span class="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 border border-green-300">✓ Reachable</span>' : `<div class="space-y-1">
		<span class="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-300">✗ Failed</span>
		<pre class="m-0 mt-1 p-2 bg-gray-900 text-red-300 font-mono text-xs rounded whitespace-pre-wrap">${o(a.message ?? "")}</pre>
	</div>` : '<span class="text-xs text-gray-400">Not verified yet.</span>';
}
class P {
  constructor(t, e, r) {
    this._ctx = e, this._payload = r, this._root = t, this._pickers = {}, this._mount();
  }
  _q(t) {
    return this._root.querySelector(t);
  }
  _mount() {
    this._root.innerHTML = `
			<link rel="stylesheet" href="backend_config_assets.css">
			<div class="font-sans p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 box-border">
				<header class="flex items-end gap-3 mb-4">
					<div class="flex flex-col w-56">
						<label for="atp-cfg-backend" class="text-xs font-semibold text-gray-600 mb-1">Backend</label>
						<select id="atp-cfg-backend" data-atp="backend-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
							${this._renderBackendOptions()}
						</select>
					</div>
				</header>

				<div data-atp="form"></div>

				<footer class="mt-4 flex items-center gap-3">
					<button data-atp="btn-verify" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border-none rounded cursor-pointer hover:bg-blue-700 transition-colors">
						Verify connection
					</button>
					<div data-atp="status" class="flex-1"></div>
				</footer>
			</div>
		`, this._renderForm(), this._renderStatus(), this._bind();
  }
  _renderBackendOptions() {
    const { backend: t, backends: e } = this._payload;
    return e.map(
      ({ key: r, label: s }) => `<option value="${r}"${r === t ? " selected" : ""}>${o(s)}</option>`
    ).join("");
  }
  _renderForm() {
    const { backend: t, values: e, schemas: r, notices: s, ui_extras: n } = this._payload, i = r[t] ?? [], c = s == null ? void 0 : s[t], l = c ? q(c) : "", u = (n == null ? void 0 : n[t]) ?? [];
    this._q('[data-atp="form"]').innerHTML = l + $(i, e, t) + w(u, e, t);
  }
  _renderStatus() {
    const { verify_status: t, backend: e } = this._payload, r = t && t.backend === e ? t : null;
    this._q('[data-atp="status"]').innerHTML = E(r);
  }
  _bind() {
    const t = this._ctx, e = this._root;
    this._q('[data-atp="backend-select"]').addEventListener("change", (r) => {
      this._payload.backend = r.target.value, t.pushEvent("update_backend", { backend: r.target.value }), this._pickers = {}, this._renderForm(), this._renderStatus();
    }), e.addEventListener("input", (r) => this._onFieldInput(r)), e.addEventListener("change", (r) => this._onFieldInput(r)), e.addEventListener("click", (r) => this._onClick(r)), this._q('[data-atp="btn-verify"]').addEventListener("click", () => {
      t.pushEvent("verify", { backend: this._payload.backend });
    }), t.handleEvent("verify_started", () => {
      this._q('[data-atp="status"]').innerHTML = '<span class="text-xs text-gray-500 italic">Verifying…</span>';
    }), t.handleEvent("verify_result", (r) => {
      this._payload.verify_status = r, this._renderStatus();
    }), t.handleEvent("dir_listing", (r) => this._onDirListing(r));
  }
  // ─── Folder picker ───────────────────────────────────────────────────
  _onClick(t) {
    var c;
    const e = t.target.closest("button");
    if (!e) return;
    const r = (c = e.dataset) == null ? void 0 : c.atpBrowse;
    if (r) {
      this._openPicker(r);
      return;
    }
    const s = e.closest("[data-atp-picker]");
    if (!s) return;
    const n = s.dataset.atpPicker, i = this._pickers[n];
    if (e.dataset.atpPickerNav != null) {
      const l = `${(i == null ? void 0 : i.path) ?? ""}/${e.dataset.atpPickerNav}`;
      this._requestListing(n, l);
    } else e.dataset.atpPickerGoto != null ? this._requestListing(n, e.dataset.atpPickerGoto) : e.hasAttribute("data-atp-picker-up") ? i != null && i.parent && this._requestListing(n, i.parent) : e.hasAttribute("data-atp-picker-home") ? this._requestListing(n, "") : e.hasAttribute("data-atp-picker-select") ? i != null && i.path && this._selectPickerPath(n, i.path) : e.hasAttribute("data-atp-picker-cancel") && this._closePicker(n);
  }
  _openPicker(t) {
    const e = this._q(`[data-atp-picker="${t}"]`);
    if (!e) return;
    e.classList.remove("hidden"), this._pickers[t] = null, e.innerHTML = g(null);
    const r = p(this._payload.values, this._payload.backend, t);
    this._requestListing(t, r);
  }
  _closePicker(t) {
    const e = this._q(`[data-atp-picker="${t}"]`);
    e && (e.classList.add("hidden"), e.innerHTML = "", delete this._pickers[t]);
  }
  _requestListing(t, e) {
    this._ctx.pushEvent("list_dir", {
      backend: this._payload.backend,
      key: t,
      path: e ?? ""
    });
  }
  _onDirListing(t) {
    const { backend: e, key: r } = t;
    if (e !== this._payload.backend || !(r in this._pickers)) return;
    this._pickers[r] = t;
    const s = this._q(`[data-atp-picker="${r}"]`);
    s && (s.innerHTML = g(t));
  }
  _selectPickerPath(t, e) {
    const r = this._q(`[data-atp-field="${t}"]`);
    r && (r.value = e, this._writeFieldValue(t, e)), this._closePicker(t);
  }
  _writeFieldValue(t, e) {
    const r = this._payload.backend;
    this._payload.values = this._payload.values ?? {}, this._payload.values[r] = {
      ...this._payload.values[r] ?? {},
      [t]: e
    }, this._ctx.pushEvent("update_value", { backend: r, key: t, value: e });
  }
  _onFieldInput(t) {
    var i;
    const e = t.target, r = (i = e == null ? void 0 : e.dataset) == null ? void 0 : i.atpField;
    if (!r) return;
    const s = e.dataset.atpType === "boolean" ? e.checked : e.value, n = this._payload.backend;
    this._payload.values = this._payload.values ?? {}, this._payload.values[n] = {
      ...this._payload.values[n] ?? {},
      [r]: s
    }, this._ctx.pushEvent("update_value", { backend: n, key: r, value: s });
  }
}
function S(a, t) {
  new P(a.root, a, t);
}
export {
  S as init
};
