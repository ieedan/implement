import {
	Button,
	derived,
	Div,
	ForEach,
	If,
	Ref,
	Span,
	watch,
	type Mountable,
	type Readable,
	type Signal,
} from "@implementjs/core";
import type { ConsoleEntry, ConsoleLevel } from "../../lib/console-format";
import { BanIcon, PanelBottomIcon, PanelRightIcon, XIcon } from "@implementjs/lucide";

const levelClass: Record<ConsoleLevel, string> = {
	log: "text-foreground/80",
	info: "text-foreground/80",
	debug: "text-foreground/50",
	warn: "text-amber-300",
	error: "text-red-300",
};

const badgeClass: Record<ConsoleLevel, string> = {
	log: "bg-foreground/15 text-foreground/70",
	info: "bg-foreground/15 text-foreground/70",
	debug: "bg-foreground/15 text-foreground/70",
	warn: "bg-amber-500/25 text-amber-200",
	error: "bg-red-500/25 text-red-200",
};

const iconButton = "rounded-md p-1 text-foreground/50 hover:bg-foreground/5 hover:text-foreground";

export function ConsolePanel(
	logs: Signal<ConsoleEntry[]>,
	onClose: () => void,
	splitRight: Signal<boolean>,
): Mountable {
	const scroller = new Ref<HTMLElement>();
	const entries: Readable<ConsoleEntry[]> = logs;

	// Pin the view to the latest entry. ForEach reconciles in its own
	// subscription, so defer the scroll until after this frame renders.
	watch([entries], () => {
		if (typeof requestAnimationFrame === "undefined") return;
		requestAnimationFrame(() => {
			const el = scroller.get();
			if (el != null) el.scrollTop = el.scrollHeight;
		});
	});

	return Div(
		{ class: "flex min-h-0 min-w-0 flex-1 flex-col" },
		Div(
			{ class: "flex h-9 shrink-0 items-center gap-1 border-b border-border px-3" },
			Span(
				{ class: "flex-1 text-[11px] font-medium uppercase tracking-wide text-foreground/40" },
				"Console",
			),
			Button(
				{
					type: "button",
					class: iconButton,
					"aria-label": derived([splitRight], (right) =>
						right ? "Dock console below the preview" : "Dock console beside the preview",
					),
					onClick: () => splitRight.toggle(),
				},
				If(splitRight)
					.Then(PanelBottomIcon({ class: "size-3.5" }))
					.Else(PanelRightIcon({ class: "size-3.5" })),
			),
			Button(
				{
					type: "button",
					class: iconButton,
					"aria-label": "Clear console",
					onClick: () => logs.set([]),
				},
				BanIcon({ class: "size-3.5" }),
			),
			Button(
				{
					type: "button",
					class: iconButton,
					"aria-label": "Close console",
					onClick: onClose,
				},
				XIcon({ class: "size-3.5" }),
			),
		),
		Div(
			{ this: scroller, class: "min-h-0 flex-1 overflow-auto font-mono text-xs" },
			If(derived([entries], (list) => list.length === 0)).Then(
				Div({ class: "px-3 py-2 text-foreground/30" }, "No output yet."),
			),
			ForEach(
				entries,
				(entry) => String(entry.id),
				(entry) =>
					Div(
						{
							class: derived(
								[entry],
								(value) =>
									`flex items-start gap-2 border-b border-border/50 px-3 py-1 ${levelClass[value.level]}`,
							),
						},
						If(derived([entry], (value) => value.count > 1)).Then(
							Span(
								{
									class: derived(
										[entry],
										(value) =>
											`shrink-0 rounded-full px-1.5 text-[10px] leading-4 ${badgeClass[value.level]}`,
									),
								},
								derived([entry], (value) => String(value.count)),
							),
						),
						Div(
							{ class: "min-w-0 flex-1" },
							Div(
								{ class: "whitespace-pre-wrap break-words" },
								derived([entry], (value) => value.text),
							),
							If(derived([entry], (value) => value.stack.length > 0)).Then(
								Div(
									{ class: "overflow-x-auto whitespace-pre pl-4 pt-0.5 text-foreground/40" },
									derived([entry], (value) => value.stack.join("\n")),
								),
							),
						),
						If(derived([entry], (value) => value.location != null)).Then(
							Span(
								{ class: "shrink-0 text-foreground/30" },
								derived([entry], (value) => value.location ?? ""),
							),
						),
					),
			),
		),
	);
}
