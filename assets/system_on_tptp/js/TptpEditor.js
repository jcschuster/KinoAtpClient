import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import themeList from 'monaco-themes/themes/themelist.json';

self.MonacoEnvironment = {
	getWorker: function (_workerId, _label) {
		return new editorWorker();
	},
};

// ─── TPTP language registration (runs once at module load) ────────────────

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
		{ open: '{', close: '}' },
	],
});

monaco.languages.setMonarchTokensProvider('tptp', {
	tokenizer: {
		root: [
			[/[A-Z][a-zA-Z0-9_]*/, 'variable'],
			[
				/\b(thf|tff|fof|cnf|tpi|tcf|include|axiom|hypothesis|definition|assumption|lemma|theorem|corollary|conjecture|negated_conjecture|plain|type|interpretation|unknown|\$(modal|alethic_modal|deontic_modal|epistemic_modal|doxastic_modal|temporal_instant|modal_system_{K,M,B,D,S4,S5}|modal_axiom_{K,M,B,D,4,5}|domains|constant|varying|cumulative|decreasing|designation|rigid|flexible|terms|local|global|modalities|time|reflexivity|irreflexivity|transitivity|asymmetry|anti_symmetry|linearity|forward_linearity|backward_linearity|beginning|end|no_beginning|no_end|density|forward_discreteness|backward_discreteness))\b/,
				'keyword',
			],
			[/\$(i|o|tType|oType|iType|real|rat|int)\b/, 'type'],
			[/\$(true|false)\b/, 'constant'],
			[/(!|\?|\^|@\+|@-|!>|\?\*|\$(ite|let))/, 'keyword.control'],
			[
				/(~|&|\||=>|<=|<=>|<~>|~&|~\||=|!=|>|@|!!|\?\?|<<|-->|:=|==|@@\+|@@-|@=|\*|\+|\$(box|dia)|\[.\]|<.>|\{\$(necessary|possible|obligatory|permissible|knows|canKnow|believes|canBelieve)\})/,
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

// ─── TPTP knowledge constants ─────────────────────────────────────────────

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

Object.assign(
	TPTP_BUILTINS,
	{
		$box: 'Necessity operator (□). Unparameterised, also writable as [.].',
		$dia: 'Possibility operator (◇). Unparameterised, also writable as <.>.',
		$necessary: 'Alethic necessity.',
		$possible: 'Alethic possibility.',
		$obligatory: 'Deontic: it is obligatory that.',
		$permissible: 'Deontic: it is permitted that.',
		$forbidden: 'Deontic: it is forbidden that.',
		$knows: 'Epistemic: the indexed agent knows that. Index given as first parameter, e.g. {$knows(#alice)}.',
		$canKnow: 'Epistemic: it is possible for the indexed agent to know that.',
		$believes: 'Doxastic: the indexed agent believes that.',
		$canBelieve:
			'Doxastic: it is possible for the indexed agent to believe that.',
		$future: 'Temporal: at some future instant.',
	},
	{
		$domains: 'Logic property: how domains vary across worlds.',
		$designation:
			'Logic property: whether term denotations depend on the world.',
		$terms: 'Logic property: whether terms are interpreted locally or globally.',
		$modalities:
			'Logic property: the modal system or axiom set that characterises the accessibility relation.',
		$time: 'Logic property: structural properties of the temporal ordering.',
	},
	{
		$constant: 'Constant-domain semantics: every world has the same domain.',
		$varying: 'Varying-domain semantics: each world may have its own domain.',
		$cumulative:
			'Cumulative domains: varying, with the domain of each accessible world a superset of its predecessor.',
		$decreasing:
			'Decreasing domains: varying, with the domain of each accessible world a subset of its predecessor.',
	},
	{
		$rigid: 'Rigid designation: a term denotes the same object in every world.',
		$flexible:
			'Flexible designation: a term may denote different objects in different worlds.',
	},
	{
		$local: 'Terms are interpreted in the current world only.',
		$global: 'Terms are interpreted globally across all worlds.',
	},
	{
		$modal_system_K:
			'System K: just the K axiom plus necessitation. Any normal frame.',
		$modal_system_M:
			'System M (usually called T): K + reflexivity. Each world sees itself.',
		$modal_system_B: 'System B: K + reflexivity + symmetry.',
		$modal_system_D:
			'System D: K + seriality. Deontic logic — every world has a successor.',
		$modal_system_S4:
			'System S4: K + reflexivity + transitivity. Common for provability and knowledge.',
		$modal_system_S5:
			'System S5: K + equivalence-relation frames (reflexive + symmetric + transitive).',
	},
	{
		$modal_axiom_K:
			'Axiom K: □(A→B) → (□A → □B). Distribution of □ over implication — holds in every normal modal logic.',
		$modal_axiom_M:
			'Axiom M (a.k.a. T): □A → A. Characterises reflexive frames.',
		$modal_axiom_B: 'Axiom B: A → □◇A. Characterises symmetric frames.',
		$modal_axiom_D:
			'Axiom D: □A → ◇A. Characterises serial frames (every world has a successor).',
		$modal_axiom_4: 'Axiom 4: □A → □□A. Characterises transitive frames.',
		$modal_axiom_5: 'Axiom 5: ◇A → □◇A. Characterises Euclidean frames.',
	},
	{
		$reflexivity: 'Reflexive: ∀t. t R t.',
		$irreflexivity: 'Irreflexive: ∀t. ¬(t R t).',
		$transitivity: 'Transitive: ∀t,u,v. t R u ∧ u R v → t R v.',
		$asymmetry: 'Asymmetric: ∀t,u. t R u → ¬(u R t).',
		$anti_symmetry: 'Antisymmetric: ∀t,u. t R u ∧ u R t → t = u.',
		$linearity:
			'Linear / total: ∀t,u. t R u ∨ u R t ∨ t = u. Time is a single line.',
		$forward_linearity:
			'No forward branching: distinct successors of a moment are themselves R-comparable.',
		$backward_linearity:
			'No backward branching: distinct predecessors of a moment are themselves R-comparable.',
		$beginning: 'Time has a first moment: ∃t. ∀u ≠ t. t R u.',
		$end: 'Time has a last moment: ∃t. ∀u ≠ t. u R t.',
		$no_beginning: 'Time extends infinitely into the past (no first moment).',
		$no_end: 'Time extends infinitely into the future (no last moment).',
		$density:
			'Dense: ∀t,u. t R u → ∃v. t R v ∧ v R u. Between any two moments lies a third (like ℚ).',
		$forward_discreteness:
			'Every moment with a successor has an immediate successor (like ℤ forwards).',
		$backward_discreteness:
			'Every moment with a predecessor has an immediate predecessor (like ℤ backwards).',
	},
	{
		$quotient_e:
			'Euclidean integral quotient: result with non-negative remainder.',
		$quotient_t:
			'Truncated integral quotient: round the real quotient toward zero.',
		$quotient_f: 'Floor integral quotient: round the real quotient toward −∞.',
		$remainder_e: 'Euclidean remainder, paired with $quotient_e.',
		$remainder_t: 'Truncated remainder, paired with $quotient_t.',
		$remainder_f: 'Floor remainder, paired with $quotient_f.',
		$floor: "Floor: the largest integral value (in the argument's type) not greater than the argument.",
		$ceiling:
			"Ceiling: the smallest integral value (in the argument's type) not less than the argument.",
		$truncate:
			"Truncate toward zero: integral value with magnitude not exceeding the argument's absolute value.",
		$round: 'Round to nearest integral value; ties go to the nearest even integer.',
	},
	{
		$ite: '$ite(Cond, Then, Else) — conditional expression (TXF/THF). First argument is a boolean, the other two share a type which is the result type.',
		$let: "$let(Types, Defns, Body) — local definitions usable inside Body (TXF/THF). Types declare the local symbols' types; Defns bind them.",
	},
);

// ─── Shared Monaco providers (registered once per page) ───────────────────

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

			if (TPTP_KEYWORDS[name]) {
				return {
					range,
					contents: [
						{ value: `**${name}** — TPTP keyword` },
						{ value: TPTP_KEYWORDS[name] },
					],
				};
			}

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

export function diagToMarker(d) {
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

// ─── Built-in theme list ──────────────────────────────────────────────────

const BUILTIN_THEMES = {
	vs: 'Visual Studio Light',
	'vs-dark': 'Visual Studio Dark',
	'hc-black': 'High Contrast Dark',
};

// ─── TptpEditor ───────────────────────────────────────────────────────────

/**
 * Base TPTP editor: Monaco editor with TPTP syntax, linting, theme switching,
 * and TPTP4X toggle. ATP-solver concerns (system select, timeout, solve button,
 * preview output) live in SystemOnTptpEditor.
 *
 * Payload fields used by this class: problem_str, theme, tptp4x_enabled.
 */
export default class TptpEditor {
	constructor(container, ctx, payload) {
		this._ctx = ctx;
		this._payload = payload;
		this._lintTimer = null;
		this._editor = null;
		this._root = null;

		ensureTptpProviders();
		this._mount(container);
	}

	// ─── Overridable: header ─────────────────────────────────────────────

	/**
	 * Return an HTML string for the left part of the header row (before the
	 * settings hamburger). Override together with bindHeader() to add controls
	 * such as a solver select or a run button.
	 */
	renderHeader() {
		return '';
	}

	/**
	 * Bind event listeners for elements produced by renderHeader().
	 * Called once during construction, after the DOM is ready.
	 */
	bindHeader() {}

	// ─── Overridable: settings panel ─────────────────────────────────────

	/**
	 * Return an HTML string for the settings panel contents.
	 * Always include _renderThemeSelect() and _renderTptp4xToggle() — the base
	 * class auto-binds whichever of those are present in the DOM.
	 */
	renderSettings() {
		return `
			<h3 class="text-sm font-semibold m-0 mb-3 text-gray-700">Configuration</h3>
			${this._renderThemeSelect()}
			${this._renderTptp4xToggle()}`;
	}

	/**
	 * Bind event listeners for any extra settings elements beyond the required
	 * theme-select and tptp4x-toggle (those are always handled by the base class).
	 */
	bindSettings() {}

	/**
	 * Called by runSolver() and the Ctrl+Enter shortcut. Override in subclasses
	 * that have a solve action; the base implementation is a no-op.
	 */
	runSolver() {}

	// ─── Protected helpers for renderSettings overrides ──────────────────

	_renderThemeSelect() {
		return `
			<div class="flex flex-col mb-3">
				<label class="text-xs font-semibold text-gray-600 mb-1">Editor Theme</label>
				<select data-tptp="theme-select" class="w-full p-2 text-sm border border-gray-300 rounded bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
					<option value="${this._payload.theme}">${this._payload.theme}</option>
				</select>
			</div>`;
	}

	_renderTptp4xToggle() {
		return `
			<label class="flex items-center gap-2 cursor-pointer">
				<input data-tptp="tptp4x-toggle" type="checkbox" ${this._payload.tptp4x_enabled !== false ? 'checked' : ''} class="cursor-pointer">
				<span class="text-xs font-semibold text-gray-600">Check via TPTP4X</span>
			</label>`;
	}

	// ─── Public API ───────────────────────────────────────────────────────

	async applyTheme(themeName) {
		if (BUILTIN_THEMES[themeName]) {
			monaco.editor.setTheme(themeName);
			return;
		}
		const themeId = themeName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
		try {
			const response = await fetch(
				`./themes/${encodeURIComponent(themeName)}.json`,
			);
			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);
			const themeData = await response.json();
			monaco.editor.defineTheme(themeId, themeData);
			monaco.editor.setTheme(themeId);
		} catch (err) {
			console.error('Failed to load theme:', themeName, err);
			monaco.editor.setTheme('vs');
		}
	}

	get editor() {
		return this._editor;
	}

	// ─── Private ──────────────────────────────────────────────────────────

	_q(sel) {
		return this._root.querySelector(sel);
	}

	_pushUpdate(key, value) {
		this._ctx.pushEvent('update', { [key]: value });
	}

	_scheduleLint() {
		if (this._lintTimer) clearTimeout(this._lintTimer);
		this._lintTimer = setTimeout(() => {
			this._lintTimer = null;
			this._ctx.pushEvent('check_syntax', {
				problem: this._editor.getValue(),
			});
		}, 500);
	}

	_updateStatusBar(diags) {
		const statusBar = this._q('[data-tptp="status-bar"]');
		const errors = diags.filter((d) => d.severity === 'error').length;
		const warnings = diags.filter((d) => d.severity === 'warning').length;

		if (errors === 0 && warnings === 0) {
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
	}

	_mount(container) {
		this._root = container;
		container.innerHTML = `
			<link rel="stylesheet" href="system_on_tptp_assets.css">
			<div data-tptp="inner" class="font-sans p-4 bg-gray-50 border border-gray-200 rounded-lg relative text-gray-700 box-border">
				<div class="flex items-center justify-between mb-3">
					<div data-tptp="header-slot" class="flex-1"></div>
					<button data-tptp="menu-toggle" class="p-2 text-gray-500 bg-transparent border-none cursor-pointer ml-4 mt-5 hover:text-gray-800 transition-colors">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
						</svg>
					</button>
				</div>

				<div data-tptp="settings-panel" class="absolute top-16 right-4 w-64 bg-white border border-gray-200 rounded shadow-lg p-4 z-50 hidden"></div>

				<div class="mt-2 border border-gray-300 rounded overflow-hidden" phx-update="ignore">
					<div data-tptp="editor-container" style="height: 200px; width: 100%;"></div>
				</div>

				<div data-tptp="status-bar" class="mt-1 text-xs text-gray-500 flex items-center gap-2 h-4"></div>
			</div>`;

		this._q('[data-tptp="header-slot"]').innerHTML = this.renderHeader();
		this._q('[data-tptp="settings-panel"]').innerHTML =
			this.renderSettings();

		// Hook for subclasses to append extra DOM (e.g. a preview container)
		// before the editor and event bindings are set up.
		this._mountExtras();

		this._createEditor();
		this._bindCore();
		this._bindThemeSelect();
		this._bindTptp4xToggle();
		this.bindHeader();
		this.bindSettings();
	}

	// Override to inject additional DOM into [data-tptp="inner"] before
	// the editor is created and event listeners are attached.
	_mountExtras() {}

	_createEditor() {
		const editorContainer = this._q('[data-tptp="editor-container"]');
		editorContainer.addEventListener('keydown', (e) =>
			e.stopPropagation(),
		);

		this._editor = monaco.editor.create(editorContainer, {
			value: this._payload.problem_str,
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

		this.applyTheme(this._payload.theme || 'vs');
		window.__tptpSymbolsByModel.set(this._editor.getModel(), []);

		const observer = new MutationObserver((mutations, obs) => {
			const imeTextArea = editorContainer.querySelector('.ime-text-area');
			if (imeTextArea) {
				imeTextArea.setAttribute('id', 'monaco-ime-input');
				imeTextArea.setAttribute('name', 'monaco-ime-input');
				obs.disconnect();
			}
		});
		observer.observe(editorContainer, { childList: true, subtree: true });
	}

	_bindCore() {
		const ctx = this._ctx;
		const settingsPanel = this._q('[data-tptp="settings-panel"]');
		const menuToggle = this._q('[data-tptp="menu-toggle"]');

		menuToggle.addEventListener('click', () =>
			settingsPanel.classList.toggle('hidden'),
		);
		this._editor.onDidFocusEditorText(() =>
			settingsPanel.classList.add('hidden'),
		);

		ctx.handleEvent('lint_result', ({ diagnostics, symbols }) => {
			const markers = (diagnostics || []).map(diagToMarker);
			monaco.editor.setModelMarkers(
				this._editor.getModel(),
				'tptp-lint',
				markers,
			);
			window.__tptpSymbolsByModel.set(
				this._editor.getModel(),
				symbols || [],
			);
			this._updateStatusBar(diagnostics || []);
		});

		this._editor.onDidChangeModelContent(() => {
			this._pushUpdate('problem_str', this._editor.getValue());
			this._scheduleLint();
		});

		this._editor.addCommand(
			monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
			() => this.runSolver(),
		);

		this._scheduleLint();
	}

	_bindThemeSelect() {
		const themeSelect = this._q('[data-tptp="theme-select"]');
		if (!themeSelect) return;

		let opts = '';
		Object.entries(BUILTIN_THEMES).forEach(
			([id, name]) => (opts += `<option value="${id}">${name}</option>`),
		);
		Object.entries(themeList).forEach(
			([_id, name]) =>
				(opts += `<option value="${name}">${name}</option>`),
		);
		themeSelect.innerHTML = opts;
		themeSelect.value = this._payload.theme || 'vs';

		themeSelect.addEventListener('change', (e) => {
			this.applyTheme(e.target.value);
			this._pushUpdate('theme', e.target.value);
		});
	}

	_bindTptp4xToggle() {
		const toggle = this._q('[data-tptp="tptp4x-toggle"]');
		if (!toggle) return;
		toggle.addEventListener('change', (e) => {
			this._pushUpdate('tptp4x_enabled', e.target.checked);
			this._scheduleLint();
		});
	}
}
