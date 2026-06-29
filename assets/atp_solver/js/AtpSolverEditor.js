import TptpEditor, {
	bindVerticalResize,
	getOutputPalette,
	highlightTptp,
	loadOutputTheme,
} from './TptpEditor.js';

const OUTPUT_THEME_NAME = 'Tomorrow';

// ─── Per-backend header controls ──────────────────────────────────────────

/**
 * Per-backend header extras. Each entry is `{ html, bind }`:
 *   `html(payload)` returns the inner HTML for the slot.
 *   `bind(editor)` wires DOM events to `editor._pushUpdate`.
 */
const BACKEND_CONTROLS = {
	sotptp: {
		html: ({ system, solvers }) => `
			<div class="flex flex-col flex-1 max-w-sm">
				<label class="text-xs font-semibold text-gray-600 mb-1">Solver</label>
				<select data-atp="system-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
					${optionsFor(solvers, system)}
				</select>
			</div>`,
		bind: (editor) => {
			const select = editor._q('[data-atp="system-select"]');
			if (!select) return;
			select.addEventListener('change', (e) =>
				editor._pushUpdate('system', e.target.value),
			);
		},
	},

	isabelle: {
		html: ({ proof_method }) => {
			// Common Isabelle/HOL proof methods. The `by …` tactics close the
			// goal directly; the diagnostic + `oops` combos (try0, try,
			// sledgehammer, nitpick) probe the goal without committing to a
			// proof. Ordered roughly by how often they're useful.
			const presets = [
				'by auto',
				'by simp',
				'by blast',
				'by metis',
				'by force',
				'by fast',
				'by linarith',
				'by presburger',
				'by arith',
				'by smt',
				'by algebra',
				'by clarsimp',
				'by safe',
				'try0 oops',
				'try oops',
				'sledgehammer oops',
				'nitpick oops',
				'nitpick[satisfy] oops',
				'sledgehammer nitpick nitpick[satisfy] oops',
				'sorry',
				'oops',
			];
			return `
				<div class="flex flex-col flex-1 max-w-sm">
					<label class="text-xs font-semibold text-gray-600 mb-1">Proof method</label>
					<input data-atp="proof-method-input" type="text" list="atp-proof-method-presets" value="${escapeHtml(proof_method ?? '')}" placeholder="by auto" spellcheck="false" class="w-full p-2 text-sm font-mono border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
					<datalist id="atp-proof-method-presets">
						${presets.map((p) => `<option value="${escapeHtml(p)}"></option>`).join('')}
					</datalist>
				</div>`;
		},
		bind: (editor) => {
			const input = editor._q('[data-atp="proof-method-input"]');
			if (!input) return;
			const push = (e) => editor._pushUpdate('proof_method', e.target.value);
			input.addEventListener('change', push);
			input.addEventListener('input', push);
		},
	},

	starexec: { html: () => '', bind: () => {} },
	local_exec: { html: () => '', bind: () => {} },
};

// ─── Result rendering ─────────────────────────────────────────────────────

const STATUS_STYLES = {
	thm: ['bg-green-100', 'text-green-800', 'border-green-300'],
	sat: ['bg-blue-100', 'text-blue-800', 'border-blue-300'],
	csat: ['bg-amber-100', 'text-amber-800', 'border-amber-300'],
	gave_up: ['bg-gray-100', 'text-gray-700', 'border-gray-300'],
	timeout: ['bg-orange-100', 'text-orange-800', 'border-orange-300'],
	out_of_resources: ['bg-orange-100', 'text-orange-800', 'border-orange-300'],
	interrupted: ['bg-gray-100', 'text-gray-700', 'border-gray-300'],
};

const STATUS_LABELS = {
	thm: '✓ Theorem',
	sat: '✓ Satisfiable',
	csat: '↯ Counter-satisfiable',
	gave_up: '? Gave up',
	timeout: '⏱ Timeout',
	out_of_resources: '⚠ Out of resources',
	interrupted: '⏹ Interrupted',
};

function statusBadge(status) {
	const label = STATUS_LABELS[status] || status;
	const cls = (
		STATUS_STYLES[status] || [
			'bg-gray-100',
			'text-gray-700',
			'border-gray-300',
		]
	).join(' ');
	return `<span class="inline-block px-3 py-1 text-sm font-semibold rounded border ${cls}">${escapeHtml(label)}</span>`;
}

function lemmaRow({ name, kind, status, message }) {
	const cell = (text) => `<td class="px-3 py-1.5 align-top">${text}</td>`;
	const nameCell = name
		? `<span class="font-mono">${escapeHtml(name)}</span>`
		: '<span class="text-gray-400 italic">(anonymous)</span>';
	const resultCell =
		kind === 'ok'
			? statusBadge(status)
			: `<span class="text-red-600 text-xs whitespace-pre-wrap">${escapeHtml(message ?? '')}</span>`;

	return `<tr class="border-t border-gray-200">${cell(nameCell)}${cell(resultCell)}</tr>`;
}

function lemmaTable(lemmas) {
	const rows = lemmas.map(lemmaRow).join('');
	return `
		<table class="w-full text-sm">
			<thead class="text-xs uppercase tracking-wide text-gray-500">
				<tr><th class="text-left px-3 py-1">Lemma</th><th class="text-left px-3 py-1">Result</th></tr>
			</thead>
			<tbody class="bg-white">${rows}</tbody>
		</table>`;
}

// ─── Small utilities ──────────────────────────────────────────────────────

function escapeHtml(value) {
	return String(value ?? '').replace(
		/[&<>"']/g,
		(c) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[c],
	);
}

function optionsFor(items, selected) {
	if (!items?.length)
		return `<option value="${escapeHtml(selected)}">${escapeHtml(selected || '(loading…)')}</option>`;
	return items
		.map(
			(item) =>
				`<option value="${escapeHtml(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`,
		)
		.join('');
}

// ─── AtpSolverEditor ──────────────────────────────────────────────────────

/**
 * Backend-aware TPTP editor cell.
 *
 *  - Header renders a backend `<select>`, per-backend extras (solver picker
 *    for SoTPTP, proof-method picker for Isabelle), and a shared Solve button.
 *  - Output area is a four-state container (`loading | preview | structured |
 *    error`). Raw TPTP text from SoTPTP is rendered with `highlightTptp` and
 *    sits inside a drag-to-resize panel; SZS badges and lemma tables get the
 *    same resize affordance for long lemma listings.
 */
export default class AtpSolverEditor extends TptpEditor {
	renderHeader() {
		const { backend, backends } = this._payload;
		const backendOptions = backends
			.map(
				({ key, label }) =>
					`<option value="${key}"${key === backend ? ' selected' : ''}>${escapeHtml(label)}</option>`,
			)
			.join('');

		return `
			<div class="flex items-end gap-3 w-full">
				<div class="flex flex-col w-44">
					<label class="text-xs font-semibold text-gray-600 mb-1">Backend</label>
					<select data-atp="backend-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
						${backendOptions}
					</select>
				</div>
				<div data-atp="backend-controls" class="flex-1 min-w-0">${this._renderBackendControls(backend)}</div>
				<button data-atp="btn-solve" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border-none rounded cursor-pointer hover:bg-blue-700 whitespace-nowrap transition-colors">
					Solve
				</button>
			</div>`;
	}

	bindHeader() {
		const ctx = this._ctx;

		loadOutputTheme(OUTPUT_THEME_NAME);

		this._q('[data-atp="backend-select"]')?.addEventListener(
			'change',
			(e) => {
				this._payload.backend = e.target.value;
				this._pushUpdate('backend', e.target.value);
				this._refreshBackendControls();
				this._clearOutput();
			},
		);

		this._bindBackendControls();

		this._q('[data-atp="btn-solve"]')?.addEventListener('click', () =>
			this.runSolver(),
		);

		this._bindOutputResize();

		ctx.handleEvent('solvers_fetched', ({ solvers, selected }) => {
			this._payload.solvers = solvers;
			this._payload.system = selected;
			if (this._payload.backend === 'sotptp')
				this._refreshBackendControls();
		});

		ctx.handleEvent('solve_started', ({ backend }) =>
			this._setOutput({
				state: 'loading',
				html: `Running ${escapeHtml(backend)}…`,
				resizable: false,
			}),
		);

		ctx.handleEvent('preview', ({ text }) => {
			if (!text || !text.trim()) {
				this._setOutput({
					state: 'empty',
					html: 'No response received from prover.',
					resizable: false,
				});
				return;
			}
			this._setOutput({
				state: 'preview',
				html: highlightTptp(text),
				resizable: true,
			});
		});

		ctx.handleEvent('preview_error', ({ message }) =>
			this._setOutput({
				state: 'error',
				html: escapeHtml(message),
				resizable: false,
			}),
		);

		ctx.handleEvent('atp_result', ({ status }) =>
			this._setOutput({
				state: 'structured',
				html: statusBadge(status),
				resizable: false,
			}),
		);

		ctx.handleEvent('lemma_results', ({ lemmas }) => {
			if (lemmas.length === 0) {
				this._setOutput({
					state: 'empty',
					html: 'No lemmas reported.',
					resizable: false,
				});
				return;
			}
			if (lemmas.length === 1) {
				const [only] = lemmas;
				const inner =
					only.kind === 'ok'
						? statusBadge(only.status)
						: `<pre class="m-0 text-red-600 font-mono text-xs whitespace-pre-wrap">${escapeHtml(only.message ?? '')}</pre>`;
				this._setOutput({
					state: 'structured',
					html: inner,
					resizable: false,
				});
				return;
			}
			this._setOutput({
				state: 'structured',
				html: lemmaTable(lemmas),
				resizable: true,
			});
		});
	}

	// ─── Settings panel ──────────────────────────────────────────────────

	renderSettings() {
		const { time_limit } = this._payload;
		return `
			<h3 class="text-sm font-semibold m-0 mb-3 text-gray-700">Configuration</h3>
			<div class="flex flex-col mb-3">
				<label class="text-xs font-semibold text-gray-600 mb-1">Time limit (s)</label>
				<input data-atp="timeout-input" type="number" value="${time_limit}" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
			</div>
			${this._renderThemeSelect()}
			${this._renderTptp4xToggle()}`;
	}

	bindSettings() {
		this._q('[data-atp="timeout-input"]')?.addEventListener('change', (e) =>
			this._pushUpdate('time_limit', parseInt(e.target.value, 10)),
		);
	}

	// ─── Output container ────────────────────────────────────────────────

	_mountExtras() {
		this._q('[data-tptp="inner"]').insertAdjacentHTML(
			'beforeend',
			`<div data-atp="output" class="mt-3 p-3 border border-gray-300 font-mono text-xs rounded overflow-y-auto whitespace-pre-wrap hidden" style="min-height: 60px;"></div>
			 <div data-atp="output-resize" class="w-full h-1.5 mt-px rounded cursor-ns-resize bg-gray-300 hover:bg-blue-400 active:bg-blue-500 transition-colors select-none hidden" title="Drag to resize output"></div>`,
		);
	}

	_clearOutput() {
		const out = this._q('[data-atp="output"]');
		const resize = this._q('[data-atp="output-resize"]');
		if (!out) return;
		out.innerHTML = '';
		out.classList.add('hidden');
		out.style.removeProperty('background-color');
		out.style.removeProperty('color');
		out.style.removeProperty('height');
		resize?.classList.add('hidden');
	}

	/**
	 * Single-entry-point output renderer.
	 *
	 * `state` controls textual tone (loading | preview | empty | error |
	 * structured); `resizable` toggles the drag handle. `preview` is the only
	 * state that uses the output palette as its background — every other state
	 * keeps the default panel background so structured content (badges,
	 * tables) reads with the host theme.
	 */
	_setOutput({ state, html, resizable }) {
		const out = this._q('[data-atp="output"]');
		const resize = this._q('[data-atp="output-resize"]');
		if (!out) return;

		const palette = getOutputPalette();
		out.classList.remove(
			'hidden',
			'text-gray-500',
			'text-red-600',
			'italic',
		);
		out.classList.add('block');

		const toneClasses =
			{
				loading: ['text-gray-500'],
				preview: [],
				empty: ['text-gray-500', 'italic'],
				error: ['text-red-600'],
				structured: [],
			}[state] ?? [];
		out.classList.add(...toneClasses);

		if (state === 'preview') {
			out.style.backgroundColor = palette.background;
			out.style.color = palette.foreground;
			if (!out.style.height) out.style.height = '16rem';
		} else {
			out.style.removeProperty('background-color');
			out.style.removeProperty('color');
			out.style.removeProperty('height');
		}

		out.innerHTML = html;
		resize?.classList.toggle('hidden', !resizable);
	}

	_bindOutputResize() {
		const handle = this._q('[data-atp="output-resize"]');
		const target = this._q('[data-atp="output"]');
		if (!handle || !target) return;
		bindVerticalResize(handle, target, 60);
	}

	// ─── Backend controls ────────────────────────────────────────────────

	_renderBackendControls(backend) {
		return BACKEND_CONTROLS[backend]?.html(this._payload) ?? '';
	}

	_refreshBackendControls() {
		const slot = this._q('[data-atp="backend-controls"]');
		if (!slot) return;
		slot.innerHTML = this._renderBackendControls(this._payload.backend);
		this._bindBackendControls();
	}

	_bindBackendControls() {
		BACKEND_CONTROLS[this._payload.backend]?.bind(this);
	}

	// ─── Solve action ────────────────────────────────────────────────────

	runSolver() {
		this._ctx.pushEvent('solve', {});
	}
}
