import { Code, Div, H1, H2, P, Pre, type Mountable } from "@packages/implement";

const example = `import { App, Button, Div, signal } from "@packages/implement";

const app = App({ target: document.body });

function Counter() {
	const count = signal(0);

	return Div(
		Button({ onClick: () => count.update((n) => n + 1) }, "Count: ", count),
	);
}

app.render(Counter());`;

export function GettingStartedView(): Mountable {
	return Div(
		{ class: "flex flex-col gap-4" },
		H1({ class: "text-2xl font-semibold tracking-tight" }, "Getting Started"),
		P(
			{ class: "text-sm leading-6 text-zinc-400" },
			"Create an app, define components as plain functions, and render signals directly as children.",
		),
		H2({ class: "text-lg font-medium" }, "Your first component"),
		Pre(
			{
				class:
					"overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-[13px] leading-6",
			},
			Code({}, example),
		),
	);
}
