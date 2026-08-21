import { Div, P, Span } from "@implementjs/core";
import { MonitorIcon, MoonIcon, SunIcon } from "@implementjs/lucide";
import { createModeManager, type Mode } from "@implementjs/primitives";
import { Button } from "@/lib/components/ui/button";

// A real app mounts `ModeWatcher({ manager })` at the root and lets the manager
// put the class on `<html>`. This demo only reads the manager, so the preview
// below changes instead of the page around it.
const manager = createModeManager({ modeStorageKey: "docs-mode-demo" });

const choices = [
	{ mode: "light", label: "Light", icon: SunIcon },
	{ mode: "system", label: "System", icon: MonitorIcon },
	{ mode: "dark", label: "Dark", icon: MoonIcon },
] satisfies { mode: Mode; label: string; icon: typeof SunIcon }[];

export default function ModeWatcherDemo() {
	return Div(
		{ class: "flex w-full max-w-sm flex-col gap-4" },
		Div(
			{ class: "flex items-center justify-center gap-2" },
			...choices.map(({ mode, label, icon: Icon }) =>
				Button(
					{
						variant: "outline",
						size: "sm",
						"aria-pressed": manager.userPrefersMode.bind((current) => current === mode),
						class: manager.userPrefersMode.bind((current) =>
							current === mode ? "bg-accent text-accent-foreground" : "",
						),
						onClick: () => manager.setMode(mode),
					},
					Icon({ "aria-hidden": true }),
					label,
				),
			),
		),
		Div(
			{
				class: [
					"flex flex-col gap-3 rounded-lg border p-4 transition-colors",
					manager.mode.bind((mode) =>
						mode === "light"
							? "border-neutral-200 bg-white text-neutral-900"
							: "border-neutral-800 bg-neutral-950 text-neutral-50",
					),
				],
			},
			P({ class: "text-sm font-medium" }, "Good afternoon"),
			P(
				{
					class: [
						"text-sm",
						manager.mode.bind((mode) =>
							mode === "light" ? "text-neutral-500" : "text-neutral-400",
						),
					],
				},
				"Every color here follows the manager's mode.",
			),
			Div(
				{ class: "flex gap-2" },
				...["bg-sky-500", "bg-emerald-500", "bg-amber-500"].map((color) =>
					Div({ class: ["size-6 rounded-full", color] }),
				),
			),
		),
		P(
			{ class: "text-center text-xs text-muted-foreground" },
			"rendering ",
			Span(
				{ class: "font-medium" },
				manager.mode.bind((mode) => mode ?? "…"),
			),
			" · your system prefers ",
			Span(
				{ class: "font-medium" },
				manager.systemPrefersMode.bind((mode) => mode ?? "…"),
			),
		),
	);
}
