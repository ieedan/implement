import { Div, P, Span, signal, type Signal } from "@implementjs/core";
import { TagIcon } from "@implementjs/lucide";
import { Checkbox } from "@/lib/components/ui/checkbox";
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

/**
 * A two-way view of one label's place in the group's array: reading is
 * `includes`, writing adds or removes. The checkbox toggles it like any other
 * signal, so the array stays the only copy of the state — nothing to keep in
 * sync with the row.
 */
function membership(selected: Signal<string[]>, value: string): Signal<boolean> {
	return selected.bind(
		(labels) => labels.includes(value),
		(labels, checked) => (checked ? [...labels, value] : labels.filter((label) => label !== value)),
	);
}

/**
 * The row's indicator, drawn as a real checkbox. `decorative` renders it as a
 * span outside the accessibility tree — the row is already the
 * `menuitemcheckbox` — while the click still toggles. It swallows that click,
 * so toggling from here never reaches the item and the menu stays open;
 * clicking anywhere else on the row goes through the item and closes.
 */
function LabelCheckbox(selected: Signal<string[]>, value: string) {
	return Checkbox({
		decorative: true,
		checked: membership(selected, value),
		onClick: (e: MouseEvent) => e.stopPropagation(),
		// idle rows show only their dot; the box fades in under the pointer, or stays for a checked one
		class: cn(
			"transition-opacity opacity-0",
			"group-data-[highlighted]/menu-item:opacity-100 group-data-[state=checked]/menu-item:opacity-100",
		),
	});
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
