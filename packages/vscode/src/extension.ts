// The editor layer: converts between VS Code's API and the plain-text
// analysis in analyze.ts, and owns activation.

import * as vscode from "vscode";

import { suggest, DEFAULTS, type Options, type Suggestion } from "./analyze.ts";
import { clearCaches } from "./signatures.ts";

const LANGUAGES = ["typescript", "javascript", "typescriptreact", "javascriptreact"];

type Mode = "completion" | "auto" | "off";

function readOptions(document: vscode.TextDocument): Options & { mode: Mode } {
	const cfg = vscode.workspace.getConfiguration("implement", document);
	return {
		mode: cfg.get<Mode>("snippets.mode") ?? "completion",
		cursor: cfg.get<Options["cursor"]>("snippets.cursor") ?? DEFAULTS.cursor,
		trailingComma: cfg.get<boolean>("snippets.trailingComma") ?? DEFAULTS.trailingComma,
		requireImport: cfg.get<boolean>("snippets.requireImport") ?? DEFAULTS.requireImport,
		resolveLocalComponents:
			cfg.get<boolean>("snippets.resolveLocalComponents") ?? DEFAULTS.resolveLocalComponents,
		constructs: cfg.get<boolean>("snippets.constructs") ?? DEFAULTS.constructs,
		extraSources: cfg.get<Record<string, string>>("snippets.extraSources") ?? {},
		fileName: document.uri.scheme === "file" ? document.uri.fsPath : undefined,
	};
}

function toCompletionItem(
	document: vscode.TextDocument,
	suggestion: Suggestion,
): vscode.CompletionItem {
	const item = new vscode.CompletionItem(suggestion.label, vscode.CompletionItemKind.Snippet);
	item.insertText = new vscode.SnippetString(suggestion.body);
	item.detail = suggestion.detail;
	if (suggestion.documentation) {
		item.documentation = new vscode.MarkdownString(suggestion.documentation);
	}
	if (suggestion.filterText) item.filterText = suggestion.filterText;
	if (suggestion.preselect) item.preselect = true;
	// A leading space sorts these above the identifier completions that share
	// the position.
	item.sortText = " ";
	item.range = new vscode.Range(
		document.positionAt(suggestion.replace.start),
		document.positionAt(suggestion.replace.end),
	);
	if (suggestion.importEdit) {
		item.additionalTextEdits = [
			vscode.TextEdit.insert(
				document.positionAt(suggestion.importEdit.offset),
				suggestion.importEdit.text,
			),
		];
	}
	return item;
}

const provider: vscode.CompletionItemProvider = {
	provideCompletionItems(document, position) {
		const options = readOptions(document);
		if (options.mode !== "completion") return undefined;

		const found = suggest(document.getText(), document.offsetAt(position), options);
		if (!found.length) return undefined;
		return found.map((suggestion) => toCompletionItem(document, suggestion));
	},
};

// ------------------------------------------------------------------- auto ---

let applying = false;

/**
 * Rewrite as the paren is typed, with no keypress. Experimental: it races
 * auto-closing brackets and coarsens undo, so it is off by default.
 */
function onChange(event: vscode.TextDocumentChangeEvent): void {
	if (applying) return;
	if (event.contentChanges.length !== 1) return;

	const change = event.contentChanges[0];
	if (!change || (change.text !== "(" && change.text !== "()")) return;
	if (change.rangeLength !== 0) return;

	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document !== event.document) return;
	if (!LANGUAGES.includes(event.document.languageId)) return;
	if (readOptions(event.document).mode !== "auto") return;

	// Let auto-closing brackets settle before reading the line back.
	setTimeout(() => {
		const active = vscode.window.activeTextEditor;
		if (!active || active.document !== event.document) return;
		if (!active.selection.isEmpty) return;

		const document = active.document;
		const offset = document.offsetAt(active.selection.active);
		const found = suggest(document.getText(), offset, readOptions(document)).find(
			(s) => s.kind === "props",
		);
		if (!found) return;

		const range = new vscode.Range(
			document.positionAt(found.replace.start),
			document.positionAt(found.replace.end),
		);
		applying = true;
		void Promise.resolve(active.insertSnippet(new vscode.SnippetString(found.body), range))
			.catch(() => undefined)
			.finally(() => {
				applying = false;
			});
	}, 0);
}

// ------------------------------------------------------------------ setup ---

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(LANGUAGES, provider, "("),
		vscode.workspace.onDidChangeTextDocument(onChange),
		// Declarations are read off disk and cached by mtime; saving a component
		// should be reflected without a reload.
		vscode.workspace.onDidSaveTextDocument(() => clearCaches()),
	);
}

export function deactivate(): void {
	clearCaches();
}
