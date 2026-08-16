import { Button, Div, ForEach, If, Span, type Readable } from "@packages/ui";
import type { Issue, Label } from "../api";
import { cx } from "../lib/cx";
import { PRIORITY_META, STATUS_META } from "../lib/meta";
import { navigate } from "../lib/router";
import { formatRelative } from "../lib/time";
import { store, updateIssue } from "../state/store";
import { priorityMenuItems, statusMenuItems } from "./pickers";
import { ReactiveAvatar } from "./ui/avatar";
import { Icon, ReactiveIcon } from "./ui/icon";
import { LabelBadge } from "./ui/badge";
import { Menu } from "./ui/menu";

const pickerTrigger =
	"flex h-6 w-6 items-center justify-center rounded transition-colors duration-100 hover:bg-zinc-800 focus:outline-none";

/**
 * A single row in the issue list. Rows are keyed by issue id and patched in
 * place, and the issue itself is a live store object — every changing field
 * binds with a plain getter reading `issue.<field>` directly.
 */
export function IssueRow(entry: Readable<[Issue, number]>) {
	const [issue] = entry.get();

	const priorityMenu = Menu({
		trigger: Button(
			ReactiveIcon(
				() => issue.priority,
				(priority) => PRIORITY_META[priority].icon,
				(priority) => cx("h-4 w-4", PRIORITY_META[priority].class),
			),
		)
			.type("button")
			.className(pickerTrigger),
		items: priorityMenuItems(
			() => issue.priority,
			(priority) => updateIssue(issue.id, { priority }),
		),
	});

	const statusMenu = Menu({
		trigger: Button(
			ReactiveIcon(
				() => issue.status,
				(status) => STATUS_META[status].icon,
				(status) => cx("h-4 w-4", STATUS_META[status].class),
			),
		)
			.type("button")
			.className(pickerTrigger),
		items: statusMenuItems(
			() => issue.status,
			(status) => updateIssue(issue.id, { status }),
		),
	});

	return Div(
		priorityMenu,
		Span().content(issue.identifier).className("w-14 shrink-0 text-xs tabular-nums text-zinc-500"),
		statusMenu,
		Span()
			.content(() => issue.title)
			.className("min-w-0 flex-1 truncate text-[13px] text-zinc-100"),
		Div(
			ForEach(
				() =>
					issue.labelIds
						.map((id) => store.labelsById.get(id))
						.filter((label): label is Label => label !== undefined),
				(labelEntry) => {
					const [label] = labelEntry.get();
					return LabelBadge(label).key(label.id);
				},
			),
		).className("hidden shrink-0 items-center gap-1.5 lg:flex"),
		If(() => issue.commentCount > 0).Then(
			Span(
				Icon("comment", "h-3.5 w-3.5"),
				Span().content(() => `${issue.commentCount}`),
			).className("flex shrink-0 items-center gap-1 text-xs text-zinc-500"),
		),
		ReactiveAvatar(() =>
			issue.assigneeId ? (store.usersById.get(issue.assigneeId) ?? null) : null,
		),
		Span()
			.content(formatRelative(issue.createdAt))
			.className("w-12 shrink-0 text-right text-xs text-zinc-500"),
	)
		.key(issue.id)
		.className(
			"flex h-11 cursor-pointer select-none items-center gap-3 px-6 transition-colors duration-100 hover:bg-zinc-900/60",
		)
		.on("click", () => navigate({ name: "issue", id: issue.id }));
}
