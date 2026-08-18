import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { IMountable, Mountable, Writable } from "@implementjs/core";
import { basicSetup } from "codemirror";

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
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
		"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
			backgroundColor: "#ffffff24",
		},
		".cm-cursor": { borderLeftColor: "#fff" },
	},
	{ dark: true },
);

export function CodeEditor(value: Writable<string>): Mountable {
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
