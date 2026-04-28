import TptpEditor, { diagToMarker } from './TptpEditor.js';

/**
 * Extends TptpEditor with ATP-solver controls: system select, time limit input,
 * solve button, and a preview area for prover output.
 *
 * Additional payload fields: system, time_limit, solvers.
 */
export default class SystemOnTptpEditor extends TptpEditor {
	// ─── Header: solver select + solve button ────────────────────────────

	renderHeader() {
		const { system } = this._payload;
		return `
			<div class="flex items-end gap-3 w-full">
				<div class="flex flex-col flex-1 max-w-sm">
					<label class="text-xs font-semibold text-gray-600 mb-1">Solver</label>
					<select data-tptp="system-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
						<option value="${system}">${system}</option>
					</select>
				</div>
				<button data-tptp="btn-solve" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border-none rounded cursor-pointer hover:bg-blue-700 whitespace-nowrap transition-colors">
					Solve
				</button>
			</div>`;
	}

	bindHeader() {
		const ctx = this._ctx;
		const systemSelect = this._q('[data-tptp="system-select"]');
		const previewContainer = this._q('[data-tptp="preview-container"]');

		if (systemSelect) {
			const populate = (solvers) => {
				const current = systemSelect.value;
				systemSelect.innerHTML = solvers
					.map(
						(s) =>
							`<option value="${s}"${s === current ? ' selected' : ''}>${s}</option>`,
					)
					.join('');
			};

			if (this._payload.solvers?.length > 1)
				populate(this._payload.solvers);

			ctx.handleEvent('solvers_fetched', ({ solvers }) =>
				populate(solvers),
			);
			systemSelect.addEventListener('change', (e) =>
				this._pushUpdate('system', e.target.value),
			);
		}

		this._q('[data-tptp="btn-solve"]')?.addEventListener('click', () =>
			this.runSolver(),
		);

		ctx.handleEvent('preview', ({ text }) => {
			previewContainer.classList.remove(
				'hidden',
				'text-red-400',
				'text-gray-300',
			);
			previewContainer.classList.add('block', 'text-green-400');
			previewContainer.textContent = text;
		});

		ctx.handleEvent('preview_error', ({ message }) => {
			previewContainer.classList.remove(
				'hidden',
				'text-green-400',
				'text-gray-300',
			);
			previewContainer.classList.add('block', 'text-red-400');
			previewContainer.textContent = message;
		});
	}

	// ─── Settings: timeout + theme + TPTP4X ─────────────────────────────

	renderSettings() {
		const { time_limit } = this._payload;
		return `
			<h3 class="text-sm font-semibold m-0 mb-3 text-gray-700">Configuration</h3>
			<div class="flex flex-col mb-3">
				<label class="text-xs font-semibold text-gray-600 mb-1">Time Limit (s)</label>
				<input data-tptp="timeout-input" type="number" value="${time_limit}" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
			</div>
			${this._renderThemeSelect()}
			${this._renderTptp4xToggle()}`;
	}

	bindSettings() {
		this._q('[data-tptp="timeout-input"]')?.addEventListener(
			'change',
			(e) => this._pushUpdate('time_limit', parseInt(e.target.value)),
		);
	}

	// ─── Preview container (not part of the base editor) ─────────────────

	_mountExtras() {
		this._q('[data-tptp="inner"]').insertAdjacentHTML(
			'beforeend',
			`<div data-tptp="preview-container" class="mt-3 p-3 bg-gray-900 border border-gray-800 font-mono text-xs rounded overflow-y-auto max-h-64 whitespace-pre-wrap hidden"></div>`,
		);
	}

	// ─── Solver action ────────────────────────────────────────────────────

	runSolver() {
		const previewContainer = this._q('[data-tptp="preview-container"]');
		const systemSelect = this._q('[data-tptp="system-select"]');
		previewContainer.classList.remove(
			'hidden',
			'text-red-400',
			'text-green-400',
		);
		previewContainer.classList.add('block', 'text-gray-300');
		previewContainer.textContent = `Running ${systemSelect?.value ?? 'solver'}...`;
		this._ctx.pushEvent('quick_eval_btn', { action: 'solve' });
	}
}
