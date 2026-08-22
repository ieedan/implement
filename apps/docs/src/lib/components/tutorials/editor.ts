import { Div, If, Implement, Pre, signal, type Mountable, type Writable } from "@implementjs/core";

/**
 * The code editor, with CodeMirror loaded on demand.
 *
 * CodeMirror is the single heaviest thing the docs ship, and `Typeset` renders
 * an editor for every live demo — so a static import put the whole editor in
 * the graph of every docs page, including the ones with nothing editable on
 * them. What renders first is the static stand-in below, which the server
 * already had to render anyway; the real pane swaps in once
 * {@link ./editor-view.ts} arrives.
 */

/** Shared with the CodeMirror theme, so the two panes sit on the same metrics. */
export const editorFontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

// Static stand-in for the CodeMirror pane: the code in a plain <pre> behind a
// line-number gutter, on the same metrics as the theme in `editor-view.ts`
// (13px mono, 1.65 line height, 8px vertical padding), so the swap happens
// without a shift. `.editor-fallback` sizing lives in app.css beside the
// `.cm-editor` rules it mirrors.
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

export type CodeEditorOptions = {
	/** Show the code without letting the reader change it (docs source views). */
	readOnly?: boolean;
};

type EditorViewModule = typeof import("./editor-view");

/** Resolved once the chunk has landed; every pane on the page shares it. */
let editorView: EditorViewModule | null = null;
let editorViewRequest: Promise<EditorViewModule> | null = null;

/** Pulls the CodeMirror chunk in, joining a load already in flight. */
function loadEditorView(): Promise<EditorViewModule> {
	editorViewRequest ??= import("./editor-view").then((module) => {
		editorView = module;
		return module;
	});
	return editorViewRequest;
}

export function CodeEditor(value: Writable<string>, options: CodeEditorOptions = {}): Mountable {
	// browser-only pane: CodeMirror needs a real DOM — the server renders the
	// static stand-in, and nothing swaps it
	if (typeof document === "undefined") return EditorFallback(value.get());

	const ready = signal(false);

	// `ready` starts false even when the chunk is already resolved, and the
	// swap is left to a microtask: hydration claims the same stand-in the
	// server rendered, and only then does the live pane replace it.
	return Implement.Lifecycle(
		{
			onMount: () => {
				let cancelled = false;
				void loadEditorView().then(() => {
					if (!cancelled) ready.set(true);
				});
				return () => {
					cancelled = true;
				};
			},
		},
		If(ready)
			.Then((): ReturnType<Mountable> => {
				// only reachable once the import above resolved
				if (editorView === null) throw new Error("editor chunk resolved without a module");
				return editorView.EditorPane(value, options)();
			})
			.Else((): ReturnType<Mountable> => EditorFallback(value.get())()),
	);
}
