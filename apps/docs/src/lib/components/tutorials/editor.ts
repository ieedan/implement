import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { Div, Pre, type IMountable, type Mountable, type Writable } from "@implementjs/core";
import { basicSetup } from "codemirror";
import { mode } from "@/lib/mode";

const editorFontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

// Every color here is a token from app.css, so the panes follow the site's
// mode without CodeMirror being reconfigured — only the `dark` flag below,
// which extensions read for their own defaults, has to be swapped.
const highlight = HighlightStyle.define([
	{ tag: t.keyword, color: "var(--syntax-keyword)" },
	{ tag: t.string, color: "var(--syntax-string)" },
	{ tag: t.number, color: "var(--syntax-literal)" },
	{ tag: t.bool, color: "var(--syntax-literal)" },
	{ tag: t.null, color: "var(--syntax-literal)" },
	{ tag: t.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
	{ tag: t.function(t.variableName), color: "var(--syntax-function)" },
	{ tag: t.definition(t.variableName), color: "var(--syntax-name)" },
	{ tag: t.typeName, color: "var(--syntax-type)" },
	{ tag: t.className, color: "var(--syntax-type)" },
	{ tag: t.propertyName, color: "var(--syntax-name)" },
	{ tag: t.operator, color: "var(--syntax-punctuation)" },
	{ tag: t.punctuation, color: "var(--syntax-punctuation)" },
]);

const theme = EditorView.theme({
	"&": {
		backgroundColor: "transparent",
		color: "var(--editor-foreground)",
		height: "100%",
	},
	".cm-content": {
		caretColor: "var(--editor-foreground)",
		fontFamily: editorFontFamily,
		fontSize: "13px",
		lineHeight: "1.65",
		padding: "8px 0",
	},
	".cm-gutters": {
		backgroundColor: "transparent",
		color: "var(--editor-gutter)",
		border: "none",
	},
	".cm-activeLine": { backgroundColor: "var(--editor-active-line)" },
	".cm-activeLineGutter": {
		backgroundColor: "transparent",
		color: "var(--editor-gutter-active)",
	},
	"&.cm-focused": { outline: "none" },
	".cm-selectionBackground": {
		backgroundColor: "var(--editor-selection)",
	},
	"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
		backgroundColor: "var(--editor-selection)",
	},
	".cm-cursor": { borderLeftColor: "var(--editor-foreground)" },
});

/**
 * The `dark` flag is what extensions with their own built-in styling (the
 * autocomplete and search panels) read, and it is a facet rather than CSS —
 * so unlike the colors above it has to be reconfigured when the mode changes.
 */
const darkFlag = new Compartment();

function darkFlagFor(current: string | undefined) {
	return EditorView.darkTheme.of(current !== "light");
}

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
				color: "var(--editor-foreground)",
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
					color: "var(--editor-gutter)",
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
		let unsubscribeMode: (() => void) | null = null;

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
							darkFlag.of(darkFlagFor(mode.mode.get())),
							keymap.of([indentWithTab]),
							EditorView.updateListener.of((update) => {
								if (!update.docChanged) return;
								const next = update.state.doc.toString();
								if (value.get() !== next) value.set(next);
							}),
						],
					}),
				});

				unsubscribeMode = mode.mode.onChange((current) => {
					view?.dispatch({ effects: darkFlag.reconfigure(darkFlagFor(current)) });
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
				unsubscribeMode?.();
				unsubscribeMode = null;
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
