import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { Div, Pre, type IMountable, type Mountable, type Writable } from "@implementjs/core";
import { basicSetup } from "codemirror";

const editorFontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

const highlight = HighlightStyle.define([
	{ tag: t.keyword, color: "#c4b5fd" },
	{ tag: t.string, color: "#86efac" },
	{ tag: t.number, color: "#fcd34d" },
	{ tag: t.bool, color: "#fcd34d" },
	{ tag: t.null, color: "#fcd34d" },
	{ tag: t.comment, color: "#737373", fontStyle: "italic" },
	{ tag: t.function(t.variableName), color: "#93c5fd" },
	{ tag: t.definition(t.variableName), color: "#e5e5e5" },
	{ tag: t.typeName, color: "#7dd3fc" },
	{ tag: t.className, color: "#7dd3fc" },
	{ tag: t.propertyName, color: "#e5e5e5" },
	{ tag: t.operator, color: "#a3a3a3" },
	{ tag: t.punctuation, color: "#a3a3a3" },
]);

const theme = EditorView.theme(
	{
		"&": {
			backgroundColor: "transparent",
			color: "#fff",
			height: "100%",
		},
		".cm-content": {
			caretColor: "#fff",
			fontFamily: editorFontFamily,
			fontSize: "13px",
			lineHeight: "1.65",
			padding: "8px 0",
		},
		".cm-gutters": {
			backgroundColor: "transparent",
			color: "#555",
			border: "none",
		},
		".cm-activeLine": { backgroundColor: "#ffffff08" },
		".cm-activeLineGutter": { backgroundColor: "transparent", color: "#888" },
		"&.cm-focused": { outline: "none" },
		".cm-selectionBackground": {
			backgroundColor: "#ffffff24",
		},
		"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
			backgroundColor: "#ffffff24",
		},
		".cm-cursor": { borderLeftColor: "#fff" },
	},
	{ dark: true },
);

// Static server-side stand-in for the CodeMirror pane: the code in a plain
// <pre> behind a line-number gutter, on the same metrics as the theme above
// (13px mono, 1.65 line height, 8px vertical padding), so the client mount
// swaps it out without a shift. `.editor-fallback` sizing lives in app.css
// beside the `.cm-editor` rules it mirrors.
function EditorFallback(code: string): Mountable {
	const lines = code.replace(/\n$/, "").split("\n");
	return Div(
		{
			class: "editor-fallback h-full min-h-0 overflow-auto",
			style: {
				display: "flex",
				alignItems: "flex-start",
				color: "#fff",
				fontFamily: editorFontFamily,
				fontSize: "13px",
				lineHeight: "1.65",
				padding: "8px 0",
				tabSize: "4",
			},
		},
		Div(
			{
				"aria-hidden": "true",
				style: {
					color: "#555",
					flexShrink: "0",
					minWidth: "20px",
					padding: "0 3px 0 5px",
					textAlign: "right",
					whiteSpace: "pre",
				},
			},
			lines.map((_, index) => index + 1).join("\n"),
		),
		Pre(
			{
				style: {
					flex: "1",
					margin: "0",
					overflowX: "auto",
					padding: "0 2px 0 6px",
					fontFamily: "inherit",
					fontSize: "inherit",
					lineHeight: "inherit",
				},
			},
			code,
		),
	);
}

export function CodeEditor(value: Writable<string>): Mountable {
	// browser-only pane: CodeMirror needs a real DOM — the server renders a
	// static stand-in of the code that the client mount replaces
	if (typeof document === "undefined") return EditorFallback(value.get());

	return (): IMountable => {
		let parent: HTMLElement | null = null;
		let view: EditorView | null = null;
		let unsubscribe: (() => void) | null = null;

		return {
			mount(host: HTMLElement) {
				parent = document.createElement("div");
				parent.className = "tutorial-editor h-full min-h-0";
				host.appendChild(parent);

				view = new EditorView({
					parent,
					state: EditorState.create({
						doc: value.get(),
						extensions: [
							basicSetup,
							javascript({ typescript: true }),
							// match oxfmt (useTabs: true): indent with real tabs
							indentUnit.of("\t"),
							EditorState.tabSize.of(4),
							syntaxHighlighting(highlight),
							theme,
							keymap.of([indentWithTab]),
							EditorView.updateListener.of((update) => {
								if (!update.docChanged) return;
								const next = update.state.doc.toString();
								if (value.get() !== next) value.set(next);
							}),
						],
					}),
				});

				unsubscribe = value.subscribe((next) => {
					if (view == null) return;
					if (view.state.doc.toString() === next) return;
					view.dispatch({
						changes: { from: 0, to: view.state.doc.length, insert: next },
					});
				});
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				view?.destroy();
				view = null;
				parent?.remove();
				parent = null;
			},
			getFirstDomNode() {
				return parent;
			},
		};
	};
}
