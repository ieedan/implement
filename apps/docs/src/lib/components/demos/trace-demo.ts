import { Div } from "@implementjs/core";
import {
	FilePenIcon,
	FileTextIcon,
	LoaderCircleIcon,
	SearchIcon,
	TerminalIcon,
} from "@implementjs/lucide";
import { CodeBlock, CodeBlockContent } from "@/lib/components/ui/code-block";
import {
	Trace,
	TraceCollapsible,
	TraceCollapsibleContent,
	TraceCollapsibleTrigger,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@/lib/components/ui/trace";

export default function TraceDemo() {
	return Div(
		{ class: "w-full max-w-md" },
		Trace(
			TraceLine(
				TraceIcon(SearchIcon()),
				TraceTitle("Searched for frozen-lockfile"),
				TraceDescription("3 results"),
			),
			TraceLine(TraceIcon(FileTextIcon()), TraceTitle("Read .github/workflows/ci.yml")),
			TraceCollapsible(
				TraceCollapsibleTrigger(
					TraceLine(
						{ status: "error" },
						TraceIcon(TerminalIcon()),
						TraceTitle("Failed to run pnpm install --frozen-lockfile"),
					),
				),
				TraceCollapsibleContent(
					CodeBlock(
						{ size: "sm", variant: "destructive" },
						CodeBlockContent(
							{ wrap: true, class: "max-h-64" },
							'$ pnpm install --frozen-lockfile\nERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json',
						),
					),
				),
			),
			TraceLine(
				TraceIcon(FilePenIcon()),
				TraceTitle("Edited pnpm-lock.yaml"),
				TraceDescription({ class: "font-mono" }, "+12 −4"),
			),
			TraceLine(
				{ status: "running" },
				TraceIcon(LoaderCircleIcon({ class: "animate-spin" })),
				TraceTitle("Running pnpm install --frozen-lockfile"),
			),
		),
	);
}
