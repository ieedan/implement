import {
	Button,
	derived,
	Div,
	If,
	signal,
	Span,
	Svg,
	type Mountable,
	type Writable,
} from "@implementjs/core";
import type { ConsoleEntry } from "../../lib/console-format";
import { ConsolePanel } from "./console-panel";
import { CodeEditor } from "./editor";
import { icons } from "./icons";
import { LessonPreview } from "./preview";

export type PlaygroundOptions = {
	/** Open the console panel initially. */
	consoleOpen?: boolean;
	/** Dock the console beside the preview instead of below it. */
	splitRight?: boolean;
};

export function Playground(code: Writable<string>, options: PlaygroundOptions = {}): Mountable {
	const tick = signal(0);
	const logs = signal<ConsoleEntry[]>([]);
	const consoleOpen = signal(options.consoleOpen ?? false);
	const splitRight = signal(options.splitRight ?? false);

	const hasErrors = derived([logs, consoleOpen], (entries, open) => {
		return !open && entries.some((entry) => entry.level === "error");
	});

	// Stacked console borrows height from the editor (5:3 becomes 5:3:2); the
	// side-by-side console shares the preview row instead.
	const previewGroupClass = derived([consoleOpen, splitRight], (open, right) => {
		return `flex min-h-0 min-w-0 ${open && !right ? "flex-[5]" : "flex-[3]"} ${right ? "flex-row" : "flex-col"}`;
	});
	const consoleGroupClass = derived([splitRight], (right) => {
		return `flex min-h-0 min-w-0 flex-[2] flex-col border-border ${right ? "border-l" : "border-t"}`;
	});

	return Div(
		{ class: "flex min-h-0 min-w-0 flex-1 flex-col" },
		Div(
			{ class: "flex min-h-0 flex-[5] flex-col border-b border-border" },
			Div(
				{ class: "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3" },
				Span(
					{
						class:
							"rounded-md bg-foreground/10 px-2 py-0.5 font-mono text-[11px] text-foreground/80",
					},
					"index.ts",
				),
			),
			Div({ class: "min-h-0 flex-1" }, CodeEditor(code)),
		),
		Div(
			{ class: previewGroupClass },
			Div(
				{ class: "flex min-h-0 min-w-0 flex-[3] flex-col" },
				Div(
					{ class: "flex h-9 shrink-0 items-center justify-between border-b border-border px-3" },
					Span(
						{ class: "text-[11px] font-medium uppercase tracking-wide text-foreground/40" },
						"Preview",
					),
					Div(
						{ class: "flex items-center gap-1" },
						Button(
							{
								type: "button",
								class:
									"relative rounded-md p-1 text-foreground/50 hover:bg-foreground/5 hover:text-foreground",
								"aria-label": "Toggle console",
								"aria-expanded": derived([consoleOpen], (open) => (open ? "true" : "false")),
								onClick: () => consoleOpen.toggle(),
							},
							Svg(icons.terminal, { class: "size-3.5" }),
							If(hasErrors).Then(
								Span({
									class: "absolute right-0 top-0 size-1.5 rounded-full bg-red-400",
								}),
							),
						),
						Button(
							{
								type: "button",
								class:
									"rounded-md p-1 text-foreground/50 hover:bg-foreground/5 hover:text-foreground",
								"aria-label": "Reload preview",
								onClick: () => tick.increment(),
							},
							Svg(icons.refresh, { class: "size-3.5" }),
						),
					),
				),
				Div({ class: "min-h-0 flex-1" }, LessonPreview(code, tick, logs)),
			),
			If(consoleOpen).Then(
				Div(
					{ class: consoleGroupClass },
					ConsolePanel(logs, () => consoleOpen.set(false), splitRight),
				),
			),
		),
	);
}
