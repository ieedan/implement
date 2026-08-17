import {
	Button,
	derived,
	Div,
	ForEach,
	If,
	Span,
	type Mountable,
	type Readable,
} from "@packages/ui_v2";
import type { Issue, Label } from "../api";
import { cx } from "../lib/cx";
import { PRIORITY_META, STATUS_META } from "../lib/meta";
import { formatRelative } from "../lib/time";
import { router } from "../router";
import { labelsById, updateIssue, usersById } from "../state/store";
import { priorityMenuItems, statusMenuItems } from "./pickers";
import { ReactiveAvatar } from "./ui/avatar";
import { LabelBadge } from "./ui/badge";
import { Icon, ReactiveIcon } from "./ui/icon";
import { Menu } from "./ui/menu";

const pickerTrigger =
	"flex h-6 w-6 items-center justify-center rounded transition-colors duration-100 hover:bg-zinc-800 focus:outline-none";

/**
 * A single row in the issue list. Rows are keyed by issue id and patched in
 * place when their issue changes (ForEach hands the render a Readable), so
 * every changing field binds to the readable instead of reading plain values.
 */
export function IssueRow(issue: Readable<Issue>): Mountable {
	const id = issue.get().id;

	const priority = issue.bind("priority");
	const status = issue.bind("status");
	const assignee = derived([issue, usersById], (issue, users) =>
		issue.assigneeId ? (users.get(issue.assigneeId) ?? null) : null,
	);
	const issueLabels = derived([issue, labelsById], (issue, labels): Label[] =>
		issue.labelIds.map((labelId) => labels.get(labelId)).filter((label) => label !== undefined),
	);

	const priorityMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: pickerTrigger, onClick: toggle },
				ReactiveIcon(
					priority,
					(priority) => PRIORITY_META[priority].icon,
					(priority) => cx("h-4 w-4", PRIORITY_META[priority].class),
				),
			),
		items: priorityMenuItems(priority, (priority) => updateIssue(id, { priority })),
	});

	const statusMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: pickerTrigger, onClick: toggle },
				ReactiveIcon(
					status,
					(status) => STATUS_META[status].icon,
					(status) => cx("h-4 w-4", STATUS_META[status].class),
				),
			),
		items: statusMenuItems(status, (status) => updateIssue(id, { status })),
	});

	return Div(
		{
			class:
				"flex h-11 cursor-pointer select-none items-center gap-3 px-6 transition-colors duration-100 hover:bg-zinc-900/60",
			onClick: () => router.navigate("/issues/:id", { id }),
		},
		priorityMenu,
		Span({ class: "w-14 shrink-0 text-xs tabular-nums text-zinc-500" }, issue.bind("identifier")),
		statusMenu,
		Span({ class: "min-w-0 flex-1 truncate text-[13px] text-zinc-100" }, issue.bind("title")),
		Div(
			{ class: "hidden shrink-0 items-center gap-1.5 lg:flex" },
			ForEach(issueLabels, (label) => label.id, LabelBadge),
		),
		If(issue.bind((issue) => issue.commentCount > 0)).Then(
			Span(
				{ class: "flex shrink-0 items-center gap-1 text-xs text-zinc-500" },
				Icon("comment", "h-3.5 w-3.5"),
				Span({}, issue.bind("commentCount")),
			),
		),
		ReactiveAvatar(assignee),
		Span(
			{ class: "w-12 shrink-0 text-right text-xs text-zinc-500" },
			formatRelative(issue.get().createdAt),
		),
	);
}
