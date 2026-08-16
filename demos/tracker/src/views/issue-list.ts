import {
	Button,
	Derived,
	Div,
	ForEach,
	H1,
	If,
	Input,
	properties,
	Span,
	type Readable,
} from "@packages/ui";
import type { Issue, Status } from "../api";
import { IssueRow } from "../components/issue-row";
import { Icon } from "../components/ui/icon";
import { PRIORITY_META, STATUS_META, STATUS_ORDER } from "../lib/meta";
import { currentUser, issues } from "../state/store";
import { activeView, openCreateDialog, searchQuery, VIEWS } from "../state/ui";

type Group = { status: Status; issues: Issue[] };

function byPriorityThenNumber(a: Issue, b: Issue): number {
	return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || b.number - a.number;
}

const groups = new Derived(
	[issues, activeView, searchQuery, currentUser],
	(issues, view, query, me): Group[] => {
		const viewMeta = VIEWS.find((v) => v.id === view)!;
		const q = query.trim().toLowerCase();

		const filtered = issues.filter(
			(issue) =>
				viewMeta.filter(issue, me?.id ?? null) &&
				(q === "" ||
					issue.title.toLowerCase().includes(q) ||
					issue.identifier.toLowerCase().includes(q)),
		);

		return STATUS_ORDER.map((status) => ({
			status,
			issues: filtered.filter((issue) => issue.status === status).sort(byPriorityThenNumber),
		})).filter((group) => group.issues.length > 0);
	},
);

function GroupSection(entry: Readable<[Group, number]>) {
	// the group's status is its ForEach key, so it never changes for this child;
	// the issue list and count are patched through the entry
	const [group] = entry.get();
	const meta = STATUS_META[group.status];
	const { issues: groupIssues } = properties(entry, ([group]) => group);

	return Div(
		Div(
			Icon(meta.icon, `h-4 w-4 ${meta.class}`),
			Span().content(meta.label).className("text-[13px] font-medium text-zinc-200"),
			Span()
				.content([groupIssues], (issues) => `${issues.length}`)
				.className("text-xs tabular-nums text-zinc-500"),
			Div().className("flex-1"),
			Button(Icon("plus", "h-3.5 w-3.5"))
				.type("button")
				.className(
					"flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors duration-100 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none",
				)
				.on("click", () => openCreateDialog({ status: group.status })),
		).className("flex items-center gap-2 border-y border-zinc-800/60 bg-zinc-900/50 px-6 py-1.5"),
		Div(ForEach(groupIssues, IssueRow)).className("flex flex-col divide-y divide-zinc-800/40"),
	).key(group.status);
}

export function IssueListView() {
	const viewLabel = new Derived(
		[activeView],
		(view) => VIEWS.find((v) => v.id === view)?.label ?? "",
	);

	return Div(
		Div(
			H1().content(viewLabel).className("text-sm font-semibold text-zinc-100"),
			Span()
				.content(
					[groups],
					(groups) => `${groups.reduce((total, group) => total + group.issues.length, 0)}`,
				)
				.className("text-xs tabular-nums text-zinc-500"),
			Div().className("flex-1"),
			Div(
				Icon("search", "h-3.5 w-3.5 text-zinc-500"),
				Input()
					.type("text")
					.placeholder("Search issues…")
					.value(searchQuery)
					.className(
						"w-44 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none",
					),
			).className(
				"flex h-8 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 transition-colors duration-150 focus-within:border-zinc-600",
			),
		).className("flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-800/80 px-6"),

		Div(
			ForEach(groups, GroupSection),
			If([groups], (groups) => groups.length === 0).Then(
				Div(
					Icon("inbox", "h-6 w-6 text-zinc-600"),
					Span().content("No issues match this view.").className("text-sm text-zinc-500"),
				).className("flex flex-col items-center gap-3 py-24"),
			),
		).className("min-h-0 flex-1 overflow-y-auto pb-12"),
	).className("flex min-h-0 flex-1 flex-col");
}
