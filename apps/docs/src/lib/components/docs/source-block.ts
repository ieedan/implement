import { derived, Div, If, signal, Span, type Mountable } from "@implementjs/core";
import { CheckIcon, CopyIcon } from "@implementjs/lucide";
import { copyText } from "@/lib/copy-text";
import { CodeEditor } from "../tutorials/editor";
import { Button } from "../ui/button";

/**
 * One styled component's source, in the same read-only pane the demos use for
 * their code. This is the whole of a manual install — the reader copies the
 * file and drops it in — so the block leads with the path it belongs at and
 * carries a copy button for the file itself.
 */
export function SourceBlock(path: string, source: string): Mountable {
	// the editor takes a writable, but the pane is read-only: nothing ever
	// writes back, so the signal is only ever the file's own text
	const code = signal(source.replace(/\n+$/, ""));
	const copied = signal(false);

	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	const copy = async () => {
		if (!(await copyText(code.get()))) return;
		copied.set(true);
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => copied.set(false), 1500);
	};

	return Div(
		{ class: "overflow-hidden rounded-lg border border-border" },
		Div(
			{ class: "flex items-center gap-2 border-b border-border px-3 py-1.5" },
			Span({ class: "min-w-0 truncate font-mono text-xs text-foreground/60" }, path),
			Button(
				{
					variant: "ghost",
					size: "icon-xs",
					class: "ml-auto shrink-0 text-foreground/60",
					"aria-label": derived([copied], (value) => (value ? "Copied" : "Copy file")),
					onClick: () => void copy(),
				},
				If(copied).Then(CheckIcon()).Else(CopyIcon()),
			),
		),
		Div({ class: "demo-editor" }, CodeEditor(code, { readOnly: true })),
	);
}
