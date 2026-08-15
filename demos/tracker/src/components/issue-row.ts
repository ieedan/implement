import { Button, Derived, Div, ForEach, If, Span, type Readable } from "@packages/ui";
import type { Issue, Label } from "../api";
import { cx } from "../lib/cx";
import { PRIORITY_META, STATUS_META } from "../lib/meta";
import { navigate } from "../lib/router";
import { formatRelative } from "../lib/time";
import { labelsById, updateIssue, usersById } from "../state/store";
import { priorityMenuItems, statusMenuItems } from "./pickers";
import { ReactiveAvatar } from "./ui/avatar";
import { Icon, ReactiveIcon } from "./ui/icon";
import { LabelBadge } from "./ui/badge";
import { Menu } from "./ui/menu";

const pickerTrigger =
	"flex h-6 w-6 items-center justify-center rounded transition-colors duration-100 hover:bg-zinc-800 focus:outline-none";

/**
 * A single row in the issue list. Rows are keyed by issue id and patched in
 * place when their issue changes (ForEach hands the render a Readable entry),
 * so every changing field binds to the entry instead of reading plain values.
 */
export function IssueRow(entry: Readable<[Issue, number]>) {
	const [initial] = entry.get();

	const priority = new Derived([entry], ([issue]) => issue.priority);
	const status = new Derived([entry], ([issue]) => issue.status);
	const assignee = new Derived([entry], ([issue]) =>
		issue.assigneeId ? (usersById.get().get(issue.assigneeId) ?? null) : null,
	);
	const issueLabels = new Derived([entry], ([issue]): Label[] =>
		issue.labelIds.map((id) => labelsById.get().get(id)).filter((label) => label !== undefined),
	);

	const priorityMenu = Menu({
		trigger: Button(
			ReactiveIcon(
				priority,
				(priority) => PRIORITY_META[priority].icon,
				(priority) => cx("h-4 w-4", PRIORITY_META[priority].class),
			),
		)
			.type("button")
			.className(pickerTrigger),
		items: priorityMenuItems(priority, (priority) => updateIssue(initial.id, { priority })),
	});

	const statusMenu = Menu({
		trigger: Button(
			ReactiveIcon(
				status,
				(status) => STATUS_META[status].icon,
				(status) => cx("h-4 w-4", STATUS_META[status].class),
			),
		)
			.type("button")
			.className(pickerTrigger),
		items: statusMenuItems(status, (status) => updateIssue(initial.id, { status })),
	});

	return Div(
		priorityMenu,
		Span()
			.content(initial.identifier)
			.className("w-14 shrink-0 text-xs tabular-nums text-zinc-500"),
		statusMenu,
		Span()
			.content([entry], ([issue]) => issue.title)
			.className("min-w-0 flex-1 truncate text-[13px] text-zinc-100"),
		Div(
			ForEach(issueLabels, (labelEntry) => {
				const [label] = labelEntry.get();
				return LabelBadge(label).key(label.id);
			}),
		).className("hidden shrink-0 items-center gap-1.5 lg:flex"),
		If([entry], ([issue]) => issue.commentCount > 0).Then(
			Span(
				Icon("comment", "h-3.5 w-3.5"),
				Span().content([entry], ([issue]) => `${issue.commentCount}`),
			).className("flex shrink-0 items-center gap-1 text-xs text-zinc-500"),
		),
		ReactiveAvatar(assignee),
		Span()
			.content(formatRelative(initial.createdAt))
			.className("w-12 shrink-0 text-right text-xs text-zinc-500"),
	)
		.key(initial.id)
		.className(
			"flex h-11 cursor-pointer select-none items-center gap-3 px-6 transition-colors duration-100 hover:bg-zinc-900/60",
		)
		.on("click", () => navigate({ name: "issue", id: initial.id }));
}
