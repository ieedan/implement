import { App, Await, Div, P, Span, type Mountable } from "@implementjs/core";
import { router } from "./router";
import { loadWorkspace } from "./state/store";
import "../app.css";

const app = App({ target: document.getElementById("root")! });

if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(app.unmount);
}

function CenteredMessage(...lines: string[]): Mountable {
	return Div(
		{ class: "flex h-dvh flex-col items-center justify-center gap-2" },
		...lines.map((line, i) =>
			i === 0
				? Span({ class: "text-sm font-medium text-zinc-300" }, line)
				: P({ class: "text-[13px] text-zinc-500" }, line),
		),
	);
}

app.render(
	Await(loadWorkspace())
		.WhileLoading(CenteredMessage("Loading workspace…"))
		.Then(() => router)
		.Catch((error) =>
			CenteredMessage(error.message, "Start it with: pnpm --filter @demos/tracker dev"),
		),
);
