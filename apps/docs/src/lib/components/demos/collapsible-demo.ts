import { Div, H4, Span } from "@implementjs/core";
import { ChevronsUpDownIcon } from "@implementjs/lucide";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/lib/components/ui/collapsible";

function Repo(name: string) {
	return Div({ class: "rounded-md border px-4 py-2 font-mono text-sm" }, name);
}

export default function CollapsibleDemo() {
	return Collapsible(
		{ class: "w-full max-w-md" },
		Div(
			{ class: "flex items-center justify-between gap-2 px-4" },
			H4({ class: "text-sm font-semibold" }, "@ieedan starred 3 packages"),
			CollapsibleTrigger(
				{ size: "icon-sm" },
				ChevronsUpDownIcon({ "aria-hidden": true, class: "size-4" }),
				Span({ class: "sr-only" }, "Toggle"),
			),
		),
		Repo("@implementjs/core"),
		CollapsibleContent(
			{ class: "flex flex-col gap-2" },
			Repo("@implementjs/primitives"),
			Repo("@implementjs/lucide"),
		),
	);
}
