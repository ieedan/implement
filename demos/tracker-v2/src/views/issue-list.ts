import {
	Button,
	derived,
	Div,
	ForEach,
	H1,
	If,
	Input,
	signal,
	Span,
	type Mountable,
	type Readable,
} from "@packages/ui_v2";
import type { Issue, Status } from "../api";
import { IssueRow } from "../components/issue-row";
import { Icon } from "../components/ui/icon";
import { PRIORITY_META, STATUS_META, STATUS_ORDER } from "../lib/meta";
import { router } from "../router";
import { currentUser, issues } from "../state/store";
import { openCreateDialog, viewById, type ViewMeta } from "../state/ui";

type Group = { status: Status; issues: Issue[] };

function byPriorityThenNumber(a: Issue, b: Issue): number {
	return PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || b.number - a.number;
}

function GroupSection(group: Readable<Group>): Mountable {
	// the group's status is its ForEach key, so it never changes for this child;
	// the issue list and count are patched through the readable
	const meta = STATUS_META[group.get().status];
	const groupIssues = group.bind("issues");

	return Div(
		{},
		Div(
			{
				class: "flex items-center gap-2 border-y border-zinc-800/60 bg-zinc-900/50 px-6 py-1.5",
			},
			Icon(meta.icon, `h-4 w-4 ${meta.class}`),
			Span({ class: "text-[13px] font-medium text-zinc-200" }, meta.label),
			Span(
				{ class: "text-xs tabular-nums text-zinc-500" },
				group.bind((g) => g.issues.length),
			),
			Div({ class: "flex-1" }),
			Button(
				{
					type: "button",
					class:
						"flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors duration-100 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none",
					onClick: () => openCreateDialog({ status: group.get().status }),
				},
				Icon("plus", "h-3.5 w-3.5"),
			),
		),
		Div(
			{ class: "flex flex-col divide-y divide-zinc-800/40" },
			ForEach(groupIssues, (issue) => issue.id, IssueRow),
		),
	);
}

/**
 * The grouped issue list. `view` is the `:view` route param (`null` on `/`,
 * which shows "all"); the search box is synced to `?q=` through the router.
 */
export function IssueListView(view: Readable<string> | null): Mountable {
	const activeView: Readable<ViewMeta> = view ? derived([view], viewById) : signal(viewById("all"));
	const query = router.searchParam("q", "");

	const groups = derived(
		[issues, activeView, query, currentUser],
		(issues, view, query, me): Group[] => {
			const q = query.trim().toLowerCase();

			const filtered = issues.filter(
				(issue) =>
					view.filter(issue, me?.id ?? null) &&
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

	return Div(
		{ class: "flex min-h-0 flex-1 flex-col" },
		Div(
			{ class: "flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-800/80 px-6" },
			H1({ class: "text-sm font-semibold text-zinc-100" }, activeView.bind("label")),
			Span(
				{ class: "text-xs tabular-nums text-zinc-500" },
				groups.bind((groups) => groups.reduce((total, group) => total + group.issues.length, 0)),
			),
			Div({ class: "flex-1" }),
			Div(
				{
					class:
						"flex h-8 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 transition-colors duration-150 focus-within:border-zinc-600",
				},
				Icon("search", "h-3.5 w-3.5 text-zinc-500"),
				Input({
					type: "text",
					placeholder: "Search issues…",
					value: query,
					class:
						"w-44 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none",
				}),
			),
		),

		Div(
			{ class: "min-h-0 flex-1 overflow-y-auto pb-12" },
			ForEach(groups, (group) => group.status, GroupSection),
			If(groups.bind((groups) => groups.length === 0)).Then(
				Div(
					{ class: "flex flex-col items-center gap-3 py-24" },
					Icon("inbox", "h-6 w-6 text-zinc-600"),
					Span({ class: "text-sm text-zinc-500" }, "No issues match this view."),
				),
			),
		),
	);
}
