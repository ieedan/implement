import { Await, Div, P, Span } from "@packages/ui";
import { loadWorkspace } from "./state/store";
import { App } from "./views/app";

const root = document.getElementById("root")!;

function CenteredMessage(...lines: string[]) {
	return Div(
		...lines.map((line, i) =>
			i === 0
				? Span().content(line).className("text-sm font-medium text-zinc-300")
				: P().content(line).className("text-[13px] text-zinc-500"),
		),
	).className("flex h-dvh flex-col items-center justify-center gap-2");
}

Div(
	Await(loadWorkspace())
		.WhileLoading(CenteredMessage("Loading workspace…"))
		.Then(() => App())
		.Catch((error) =>
			CenteredMessage(error.message, "Start it with: pnpm --filter @demos/tracker dev"),
		),
).mount(root);
