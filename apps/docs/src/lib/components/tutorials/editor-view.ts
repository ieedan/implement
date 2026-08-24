import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { IMountable, Mountable, Writable } from "@implementjs/core";
import { basicSetup } from "codemirror";
import { mode } from "@/lib/mode";
import { editorFontFamily, type CodeEditorOptions } from "./editor";

/**
 * The CodeMirror half of the editor, split out so it can be loaded on demand.
 *
 * With everything in one module the whole of CodeMirror sat in the static
 * import graph of `Typeset`, which every docs page renders — over a megabyte
 * of editor on pages that hold no editable anything. `CodeEditor` imports this
 * dynamically instead and shows its static stand-in until the chunk lands.
 */

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
	// The metrics sit on the scroller, not on `.cm-content`: the gutters are a
	// sibling of the content, so anything set only on the content leaves the
	// line numbers at the page's own font — bigger than the code beside them.
	".cm-scroller": {
		fontFamily: editorFontFamily,
		fontSize: "13px",
		lineHeight: "1.65",
	},
	".cm-content": {
		caretColor: "var(--editor-foreground)",
		padding: "8px 0",
	},
	// The gutters stay put while the code scrolls under them, so they need an
	// opaque background — transparent ones let long lines slide through the
	// line numbers, which is what a narrow (phone-width) pane does constantly.
	".cm-gutters": {
		backgroundColor: "var(--background)",
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

/** The live editor pane. Browser only — CodeMirror needs a real DOM. */
export function EditorPane(value: Writable<string>, options: CodeEditorOptions = {}): Mountable {
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
							EditorState.readOnly.of(options.readOnly === true),
							// a blinking caret in a read-only pane reads as an invitation to type
							EditorView.editable.of(options.readOnly !== true),
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
