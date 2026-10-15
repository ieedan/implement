import { Div, ImplementLifecycle, signal } from "@implementjs/core";
import { RotateCcwIcon, TerminalIcon } from "@implementjs/lucide";
import { Button } from "@/lib/components/ui/button";
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@/lib/components/ui/code-block";

const output = `$ pnpm build
packages/core build: ✔ Build complete in 812ms
packages/primitives build: ✔ Build complete in 1204ms
packages/kit build: ✔ Build complete in 1532ms
apps/docs build: ✓ 2318 modules transformed.
apps/docs build: ✓ built in 9.41s`;

export default function CodeBlockStreamingDemo() {
	// the output so far: a readable string the block follows as it grows
	const log = signal("");
	let timer: ReturnType<typeof setInterval> | undefined;

	function run() {
		clearInterval(timer);
		log.set("");
		const lines = output.split("\n");
		let next = 0;
		timer = setInterval(() => {
			log.set(lines.slice(0, ++next).join("\n"));
			if (next === lines.length) clearInterval(timer);
		}, 400);
	}

	return ImplementLifecycle(
		{
			onMount() {
				run();
				return () => clearInterval(timer);
			},
		},
		Div(
			{ class: "w-full max-w-lg" },
			CodeBlock(
				CodeBlockHeader(
					CodeBlockTitle(TerminalIcon(), "Terminal"),
					CodeBlockActions(
						Button(
							{ variant: "ghost", size: "icon-xs", "aria-label": "Run again", onClick: run },
							RotateCcwIcon(),
						),
						CodeBlockCopyButton({ value: log }),
					),
				),
				CodeBlockContent({ lineNumbers: true, class: "h-48" }, log),
			),
		),
	);
}
