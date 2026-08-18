import { Button, Div, signal, Span, Svg, type Mountable, type Writable } from "@packages/implement";
import { CodeEditor } from "./editor";
import { icons } from "./icons";
import { LessonPreview } from "./preview";

export function Playground(code: Writable<string>): Mountable {
	const tick = signal(0);

	return Div(
		{ class: "flex min-h-0 min-w-0 flex-1 flex-col" },
		Div(
			{ class: "flex min-h-0 flex-1 flex-col border-b border-border" },
			Div(
				{ class: "flex h-9 shrink-0 items-center gap-2 border-b border-border px-3" },
				Span(
					{
						class: "rounded-md bg-foreground/10 px-2 py-0.5 font-mono text-[11px] text-foreground/80",
					},
					"code.ts",
				),
			),
			Div({ class: "min-h-0 flex-1" }, CodeEditor(code)),
		),
		Div(
			{ class: "flex min-h-0 flex-1 flex-col" },
			Div(
				{ class: "flex h-9 shrink-0 items-center justify-between border-b border-border px-3" },
				Span(
					{ class: "text-[11px] font-medium uppercase tracking-wide text-foreground/40" },
					"Preview",
				),
				Button(
					{
						type: "button",
						class: "rounded-md p-1 text-foreground/50 hover:bg-foreground/5 hover:text-foreground",
						"aria-label": "Reload preview",
						onClick: () => tick.increment(),
					},
					Svg(icons.refresh, { class: "size-3.5" }),
				),
			),
			Div({ class: "min-h-0 flex-1" }, LessonPreview(code, tick)),
		),
	);
}
