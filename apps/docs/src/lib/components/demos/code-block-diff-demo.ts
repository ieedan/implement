import { Div } from "@implementjs/core";
import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@/lib/components/ui/code-block";

export default function CodeBlockDiffDemo() {
	return Div(
		{ class: "w-full max-w-lg" },
		CodeBlock(
			CodeBlockContent(
				{ lineNumbers: true, startLine: 12 },
				CodeBlockLine("function Counter() {"),
				CodeBlockLine({ variant: "removed" }, "\tlet count = 0;"),
				CodeBlockLine({ variant: "added" }, "\tconst count = signal(0);"),
				CodeBlockLine(""),
				CodeBlockLine(
					{ variant: "highlighted" },
					'\treturn Button({ onClick: () => count.increment() }, "Count: ", count);',
				),
				CodeBlockLine("}"),
			),
		),
	);
}
