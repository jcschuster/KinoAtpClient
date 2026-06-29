const g = {
  connection: "Connection",
  defaults: "Defaults",
  advanced: "Advanced"
}, k = ["connection", "defaults", "advanced"];
function c(a) {
  return String(a ?? "").replace(
    /[&<>"']/g,
    (e) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[e]
  );
}
function b(a, e, t) {
  var r;
  return ((r = a == null ? void 0 : a[e]) == null ? void 0 : r[t]) ?? "";
}
function v(a, e) {
  if (e !== "" && e != null) return e;
  const t = a.default;
  return t == null ? "" : Array.isArray(t) ? t.join(", ") : String(t);
}
function $(a, e, t) {
  const r = `atp-cfg-${a.key}`, n = a.required ? ' <span class="text-red-600" title="Required">*</span>' : "", s = `
		<label for="${r}" class="block text-xs font-semibold text-gray-700 mb-1">
			${c(a.label)}${n}
		</label>`, o = a.doc ? `<p class="mt-1 text-xs text-gray-500 leading-snug">${c(a.doc)}</p>` : "", i = L(a, e, r, t);
  return `<div class="mb-3">${s}${i}${o}</div>`;
}
function w(a, e, t) {
  return a.type !== "string" ? null : ((t == null ? void 0 : t[e]) ?? []).includes(a.key) ? "file" : a.key.endsWith("_dir") ? "dir" : null;
}
function L(a, e, t, r) {
  const n = v(a, e), s = "w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  switch (a.type) {
    case "integer":
      return `<input id="${t}" data-atp-field="${a.key}" data-atp-type="integer" type="number" value="${c(n)}" class="${s}">`;
    case "boolean":
      return `<label class="inline-flex items-center gap-2 cursor-pointer">
				<input id="${t}" data-atp-field="${a.key}" data-atp-type="boolean" type="checkbox"${n === !0 || n === "true" ? " checked" : ""} class="cursor-pointer">
				<span class="text-xs text-gray-600">${c(a.doc ?? "")}</span>
			</label>`;
    case "string_list":
      return `<input id="${t}" data-atp-field="${a.key}" data-atp-type="string_list" type="text" value="${c(n)}" placeholder="comma or space separated" class="${s}">`;
    case "string":
    default: {
      const o = a.secret ? "password" : "text";
      if (r) {
        const i = r === "file" ? "📄" : "📁";
        return `
					<div class="flex gap-2">
						<input id="${t}" data-atp-field="${a.key}" data-atp-type="string" type="text" value="${c(n)}" class="${s} flex-1" autocomplete="off">
						<button type="button" data-atp-browse="${a.key}" data-atp-browse-mode="${r}" class="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100 whitespace-nowrap transition-colors">${i} Browse…</button>
					</div>
					<div data-atp-picker="${a.key}" class="hidden mt-2 border border-gray-300 rounded bg-white"></div>`;
      }
      return `<input id="${t}" data-atp-field="${a.key}" data-atp-type="string" type="${o}" value="${c(n)}" class="${s}" autocomplete="off">`;
    }
  }
}
function y(a, e) {
  if (!a)
    return '<div class="p-3 text-xs text-gray-500 italic">Loading…</div>';
  const { path: t, parent: r, entries: n, error: s, drives: o } = a, i = r == null ? " opacity-40 cursor-not-allowed" : "", d = e === "file", p = d ? n : n.filter((l) => l.type !== "file"), u = d ? "(empty directory)" : "(no subdirectories)", h = p.length === 0 ? `<li class="px-3 py-2 text-xs text-gray-400 italic">${s ? "" : u}</li>` : p.map((l) => E(l)).join(""), x = s ? `<div class="px-3 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">${c(s)}</div>` : "", f = o && o.length > 0 ? `<div class="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
					<span class="text-xs font-semibold text-gray-500 mr-1">Drives:</span>
					${o.map((l) => {
    const _ = (t == null ? void 0 : t.toUpperCase().startsWith(l.toUpperCase())) ? " bg-blue-100 border-blue-400 text-blue-800" : " bg-white border-gray-300 text-gray-700";
    return `<button type="button" data-atp-picker-goto="${c(l)}" class="px-2 py-1 text-xs font-mono border rounded cursor-pointer hover:bg-gray-100${_}">${c(l)}</button>`;
  }).join("")}
				</div>` : "", m = d ? `<div class="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
				<span class="flex-1 text-xs text-gray-500 italic">Click a file to select it.</span>
				<button type="button" data-atp-picker-cancel class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100">Cancel</button>
			</div>` : `<div class="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
				<button type="button" data-atp-picker-select class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border-none rounded cursor-pointer hover:bg-blue-700">Select this folder</button>
				<button type="button" data-atp-picker-cancel class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100">Cancel</button>
			</div>`;
  return `
		${f}
		<div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
			<button type="button" data-atp-picker-up class="px-2 py-1 text-xs font-medium border border-gray-300 rounded bg-white cursor-pointer hover:bg-gray-100${i}"${r == null ? " disabled" : ""}>↑ Up</button>
			<button type="button" data-atp-picker-home class="px-2 py-1 text-xs font-medium border border-gray-300 rounded bg-white cursor-pointer hover:bg-gray-100">🏠 Home</button>
			<span class="flex-1 text-xs font-mono text-gray-700 truncate" title="${c(t)}">${c(t)}</span>
		</div>
		${x}
		<ul class="m-0 p-0 list-none max-h-56 overflow-y-auto">${h}</ul>
		${m}`;
}
function E(a) {
  const e = a.type === "file", t = e ? "📄" : "📁";
  return `<li><button type="button" ${e ? "data-atp-picker-file" : "data-atp-picker-nav"}="${c(a.name)}" class="w-full text-left px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-blue-50 border-none bg-transparent">${t} ${c(a.name)}</button></li>`;
}
function P(a) {
  const e = { connection: [], defaults: [], advanced: [] };
  for (const t of a)
    (e[t.group] ?? e.advanced).push(t);
  return e;
}
function q(a, e, t, r, n) {
  if (!e.length) return "";
  const s = e.map(
    (o) => $(
      o,
      b(t, r, o.key),
      w(o, r, n)
    )
  ).join("");
  return a === "advanced" ? `
			<details class="mt-4 border-t border-gray-200 pt-3">
				<summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">${g.advanced}</summary>
				<div class="mt-3">${s}</div>
			</details>` : `
		<section class="mb-4">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">${g[a]}</h3>
			${s}
		</section>`;
}
function F(a, e, t, r) {
  const n = P(a);
  return k.map(
    (s) => q(s, n[s], e, t, r)
  ).join("");
}
function C(a, e, t) {
  return !a || a.length === 0 ? "" : `
		<section class="mt-4 border-t border-gray-200 pt-3">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Connection extras</h3>
			${a.map((n) => S(n, e, t)).join("")}
		</section>`;
}
function S(a, e, t) {
  const r = `atp-cfg-extra-${a.key}`, n = b(e, t, a.key), s = n === !0 || n === "true" ? " checked" : "", o = a.doc ? `<p class="mt-1 ml-6 text-xs text-gray-500 leading-snug">${c(a.doc)}</p>` : "";
  return `
		<div class="mb-2">
			<label for="${r}" class="inline-flex items-center gap-2 cursor-pointer">
				<input id="${r}" data-atp-field="${a.key}" data-atp-type="boolean" type="checkbox"${s} class="cursor-pointer">
				<span class="text-xs font-semibold text-gray-700">${c(a.label)}</span>
			</label>
			${o}
		</div>`;
}
function B({ kind: a, message: e }) {
  return `<div class="mb-4 p-3 border rounded text-xs leading-snug ${a === "info" ? "bg-blue-50 text-blue-900 border-blue-200" : "bg-amber-50 text-amber-900 border-amber-200"}">${c(e)}</div>`;
}
function H(a) {
  return a ? a.kind === "ok" ? '<span class="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 border border-green-300">✓ Reachable</span>' : `<div class="space-y-1">
		<span class="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-300">✗ Failed</span>
		<pre class="m-0 mt-1 p-2 bg-gray-900 text-red-300 font-mono text-xs rounded whitespace-pre-wrap">${c(a.message ?? "")}</pre>
	</div>` : '<span class="text-xs text-gray-400">Not verified yet.</span>';
}
class T {
  constructor(e, t, r) {
    this._ctx = t, this._payload = r, this._root = e, this._pickers = {}, this._mount();
  }
  _q(e) {
    return this._root.querySelector(e);
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
    const { backend: e, backends: t } = this._payload;
    return t.map(
      ({ key: r, label: n }) => `<option value="${r}"${r === e ? " selected" : ""}>${c(n)}</option>`
    ).join("");
  }
  _renderForm() {
    const { backend: e, values: t, schemas: r, notices: n, ui_extras: s, file_fields: o } = this._payload, i = r[e] ?? [], d = n == null ? void 0 : n[e], p = d ? B(d) : "", u = (s == null ? void 0 : s[e]) ?? [];
    this._q('[data-atp="form"]').innerHTML = p + F(i, t, e, o) + C(u, t, e);
  }
  _renderStatus() {
    const { verify_status: e, backend: t } = this._payload, r = e && e.backend === t ? e : null;
    this._q('[data-atp="status"]').innerHTML = H(r);
  }
  _bind() {
    const e = this._ctx, t = this._root;
    this._q('[data-atp="backend-select"]').addEventListener("change", (r) => {
      this._payload.backend = r.target.value, e.pushEvent("update_backend", { backend: r.target.value }), this._pickers = {}, this._renderForm(), this._renderStatus();
    }), t.addEventListener("input", (r) => this._onFieldInput(r)), t.addEventListener("change", (r) => this._onFieldInput(r)), t.addEventListener("click", (r) => this._onClick(r)), this._q('[data-atp="btn-verify"]').addEventListener("click", () => {
      e.pushEvent("verify", { backend: this._payload.backend });
    }), e.handleEvent("verify_started", () => {
      this._q('[data-atp="status"]').innerHTML = '<span class="text-xs text-gray-500 italic">Verifying…</span>';
    }), e.handleEvent("verify_result", (r) => {
      this._payload.verify_status = r, this._renderStatus();
    }), e.handleEvent("dir_listing", (r) => this._onDirListing(r));
  }
  // ─── Folder picker ───────────────────────────────────────────────────
  _onClick(e) {
    var d;
    const t = e.target.closest("button");
    if (!t) return;
    const r = (d = t.dataset) == null ? void 0 : d.atpBrowse;
    if (r) {
      this._openPicker(r, t.dataset.atpBrowseMode || "dir");
      return;
    }
    const n = t.closest("[data-atp-picker]");
    if (!n) return;
    const s = n.dataset.atpPicker, o = this._pickers[s], i = o == null ? void 0 : o.state;
    if (t.dataset.atpPickerNav != null) {
      const p = `${(i == null ? void 0 : i.path) ?? ""}/${t.dataset.atpPickerNav}`;
      this._requestListing(s, p);
    } else t.dataset.atpPickerFile != null ? i != null && i.path && this._selectPickerPath(s, `${i.path}/${t.dataset.atpPickerFile}`) : t.dataset.atpPickerGoto != null ? this._requestListing(s, t.dataset.atpPickerGoto) : t.hasAttribute("data-atp-picker-up") ? i != null && i.parent && this._requestListing(s, i.parent) : t.hasAttribute("data-atp-picker-home") ? this._requestListing(s, "") : t.hasAttribute("data-atp-picker-select") ? i != null && i.path && this._selectPickerPath(s, i.path) : t.hasAttribute("data-atp-picker-cancel") && this._closePicker(s);
  }
  _openPicker(e, t) {
    const r = this._q(`[data-atp-picker="${e}"]`);
    if (!r) return;
    r.classList.remove("hidden"), this._pickers[e] = { mode: t, state: null }, r.innerHTML = y(null, t);
    const n = b(this._payload.values, this._payload.backend, e);
    this._requestListing(e, n);
  }
  _closePicker(e) {
    const t = this._q(`[data-atp-picker="${e}"]`);
    t && (t.classList.add("hidden"), t.innerHTML = "", delete this._pickers[e]);
  }
  _requestListing(e, t) {
    this._ctx.pushEvent("list_dir", {
      backend: this._payload.backend,
      key: e,
      path: t ?? ""
    });
  }
  _onDirListing(e) {
    const { backend: t, key: r } = e;
    if (t !== this._payload.backend || !(r in this._pickers)) return;
    const n = this._pickers[r] ?? { mode: "dir" };
    this._pickers[r] = { mode: n.mode, state: e };
    const s = this._q(`[data-atp-picker="${r}"]`);
    s && (s.innerHTML = y(e, n.mode));
  }
  _selectPickerPath(e, t) {
    const r = this._q(`[data-atp-field="${e}"]`);
    r && (r.value = t, this._writeFieldValue(e, t)), this._closePicker(e);
  }
  _writeFieldValue(e, t) {
    const r = this._payload.backend;
    this._payload.values = this._payload.values ?? {}, this._payload.values[r] = {
      ...this._payload.values[r] ?? {},
      [e]: t
    }, this._ctx.pushEvent("update_value", { backend: r, key: e, value: t });
  }
  _onFieldInput(e) {
    var o;
    const t = e.target, r = (o = t == null ? void 0 : t.dataset) == null ? void 0 : o.atpField;
    if (!r) return;
    const n = t.dataset.atpType === "boolean" ? t.checked : t.value, s = this._payload.backend;
    this._payload.values = this._payload.values ?? {}, this._payload.values[s] = {
      ...this._payload.values[s] ?? {},
      [r]: n
    }, this._ctx.pushEvent("update_value", { backend: s, key: r, value: n });
  }
}
function A(a, e) {
  new T(a.root, a, e);
}
export {
  A as init
};
