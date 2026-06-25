// ─── Group layout ─────────────────────────────────────────────────────────

const GROUP_LABELS = {
	connection: 'Connection',
	defaults: 'Defaults',
	advanced: 'Advanced',
};

// Display order: connection first (must-fill), then defaults, then advanced.
const GROUP_ORDER = ['connection', 'defaults', 'advanced'];

// ─── Small utilities ──────────────────────────────────────────────────────

function escapeHtml(value) {
	return String(value ?? '').replace(/[&<>"']/g, (c) =>
		({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
	);
}

function fieldValue(values, backend, fieldKey) {
	return values?.[backend]?.[fieldKey] ?? '';
}

function fieldDisplayValue(field, raw) {
	if (raw !== '' && raw != null) return raw;
	const def = field.default;
	if (def == null) return '';
	if (Array.isArray(def)) return def.join(', ');
	return String(def);
}

// ─── Field renderers (per type) ───────────────────────────────────────────

function renderField(field, value) {
	const id = `atp-cfg-${field.key}`;
	const required = field.required
		? ' <span class="text-red-600" title="Required">*</span>'
		: '';

	const label = `
		<label for="${id}" class="block text-xs font-semibold text-gray-700 mb-1">
			${escapeHtml(field.label)}${required}
		</label>`;

	const doc = field.doc
		? `<p class="mt-1 text-xs text-gray-500 leading-snug">${escapeHtml(field.doc)}</p>`
		: '';

	const widget = renderWidget(field, value, id);

	return `<div class="mb-3">${label}${widget}${doc}</div>`;
}

function isPathField(field) {
	return field.type === 'string' && field.key.endsWith('_dir');
}

function renderWidget(field, value, id) {
	const display = fieldDisplayValue(field, value);
	const baseCls =
		'w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

	switch (field.type) {
		case 'integer':
			return `<input id="${id}" data-atp-field="${field.key}" data-atp-type="integer" type="number" value="${escapeHtml(display)}" class="${baseCls}">`;

		case 'boolean':
			return `<label class="inline-flex items-center gap-2 cursor-pointer">
				<input id="${id}" data-atp-field="${field.key}" data-atp-type="boolean" type="checkbox"${display === true || display === 'true' ? ' checked' : ''} class="cursor-pointer">
				<span class="text-xs text-gray-600">${escapeHtml(field.doc ?? '')}</span>
			</label>`;

		case 'string_list':
			return `<input id="${id}" data-atp-field="${field.key}" data-atp-type="string_list" type="text" value="${escapeHtml(display)}" placeholder="comma or space separated" class="${baseCls}">`;

		case 'string':
		default: {
			const inputType = field.secret ? 'password' : 'text';
			if (isPathField(field)) {
				return `
					<div class="flex gap-2">
						<input id="${id}" data-atp-field="${field.key}" data-atp-type="string" type="text" value="${escapeHtml(display)}" class="${baseCls} flex-1" autocomplete="off">
						<button type="button" data-atp-browse="${field.key}" class="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100 whitespace-nowrap transition-colors">📁 Browse…</button>
					</div>
					<div data-atp-picker="${field.key}" class="hidden mt-2 border border-gray-300 rounded bg-white"></div>`;
			}
			return `<input id="${id}" data-atp-field="${field.key}" data-atp-type="string" type="${inputType}" value="${escapeHtml(display)}" class="${baseCls}" autocomplete="off">`;
		}
	}
}

// ─── Folder picker panel ──────────────────────────────────────────────────

function renderPicker(state) {
	if (!state) {
		return '<div class="p-3 text-xs text-gray-500 italic">Loading…</div>';
	}

	const { path, parent, entries, error, drives } = state;
	const upDisabled = parent == null ? ' opacity-40 cursor-not-allowed' : '';

	const entryItems =
		entries.length === 0
			? `<li class="px-3 py-2 text-xs text-gray-400 italic">${error ? '' : '(no subdirectories)'}</li>`
			: entries
					.map(
						(entry) =>
							`<li><button type="button" data-atp-picker-nav="${escapeHtml(entry.name)}" class="w-full text-left px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-blue-50 border-none bg-transparent">📁 ${escapeHtml(entry.name)}</button></li>`,
					)
					.join('');

	const errorBanner = error
		? `<div class="px-3 py-2 text-xs text-red-700 bg-red-50 border-b border-red-200">${escapeHtml(error)}</div>`
		: '';

	const drivesBar =
		drives && drives.length > 0
			? `<div class="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
					<span class="text-xs font-semibold text-gray-500 mr-1">Drives:</span>
					${drives
						.map((drive) => {
							const active = path?.toUpperCase().startsWith(drive.toUpperCase());
							const activeCls = active
								? ' bg-blue-100 border-blue-400 text-blue-800'
								: ' bg-white border-gray-300 text-gray-700';
							return `<button type="button" data-atp-picker-goto="${escapeHtml(drive)}" class="px-2 py-1 text-xs font-mono border rounded cursor-pointer hover:bg-gray-100${activeCls}">${escapeHtml(drive)}</button>`;
						})
						.join('')}
				</div>`
			: '';

	return `
		${drivesBar}
		<div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
			<button type="button" data-atp-picker-up class="px-2 py-1 text-xs font-medium border border-gray-300 rounded bg-white cursor-pointer hover:bg-gray-100${upDisabled}"${parent == null ? ' disabled' : ''}>↑ Up</button>
			<button type="button" data-atp-picker-home class="px-2 py-1 text-xs font-medium border border-gray-300 rounded bg-white cursor-pointer hover:bg-gray-100">🏠 Home</button>
			<span class="flex-1 text-xs font-mono text-gray-700 truncate" title="${escapeHtml(path)}">${escapeHtml(path)}</span>
		</div>
		${errorBanner}
		<ul class="m-0 p-0 list-none max-h-56 overflow-y-auto">${entryItems}</ul>
		<div class="flex items-center gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
			<button type="button" data-atp-picker-select class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border-none rounded cursor-pointer hover:bg-blue-700">Select this folder</button>
			<button type="button" data-atp-picker-cancel class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded cursor-pointer hover:bg-gray-100">Cancel</button>
		</div>`;
}

// ─── Section + form layout ────────────────────────────────────────────────

function groupFields(schema) {
	const groups = { connection: [], defaults: [], advanced: [] };
	for (const field of schema) {
		(groups[field.group] ?? groups.advanced).push(field);
	}
	return groups;
}

function renderSection(group, fields, values, backend) {
	if (!fields.length) return '';
	const inner = fields
		.map((f) => renderField(f, fieldValue(values, backend, f.key)))
		.join('');

	if (group === 'advanced') {
		return `
			<details class="mt-4 border-t border-gray-200 pt-3">
				<summary class="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">${GROUP_LABELS.advanced}</summary>
				<div class="mt-3">${inner}</div>
			</details>`;
	}

	return `
		<section class="mb-4">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">${GROUP_LABELS[group]}</h3>
			${inner}
		</section>`;
}

function renderForm(schema, values, backend) {
	const groups = groupFields(schema);
	return GROUP_ORDER.map((g) => renderSection(g, groups[g], values, backend)).join('');
}

// ─── UI-only extras (e.g. "skip TLS verification") ────────────────────────

function renderExtras(extras, values, backend) {
	if (!extras || extras.length === 0) return '';
	const inner = extras
		.map((extra) => renderExtraToggle(extra, values, backend))
		.join('');
	return `
		<section class="mt-4 border-t border-gray-200 pt-3">
			<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Connection extras</h3>
			${inner}
		</section>`;
}

function renderExtraToggle(extra, values, backend) {
	const id = `atp-cfg-extra-${extra.key}`;
	const raw = fieldValue(values, backend, extra.key);
	const checked = raw === true || raw === 'true' ? ' checked' : '';
	const doc = extra.doc
		? `<p class="mt-1 ml-6 text-xs text-gray-500 leading-snug">${escapeHtml(extra.doc)}</p>`
		: '';
	return `
		<div class="mb-2">
			<label for="${id}" class="inline-flex items-center gap-2 cursor-pointer">
				<input id="${id}" data-atp-field="${extra.key}" data-atp-type="boolean" type="checkbox"${checked} class="cursor-pointer">
				<span class="text-xs font-semibold text-gray-700">${escapeHtml(extra.label)}</span>
			</label>
			${doc}
		</div>`;
}

// ─── Backend-level notice banner ──────────────────────────────────────────

function renderNotice({ kind, message }) {
	const styles =
		kind === 'info'
			? 'bg-blue-50 text-blue-900 border-blue-200'
			: 'bg-amber-50 text-amber-900 border-amber-200';
	return `<div class="mb-4 p-3 border rounded text-xs leading-snug ${styles}">${escapeHtml(message)}</div>`;
}

// ─── Verify status pill ───────────────────────────────────────────────────

function renderStatus(status) {
	if (!status) return '<span class="text-xs text-gray-400">Not verified yet.</span>';
	if (status.kind === 'ok')
		return '<span class="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 border border-green-300">✓ Reachable</span>';
	return `<div class="space-y-1">
		<span class="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 border border-red-300">✗ Failed</span>
		<pre class="m-0 mt-1 p-2 bg-gray-900 text-red-300 font-mono text-xs rounded whitespace-pre-wrap">${escapeHtml(status.message ?? '')}</pre>
	</div>`;
}

// ─── BackendConfigForm ────────────────────────────────────────────────────

/**
 * Schema-driven configuration form for AtpClient backends.
 *
 *  - The Elixir cell sends the full schema for every backend on connect; the
 *    JS side never hard-codes field lists, so a new backend on the Elixir
 *    side automatically appears here.
 *  - Field edits push `update_value` back to the cell; the cell persists
 *    them and regenerates source on next eval.
 *  - The Verify button runs the backend's `verify/1` callback in a Task on
 *    the Elixir side and the result lands in `verify_result`.
 */
export default class BackendConfigForm {
	constructor(container, ctx, payload) {
		this._ctx = ctx;
		this._payload = payload;
		this._root = container;
		// Picker state keyed by field key: { path, parent, entries, error }.
		// `null` means the picker is mounted but waiting for the first listing.
		this._pickers = {};
		this._mount();
	}

	_q(sel) {
		return this._root.querySelector(sel);
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
		`;

		this._renderForm();
		this._renderStatus();
		this._bind();
	}

	_renderBackendOptions() {
		const { backend, backends } = this._payload;
		return backends
			.map(
				({ key, label }) =>
					`<option value="${key}"${key === backend ? ' selected' : ''}>${escapeHtml(label)}</option>`,
			)
			.join('');
	}

	_renderForm() {
		const { backend, values, schemas, notices, ui_extras } = this._payload;
		const schema = schemas[backend] ?? [];
		const notice = notices?.[backend];
		const noticeHtml = notice ? renderNotice(notice) : '';
		const extras = ui_extras?.[backend] ?? [];
		this._q('[data-atp="form"]').innerHTML =
			noticeHtml + renderForm(schema, values, backend) + renderExtras(extras, values, backend);
	}

	_renderStatus() {
		const { verify_status, backend } = this._payload;
		const status =
			verify_status && verify_status.backend === backend ? verify_status : null;
		this._q('[data-atp="status"]').innerHTML = renderStatus(status);
	}

	_bind() {
		const ctx = this._ctx;
		const root = this._root;

		this._q('[data-atp="backend-select"]').addEventListener('change', (e) => {
			this._payload.backend = e.target.value;
			ctx.pushEvent('update_backend', { backend: e.target.value });
			this._pickers = {};
			this._renderForm();
			this._renderStatus();
		});

		root.addEventListener('input', (e) => this._onFieldInput(e));
		root.addEventListener('change', (e) => this._onFieldInput(e));
		root.addEventListener('click', (e) => this._onClick(e));

		this._q('[data-atp="btn-verify"]').addEventListener('click', () => {
			ctx.pushEvent('verify', { backend: this._payload.backend });
		});

		ctx.handleEvent('verify_started', () => {
			this._q('[data-atp="status"]').innerHTML =
				'<span class="text-xs text-gray-500 italic">Verifying…</span>';
		});

		ctx.handleEvent('verify_result', (status) => {
			this._payload.verify_status = status;
			this._renderStatus();
		});

		ctx.handleEvent('dir_listing', (listing) => this._onDirListing(listing));
	}

	// ─── Folder picker ───────────────────────────────────────────────────

	_onClick(event) {
		const target = event.target.closest('button');
		if (!target) return;

		const browseKey = target.dataset?.atpBrowse;
		if (browseKey) {
			this._openPicker(browseKey);
			return;
		}

		const pickerEl = target.closest('[data-atp-picker]');
		if (!pickerEl) return;

		const key = pickerEl.dataset.atpPicker;
		const state = this._pickers[key];

		if (target.dataset.atpPickerNav != null) {
			const next = `${state?.path ?? ''}/${target.dataset.atpPickerNav}`;
			this._requestListing(key, next);
		} else if (target.dataset.atpPickerGoto != null) {
			this._requestListing(key, target.dataset.atpPickerGoto);
		} else if (target.hasAttribute('data-atp-picker-up')) {
			if (state?.parent) this._requestListing(key, state.parent);
		} else if (target.hasAttribute('data-atp-picker-home')) {
			this._requestListing(key, '');
		} else if (target.hasAttribute('data-atp-picker-select')) {
			if (state?.path) this._selectPickerPath(key, state.path);
		} else if (target.hasAttribute('data-atp-picker-cancel')) {
			this._closePicker(key);
		}
	}

	_openPicker(key) {
		const pickerEl = this._q(`[data-atp-picker="${key}"]`);
		if (!pickerEl) return;
		pickerEl.classList.remove('hidden');
		this._pickers[key] = null;
		pickerEl.innerHTML = renderPicker(null);
		const current = fieldValue(this._payload.values, this._payload.backend, key);
		this._requestListing(key, current);
	}

	_closePicker(key) {
		const pickerEl = this._q(`[data-atp-picker="${key}"]`);
		if (!pickerEl) return;
		pickerEl.classList.add('hidden');
		pickerEl.innerHTML = '';
		delete this._pickers[key];
	}

	_requestListing(key, path) {
		this._ctx.pushEvent('list_dir', {
			backend: this._payload.backend,
			key,
			path: path ?? '',
		});
	}

	_onDirListing(listing) {
		const { backend, key } = listing;
		if (backend !== this._payload.backend) return;
		if (!(key in this._pickers)) return;
		this._pickers[key] = listing;
		const pickerEl = this._q(`[data-atp-picker="${key}"]`);
		if (pickerEl) pickerEl.innerHTML = renderPicker(listing);
	}

	_selectPickerPath(key, path) {
		const input = this._q(`[data-atp-field="${key}"]`);
		if (input) {
			input.value = path;
			this._writeFieldValue(key, path);
		}
		this._closePicker(key);
	}

	_writeFieldValue(key, value) {
		const backend = this._payload.backend;
		this._payload.values = this._payload.values ?? {};
		this._payload.values[backend] = {
			...(this._payload.values[backend] ?? {}),
			[key]: value,
		};
		this._ctx.pushEvent('update_value', { backend, key, value });
	}

	_onFieldInput(event) {
		const el = event.target;
		const key = el?.dataset?.atpField;
		if (!key) return;

		const value =
			el.dataset.atpType === 'boolean' ? el.checked : el.value;

		const backend = this._payload.backend;
		this._payload.values = this._payload.values ?? {};
		this._payload.values[backend] = {
			...(this._payload.values[backend] ?? {}),
			[key]: value,
		};

		this._ctx.pushEvent('update_value', { backend, key, value });
	}
}
