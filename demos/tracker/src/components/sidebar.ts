import { Button, Div, Span } from "@packages/ui";
import { cx } from "../lib/cx";
import { navigate } from "../lib/router";
import { store } from "../state/store";
import { activeView, openCreateDialog, VIEWS, type ViewMeta } from "../state/ui";
import { Avatar } from "./ui/avatar";
import { Icon } from "./ui/icon";

function NavItem(view: ViewMeta) {
	return Button(
		Icon(view.icon, "h-4 w-4"),
		Span().content(view.label).className("min-w-0 flex-1 truncate text-left"),
		Span()
			.content(
				() =>
					`${store.issues.filter((issue) => view.filter(issue, store.currentUser?.id ?? null)).length}`,
			)
			.className("text-xs tabular-nums text-zinc-500"),
	)
		.type("button")
		.className([activeView], (active) =>
			cx(
				"flex h-8 w-full select-none items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-100 focus:outline-none",
				active === view.id
					? "bg-zinc-800 text-zinc-100"
					: "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
			),
		)
		.on("click", () => {
			activeView.set(view.id);
			navigate({ name: "list" });
		});
}

export function Sidebar() {
	return Div(
		Div(
			Div()
				.content("T")
				.className(
					"flex h-6 w-6 select-none items-center justify-center rounded-md bg-indigo-500 text-[13px] font-bold text-white",
				),
			Span().content("Tracker").className("text-sm font-semibold text-zinc-100"),
		).className("flex h-14 items-center gap-2.5 px-4"),

		Div(
			Button(Icon("plus", "h-4 w-4"), Span().content("New issue"))
				.type("button")
				.className(
					"flex h-8 w-full select-none items-center gap-2 rounded-md border border-zinc-700/80 bg-zinc-900 px-2.5 text-[13px] font-medium text-zinc-200 transition-colors duration-150 hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
				)
				.on("click", () => openCreateDialog()),
		).className("px-3"),

		Div(...VIEWS.map((view) => NavItem(view))).className("mt-5 flex flex-col gap-0.5 px-3"),

		Div().className("flex-1"),

		Div(
			Avatar(store.currentUser, "md"),
			Span()
				.content(store.currentUser?.name ?? "Anonymous")
				.className("min-w-0 flex-1 truncate text-[13px] text-zinc-300"),
		).className("flex items-center gap-2.5 border-t border-zinc-800/80 px-4 py-3"),
	).className("flex w-60 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-900/30");
}
