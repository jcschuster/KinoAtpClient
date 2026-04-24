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
			[/[A-Z_][a-zA-Z0-9_]*/, 'variable'],
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
			[/[a-z][a-zA-Z0-9_]*/, 'identifier'],
			[/%.*/, 'comment'],
			[
				/\$(distinct|lesseq|greater|greatereq|is_int|is_rat|uminus|sum|difference|product|quotient|quotient_e|quotient_t|quotient_f|remainder_e|remainder_t|remainder_f|floor|ceiling|truncate|round|to_int|to_rat|to_real)\b/,
				'support.function',
			],
		],
	},
});

const TPTP_KEYWORDS = {
	thf: 'Typed Higher-order Form — statement prefix for THF problems.',
	tff: 'Typed First-order Form — statement prefix for TFF problems.',
	fof: 'First-Order Form — statement prefix for untyped FOF problems.',
	cnf: 'Clause Normal Form — statement prefix for CNF problems.',
	tpi: 'TPTP Process Instruction — statement prefix for meta-level directives.',
	tcf: 'Typed Clause Normal Form — statement prefix for TCF problems.',
	include: 'Include directive; pulls in axioms from another TPTP file.',
	axiom: 'Role: a given, non-negotiable assertion.',
	hypothesis:
		'Role: an assumption specific to the current reasoning context.',
	definition: 'Role: introduces a new symbol in terms of existing ones.',
	assumption: 'Role: used in structured proofs; may be discharged later.',
	lemma: 'Role: an auxiliary, previously-proved result.',
	theorem: 'Role: a previously-proved main result.',
	corollary: 'Role: a direct consequence of a theorem.',
	conjecture: 'Role: the goal to be proved. At most one per problem.',
	negated_conjecture:
		'Role: the negation of the conjecture (CNF convention).',
	plain: 'Role: no specific logical meaning; used for bookkeeping.',
	type: 'Role: a type declaration in TFF/THF.',
	fi_domain: 'Role: finite-interpretation domain specification.',
	fi_functors: 'Role: finite-interpretation functor specification.',
	fi_predicates: 'Role: finite-interpretation predicate specification.',
	interpretation: 'Role: an interpretation given as part of a problem.',
	unknown: 'Role: unknown origin (typically set by translation tools).',
};

const TPTP_BUILTINS = {
	$true: 'The propositional constant true.',
	$false: 'The propositional constant false.',
	$i: 'The built-in type of individuals (FO entities).',
	$o: 'The built-in type of booleans / formulae.',
	$tType: 'The built-in type of types (THF/TFF1).',
	$int: 'The built-in type of integers.',
	$rat: 'The built-in type of rationals.',
	$real: 'The built-in type of reals.',
	$less: 'Arithmetic: strict less-than.',
	$lesseq: 'Arithmetic: less-than-or-equal.',
	$greater: 'Arithmetic: strict greater-than.',
	$greatereq: 'Arithmetic: greater-than-or-equal.',
	$sum: 'Arithmetic: addition.',
	$difference: 'Arithmetic: subtraction.',
	$product: 'Arithmetic: multiplication.',
	$quotient: 'Arithmetic: division.',
	$uminus: 'Arithmetic: unary minus.',
	$is_int: 'Arithmetic: predicate testing integrality.',
	$is_rat: 'Arithmetic: predicate testing rationality.',
	$to_int: 'Arithmetic: conversion to integer.',
	$to_rat: 'Arithmetic: conversion to rational.',
	$to_real: 'Arithmetic: conversion to real.',
	$distinct: 'Built-in predicate asserting mutual distinctness.',
};

function ensureTptpProviders() {
	if (window.__tptpProvidersRegistered) return;
	window.__tptpProvidersRegistered = true;
	window.__tptpSymbolsByModel = new WeakMap();

	monaco.languages.registerHoverProvider('tptp', {
		provideHover(model, position) {
			const word = model.getWordAtPosition(position);
			if (!word) return null;
			const name = word.word;
			const range = new monaco.Range(
				position.lineNumber,
				word.startColumn,
				position.lineNumber,
				word.endColumn,
			);

			// 1) Declared symbol wins — it's the most specific.
			const symbols = window.__tptpSymbolsByModel.get(model) || [];
			const sym = symbols.find((s) => s.name === name);
			if (sym) {
				const contents = [
					{ value: `**${sym.name}** : \`${sym.type || '_?_'}\`` },
				];
				if (sym.line) {
					contents.push({ value: `_declared at line ${sym.line}_` });
				}
				return { range, contents };
			}

			// 2) TPTP keyword.
			if (TPTP_KEYWORDS[name]) {
				return {
					range,
					contents: [
						{ value: `**${name}** — TPTP keyword` },
						{ value: TPTP_KEYWORDS[name] },
					],
				};
			}

			// 3) TPTP built-in ($true, $i, ...). Word API strips the leading
			//    `$`, so we also check with the prefix re-attached.
			const builtinKey = `$${name}`;
			if (TPTP_BUILTINS[builtinKey]) {
				return {
					range,
					contents: [
						{ value: `**${builtinKey}** — TPTP built-in` },
						{ value: TPTP_BUILTINS[builtinKey] },
					],
				};
			}

			return null;
		},
	});

	monaco.languages.registerCompletionItemProvider('tptp', {
		triggerCharacters: [' ', '(', ',', '$'],
		provideCompletionItems(model, position) {
			const word = model.getWordUntilPosition(position);
			const range = {
				startLineNumber: position.lineNumber,
				endLineNumber: position.lineNumber,
				startColumn: word.startColumn,
				endColumn: word.endColumn,
			};

			const suggestions = [];

			for (const [kw, doc] of Object.entries(TPTP_KEYWORDS)) {
				suggestions.push({
					label: kw,
					kind: monaco.languages.CompletionItemKind.Keyword,
					insertText: kw,
					documentation: doc,
					range,
				});
			}

			for (const [name, doc] of Object.entries(TPTP_BUILTINS)) {
				suggestions.push({
					label: name,
					kind: monaco.languages.CompletionItemKind.Constant,
					insertText: name,
					documentation: doc,
					range,
				});
			}

			const symbols = window.__tptpSymbolsByModel.get(model) || [];
			for (const sym of symbols) {
				suggestions.push({
					label: sym.name,
					kind: monaco.languages.CompletionItemKind.Function,
					insertText: sym.name,
					detail: sym.type ? `: ${sym.type}` : '',
					documentation: sym.type
						? `${sym.name} : ${sym.type}`
						: undefined,
					range,
				});
			}

			return { suggestions };
		},
	});
}

// Translate a server-side Diagnostic into a Monaco IMarkerData object.
function diagToMarker(d) {
	const severity =
		{
			error: monaco.MarkerSeverity.Error,
			warning: monaco.MarkerSeverity.Warning,
			info: monaco.MarkerSeverity.Info,
			hint: monaco.MarkerSeverity.Hint,
		}[d.severity] || monaco.MarkerSeverity.Error;

	return {
		severity,
		message: d.message,
		source: d.source || 'atp-lint',
		startLineNumber: d.line,
		startColumn: d.column,
		endLineNumber: d.end_line || d.line,
		endColumn: d.end_column || d.column + 1,
	};
}

export function init(ctx, payload) {
	ensureTptpProviders();

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
            <div class="flex flex-col mb-3">
                <label class="text-xs font-semibold text-gray-600 mb-1">Editor Theme</label>
                <select id="theme-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
					<option value="${payload.theme}">${payload.theme}</option>
				</select>
            </div>
            <div class="flex items-center gap-2">
                <input id="tptp4x-toggle" type="checkbox" ${
					payload.tptp4x_enabled !== false ? 'checked' : ''
				} class="cursor-pointer">
                <label for="tptp4x-toggle" class="text-xs font-semibold text-gray-600 cursor-pointer">Check via TPTP4x</label>
            </div>
        </div>

        <div class="mt-2 border border-gray-300 rounded overflow-hidden" phx-update="ignore">
            <div id="editor-container" style="height: 200px; width: 100%;"></div>
        </div>

        <div id="status-bar" class="mt-1 text-xs text-gray-500 flex items-center gap-2 h-4"></div>

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
		renderLineHighlightOnlyWhenFocus: true,
		bracketPairColorization: { enabled: true },
		automaticLayout: true,
		scrollBeyondLastLine: false,
		padding: { top: 12, bottom: 12 },
		fontSize: 14,
		fixedOverflowWidgets: true,
	});

	applyTheme(currentTheme);

	window.__tptpSymbolsByModel.set(editor.getModel(), []);

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
	const statusBar = document.getElementById('status-bar');
	const tptp4xToggle = document.getElementById('tptp4x-toggle');
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

	let lintTimer = null;
	const scheduleLint = () => {
		if (lintTimer) clearTimeout(lintTimer);
		lintTimer = setTimeout(() => {
			lintTimer = null;
			ctx.pushEvent('check_syntax', { problem: editor.getValue() });
		}, 500);
	};

	const updateStatusBar = (diags) => {
		const errors = diags.filter((d) => d.severity === 'error').length;
		const warnings = diags.filter((d) => d.severity === 'warning').length;

		if (errors === 0 && warnings === 0) {
			statusBar.textContent = '';
			statusBar.className =
				'mt-1 text-xs text-green-600 flex items-center gap-2 h-4';
			statusBar.textContent = '✓ no issues';
			return;
		}

		const parts = [];
		if (errors) parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
		if (warnings)
			parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
		statusBar.textContent = parts.join(', ');
		statusBar.className = `mt-1 text-xs ${errors ? 'text-red-600' : 'text-amber-600'} flex items-center gap-2 h-4`;
	};

	ctx.handleEvent('lint_result', ({ diagnostics, symbols }) => {
		const markers = (diagnostics || []).map(diagToMarker);
		monaco.editor.setModelMarkers(editor.getModel(), 'tptp-lint', markers);
		window.__tptpSymbolsByModel.set(editor.getModel(), symbols || []);
		updateStatusBar(diagnostics || []);
	});

	editor.onDidChangeModelContent(() => {
		pushUpdate('problem_str', editor.getValue());
		scheduleLint();
	});
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

	tptp4xToggle.addEventListener('change', (e) => {
		pushUpdate('tptp4x_enabled', e.target.checked);
		scheduleLint();
	});

	menuToggle.addEventListener('click', () =>
		settingsPanel.classList.toggle('hidden'),
	);
	editor.onDidFocusEditorText(() => settingsPanel.classList.add('hidden'));

	document.getElementById('btn-solve').addEventListener('click', runSolver);

	editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, runSolver);

	function runSolver() {
		previewContainer.classList.remove(
			'hidden',
			'text-red-400',
			'text-green-400',
		);
		previewContainer.classList.add('block', 'text-gray-300');
		previewContainer.textContent = `Running ${systemSelect.value}...`;
		ctx.pushEvent('quick_eval_btn', { action: 'solve' });
	}

	scheduleLint();
}
