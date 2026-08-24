import { Div, P, Span, signal, type Signal } from "@implementjs/core";
import { CheckIcon, TagIcon } from "@implementjs/lucide";
import {
	DropdownMenu,
	DropdownMenuCheckboxGroup,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroupHeading,
	DropdownMenuTrigger,
} from "@/lib/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LABELS = [
	{ value: "ui-fix", name: "UI Fix", emoji: "🎨", dot: "bg-orange-400" },
	{ value: "bug", name: "Bug", emoji: "🐛", dot: "bg-red-400" },
	{ value: "docs", name: "Docs", emoji: "📝", dot: "bg-green-400" },
	{ value: "improvement", name: "Improvement", emoji: "⛏️", dot: "bg-blue-400" },
	{ value: "feature", name: "Feature", emoji: "🚀", dot: "bg-purple-400" },
	{ value: "question", name: "Question", emoji: "❓", dot: "bg-yellow-400" },
];

function toggle(selected: Signal<string[]>, value: string) {
	selected.update((current) =>
		current.includes(value) ? current.filter((label) => label !== value) : [...current, value],
	);
}

/**
 * The row's indicator, drawn as a checkbox instead of the usual check. It
 * swallows its own click, so toggling from here never reaches the item and
 * the menu stays open; clicking anywhere else on the row goes through the
 * item and closes. Both read their checked state off the row's `data-state`.
 */
function LabelCheckbox(selected: Signal<string[]>, value: string) {
	return Span(
		{
			"aria-hidden": true,
			class: cn(
				"grid size-4 shrink-0 place-content-center rounded-[4px] border border-input transition-opacity",
				// idle rows show only their dot, the way the checkbox appears under the pointer
				"opacity-0 group-data-[highlighted]/menu-item:opacity-100 group-data-[state=checked]/menu-item:opacity-100",
				"group-data-[state=checked]/menu-item:border-primary group-data-[state=checked]/menu-item:bg-primary group-data-[state=checked]/menu-item:text-primary-foreground",
			),
			onClick: (e: MouseEvent) => {
				e.stopPropagation();
				toggle(selected, value);
			},
		},
		CheckIcon({
			"aria-hidden": true,
			class: "size-3 hidden group-data-[state=checked]/menu-item:block",
		}),
	);
}

export default function DropdownMenuLabelsDemo() {
	const selected = signal(["ui-fix"]);

	return Div(
		{ class: "flex w-full max-w-xs flex-col items-center gap-3" },
		DropdownMenu(
			DropdownMenuTrigger(
				{ size: "sm" },
				TagIcon({ "aria-hidden": true, class: "size-4" }),
				"Labels",
			),
			DropdownMenuContent(
				{ class: "w-56" },
				DropdownMenuCheckboxGroup(
					{ value: selected },
					DropdownMenuGroupHeading("Add labels..."),
					...LABELS.map((label) =>
						DropdownMenuCheckboxItem(
							{ value: label.value, indicator: LabelCheckbox(selected, label.value) },
							Span({ "aria-hidden": true, class: cn("size-2 shrink-0 rounded-full", label.dot) }),
							Span({ "aria-hidden": true }, label.emoji),
							Span(label.name),
						),
					),
				),
			),
		),
		P(
			{ class: "text-sm text-muted-foreground" },
			selected.bind((labels) => (labels.length === 0 ? "No labels" : labels.join(", "))),
		),
	);
}
