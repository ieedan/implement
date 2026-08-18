import { Button, derived, Div, Span, type Child, type Mountable } from "@implementjs/core";
import { router } from "../router";
import { currentUser, issues } from "../state/store";
import { openCreateDialog, VIEWS, type ViewMeta } from "../state/ui";
import { Avatar } from "./ui/avatar";
import { Icon } from "./ui/icon";

// The router's Link sets aria-current="page" while its route is active, so
// active styling is pure CSS.
const navClass =
	"flex h-8 w-full select-none items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-100 focus:outline-none text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 aria-[current=page]:bg-zinc-800 aria-[current=page]:text-zinc-100";

function NavItem(view: ViewMeta): Mountable {
	const count = derived([issues, currentUser], (issues, me) => {
		return issues.filter((issue) => view.filter(issue, me?.id ?? null)).length;
	});

	const contents: Child[] = [
		Icon(view.icon, "h-4 w-4"),
		Span({ class: "min-w-0 flex-1 truncate text-left" }, view.label),
		Span({ class: "text-xs tabular-nums text-zinc-500" }, count),
	];

	return view.id === "all"
		? router.Link({ to: "/", class: navClass }, ...contents)
		: router.Link({ to: "/views/:view", params: { view: view.id }, class: navClass }, ...contents);
}

export function Sidebar(): Mountable {
	return Div(
		{ class: "flex w-60 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-900/30" },
		Div(
			{ class: "flex h-14 items-center gap-2.5 px-4" },
			Div(
				{
					class:
						"flex h-6 w-6 select-none items-center justify-center rounded-md bg-indigo-500 text-[13px] font-bold text-white",
				},
				"T",
			),
			Span({ class: "text-sm font-semibold text-zinc-100" }, "Tracker"),
		),

		Div(
			{ class: "px-3" },
			Button(
				{
					type: "button",
					class:
						"flex h-8 w-full select-none items-center gap-2 rounded-md border border-zinc-700/80 bg-zinc-900 px-2.5 text-[13px] font-medium text-zinc-200 transition-colors duration-150 hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
					onClick: () => openCreateDialog(),
				},
				Icon("plus", "h-4 w-4"),
				Span({}, "New issue"),
			),
		),

		Div({ class: "mt-5 flex flex-col gap-0.5 px-3" }, ...VIEWS.map((view) => NavItem(view))),

		Div({ class: "flex-1" }),

		Div(
			{ class: "flex items-center gap-2.5 border-t border-zinc-800/80 px-4 py-3" },
			Avatar(currentUser.get(), "md"),
			Span(
				{ class: "min-w-0 flex-1 truncate text-[13px] text-zinc-300" },
				currentUser.get()?.name ?? "Anonymous",
			),
		),
	);
}
