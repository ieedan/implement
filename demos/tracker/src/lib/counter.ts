import { A, Button, Code, Div, H1, Li, P, Span, Ul, signal } from "@implementjs/core";
import { MinusIcon, PlusIcon } from "@implementjs/lucide";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@implementjs/primitives";

const styles = {
	page: "flex min-h-dvh flex-col items-center justify-center gap-6 p-8",
	title: "text-3xl font-semibold tracking-tight",
	subtitle: "text-sm text-zinc-400",
	code: "rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-300",
	counter: "flex items-center gap-4",
	button: "flex size-9 cursor-pointer items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-lg leading-none hover:bg-zinc-800",
	count: "min-w-10 text-center font-mono text-2xl tabular-nums",
	links: "flex flex-col items-center gap-1 text-sm",
	link: "text-zinc-400 underline underline-offset-4 hover:text-zinc-200",
	trigger: "cursor-pointer text-sm text-zinc-400 hover:text-zinc-200",
	panel: "pt-3",
};

const links = [
	{ label: "Documentation", href: "https://github.com/ieedan/implement" },
	{ label: "Routing", href: "https://github.com/ieedan/implement/tree/main/packages/kit" },
	{ label: "Primitives", href: "https://github.com/ieedan/implement/tree/main/packages/primitives" },
];

export function Counter() {
	const count = signal(0);

	return Div(
		{ class: styles.page },
		H1({ class: styles.title }, "implement"),
		P(
			{ class: styles.subtitle },
			"Edit ",
			Code({ class: styles.code }, "src/lib/counter.ts"),
			" and save to see it update.",
		),
		Div(
			{ class: styles.counter },
			Button(
				{ class: styles.button, "aria-label": "Decrement", onClick: () => count.decrement() },
				MinusIcon({ class: "size-4" }),
			),
			Span({ class: styles.count }, count),
			Button(
				{ class: styles.button, "aria-label": "Increment", onClick: () => count.increment() },
				PlusIcon({ class: "size-4" }),
			),
		),
		Links(),
	);
}

/** The links, tucked into a headless collapsible from @implementjs/primitives. */
function Links() {
	return Collapsible(
		{},
		CollapsibleTrigger({ class: styles.trigger }, "What's next?"),
		CollapsibleContent(
			{ class: styles.panel },
			Ul(
				{ class: styles.links },
				...links.map((link) => Li(A({ class: styles.link, href: link.href }, link.label))),
			),
		),
	);
}
