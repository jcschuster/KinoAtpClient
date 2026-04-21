import './style.css';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import themeList from 'monaco-themes/themes/themelist.json';

self.MonacoEnvironment = {
	getWorker: function (_workerId, _label) {
		return new editorWorker();
	},
};

monaco.languages.register({ id: 'tptp' });
monaco.languages.setLanguageConfiguration('tptp', {
	brackets: [
		['[', ']'],
		['(', ')'],
		['{', '}'],
	],
	autoClosingPairs: [
		{ open: '[', close: ']' },
		{ open: '(', close: ')' },
	],
});

monaco.languages.setMonarchTokensProvider('tptp', {
	tokenizer: {
		root: [
			[
				/\b(thf|tff|fof|cnf|include|axiom|hypothesis|definition|assumption|lemma|theorem|corollary|conjecture|negated_conjecture|plain|type|interpretation|unknown)\b/,
				'keyword',
			],
			[/\$(i|o|tType|oType|iType|real|rat|int)\b/, 'type'],
			[/\$(true|false)\b/, 'constant'],
			[/(!|\?|\^|@\+|@-|!>|\?\*)/, 'keyword.control'],
			[
				/(~|&|\||=>|<=|<=>|<~>|~&|~\||=|!=|>|@|!!|\?\?|<<|-->|:=|==|@@\+|@@-|@=|\*|\+)/,
				'keyword.operator',
			],
			[/[A-Z][a-zA-Z0-9_]*/, 'variable'],
			[/[a-z][a-zA-Z0-9_]*/, 'identifier'],
			[/%.*/, 'comment'],
			[
				/\$(distinct|lesseq|greater|greatereq|is_int|is_rat|uminus|sum|difference|product|quotient|quotient_e|quotient_t|quotient_f|remainder_e|remainder_t|remainder_f|floor|ceiling|truncate|round|to_int|to_rat|to_real)\b/,
				'support.function',
			],
		],
	},
});

export function init(ctx, payload) {
	ctx.root.innerHTML = `
	<link rel="stylesheet" href="system_on_tptp_assets.css">
    <div class="font-sans p-4 bg-gray-50 border border-gray-200 rounded-lg relative text-gray-700 box-border">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-end gap-3 w-full">
                <div class="flex flex-col flex-1 max-w-sm">
                    <label class="text-xs font-semibold text-gray-600 mb-1">Solver</label>
                    <select id="system-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        <option value="${payload.system}">${payload.system}</option>
                    </select>
                </div>
                <button id="btn-solve" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border-none rounded cursor-pointer hover:bg-blue-700 whitespace-nowrap transition-colors">
                    Solve
                </button>
            </div>

            <button id="menu-toggle" class="p-2 text-gray-500 bg-transparent border-none cursor-pointer ml-4 mt-5 hover:text-gray-800 transition-colors">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
            </button>
        </div>

        <div id="settings-panel" class="absolute top-16 right-4 w-64 bg-white border border-gray-200 rounded shadow-lg p-4 z-50 hidden">
            <h3 class="text-sm font-semibold m-0 mb-3 text-gray-700">Configuration</h3>
            <div class="flex flex-col mb-3">
                <label class="text-xs font-semibold text-gray-600 mb-1">Time Limit (s)</label>
                <input id="timeout-input" type="number" value="${payload.time_limit}" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            </div>
            <div class="flex flex-col">
                <label class="text-xs font-semibold text-gray-600 mb-1">Editor Theme</label>
                <select id="theme-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
					<option value="${payload.theme}">${payload.theme}</option>
				</select>
            </div>
        </div>

        <div class="mt-2 border border-gray-300 rounded overflow-hidden" phx-update="ignore">
            <div id="editor-container" style="height: 200px; width: 100%;"></div>
        </div>

        <div id="preview-container" class="mt-3 p-3 bg-gray-900 border border-gray-800 font-mono text-xs rounded overflow-y-auto max-h-64 whitespace-pre-wrap hidden"></div>
    </div>`;

	const themeSelect = document.getElementById('theme-select');
	const builtInThemes = {
		vs: 'Visual Studio Light',
		'vs-dark': 'Visual Studio Dark',
		'hc-black': 'High Contrast Dark',
	};

	let themeOptions = '';
	Object.entries(builtInThemes).forEach(
		([id, name]) =>
			(themeOptions += `<option value="${id}">${name}</option>`),
	);
	Object.entries(themeList).forEach(
		([_id, name]) =>
			(themeOptions += `<option value="${name}">${name}</option>`),
	);
	themeSelect.innerHTML = themeOptions;

	const currentTheme = payload.theme || 'vs';
	themeSelect.value = currentTheme;

	const applyTheme = async (themeName) => {
		if (builtInThemes[themeName]) {
			monaco.editor.setTheme(themeName);
			return;
		}

		const themeId = themeName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

		try {
			const themeUrl = `./themes/${encodeURIComponent(themeName)}.json`;
			const response = await fetch(themeUrl);

			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);

			const themeData = await response.json();

			monaco.editor.defineTheme(themeId, themeData);
			monaco.editor.setTheme(themeId);
		} catch (err) {
			console.error('Failed to load theme:', themeName, err);
			monaco.editor.setTheme('vs');
		}
	};

	const editorContainer = document.getElementById('editor-container');
	editorContainer.addEventListener('keydown', (e) => e.stopPropagation());

	const editor = monaco.editor.create(editorContainer, {
		value: payload.problem_str,
		language: 'tptp',
		minimap: { enabled: false },
		stickyScroll: { enabled: false },
		bracketPairColorization: { enabled: true },
		automaticLayout: true,
		scrollBeyondLastLine: false,
		padding: { top: 12, bottom: 12 },
		fontSize: 14,
	});

	applyTheme(currentTheme);

	const observer = new MutationObserver((mutations, obs) => {
		const imeTextArea = editorContainer.querySelector('.ime-text-area');
		if (imeTextArea) {
			imeTextArea.setAttribute('id', 'monaco-ime-input');
			imeTextArea.setAttribute('name', 'monaco-ime-input');
			obs.disconnect();
		}
	});
	observer.observe(editorContainer, { childList: true, subtree: true });

	const systemSelect = document.getElementById('system-select');
	const previewContainer = document.getElementById('preview-container');
	const settingsPanel = document.getElementById('settings-panel');
	const menuToggle = document.getElementById('menu-toggle');
	const pushUpdate = (key, value) =>
		ctx.pushEvent('update', { [key]: value });

	const populateSolvers = (solvers) => {
		const current = systemSelect.value;
		systemSelect.innerHTML = solvers
			.map(
				(s) =>
					`<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`,
			)
			.join('');
	};

	if (payload.solvers && payload.solvers.length > 1) {
		populateSolvers(payload.solvers);
	}

	ctx.handleEvent('solvers_fetched', ({ solvers }) =>
		populateSolvers(solvers),
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

	editor.onDidChangeModelContent(() =>
		pushUpdate('problem_str', editor.getValue()),
	);
	systemSelect.addEventListener('change', (e) =>
		pushUpdate('system', e.target.value),
	);
	document
		.getElementById('timeout-input')
		.addEventListener('change', (e) =>
			pushUpdate('time_limit', parseInt(e.target.value)),
		);

	themeSelect.addEventListener('change', (e) => {
		const newTheme = e.target.value;
		applyTheme(newTheme);
		pushUpdate('theme', newTheme);
	});

	menuToggle.addEventListener('click', () =>
		settingsPanel.classList.toggle('hidden'),
	);
	editor.onDidFocusEditorText(() => settingsPanel.classList.add('hidden'));

	document.getElementById('btn-solve').addEventListener('click', () => {
		previewContainer.classList.remove(
			'hidden',
			'text-red-400',
			'text-green-400',
		);
		previewContainer.classList.add('block', 'text-gray-300');
		previewContainer.textContent = `Running ${systemSelect.value}...`;
		ctx.pushEvent('quick_eval_btn', { action: 'solve' });
	});
}
