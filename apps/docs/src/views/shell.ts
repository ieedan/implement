import { Aside, Div, Header, Main, Nav, type Mountable } from "@packages/implement";
import { router } from "../router";

const navItems = [
	{ to: "/", label: "Introduction" },
	{ to: "/docs/getting-started", label: "Getting Started" },
] as const;

export function DocsShell(child: Mountable): Mountable {
	return Div(
		{ class: "flex min-h-dvh flex-col" },
		Header(
			{
				class: "flex h-14 items-center border-b border-zinc-800 px-6",
			},
			router.Link(
				{ to: "/", class: "text-sm font-semibold tracking-tight" },
				"implement",
			),
		),
		Div(
			{ class: "mx-auto flex w-full max-w-5xl flex-1" },
			Aside(
				{ class: "w-56 shrink-0 border-r border-zinc-800 py-6 pr-4" },
				Nav(
					{ class: "flex flex-col gap-1" },
					...navItems.map((item) =>
						router.Link(
							{
								to: item.to,
								class:
									"rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 aria-[current=page]:bg-zinc-800/60 aria-[current=page]:text-zinc-100",
							},
							item.label,
						),
					),
				),
			),
			Main({ class: "min-w-0 flex-1 px-8 py-6" }, child),
		),
	);
}
