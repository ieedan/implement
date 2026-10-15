import { Div, Dynamic, ForEach } from "@implementjs/core";
import { FileCodeIcon } from "@implementjs/lucide";
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockLine,
	CodeBlockTitle,
} from "@/lib/components/ui/code-block";
import { highlightedCode } from "@/lib/components/ui/highlighted-code";

const code = `import { App, Button, signal } from "@implementjs/core";

const app = App({ target: document.body });

function Counter() {
	const count = signal(0);

	return Button({ onClick: () => count.increment() }, "Count: ", count);
}

app.render(Counter());`;

export default function CodeBlockDemo() {
	const lines = highlightedCode(code, "ts");

	return Div(
		{ class: "w-full max-w-lg" },
		CodeBlock(
			CodeBlockHeader(
				CodeBlockTitle(FileCodeIcon(), "src/main.ts"),
				CodeBlockActions(CodeBlockCopyButton({ value: code })),
			),
			CodeBlockContent(
				{ lineNumbers: true },
				ForEach(
					lines,
					(_, index) => index,
					(line) => CodeBlockLine(Dynamic(line)),
				),
			),
		),
	);
}
