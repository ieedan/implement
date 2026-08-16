import {
	Await,
	Button,
	Computed,
	Div,
	ForEach,
	If,
	Input,
	Key,
	P,
	Signal,
	Span,
	type Mountable,
} from "@packages/ui";
import type { Comment, Issue, Label } from "../api";
import {
	assigneeMenuItems,
	labelMenuItems,
	priorityMenuItems,
	statusMenuItems,
} from "../components/pickers";
import { Avatar, ReactiveAvatar } from "../components/ui/avatar";
import { LabelBadge } from "../components/ui/badge";
import { GhostButton, PrimaryButton } from "../components/ui/button";
import { Icon, ReactiveIcon } from "../components/ui/icon";
import { Menu } from "../components/ui/menu";
import { TextArea } from "../components/ui/textarea";
import { cx } from "../lib/cx";
import { PRIORITY_META, STATUS_META } from "../lib/meta";
import { navigate, route } from "../lib/router";
import { formatAgo, formatRelative } from "../lib/time";
import { api, bumpCommentCount, deleteIssue, store, updateIssue } from "../state/store";

const propertyTrigger =
	"flex h-7 select-none items-center gap-2 rounded-md px-2 text-[13px] text-zinc-200 transition-colors duration-100 hover:bg-zinc-800 focus:outline-none";

function PropertyRow(label: string, control: Mountable) {
	return Div(
		Span().content(label).className("w-20 shrink-0 pt-1.5 text-xs text-zinc-500"),
		control,
	).className("flex items-start gap-2");
}

function PropertiesPanel(issue: Issue) {
	const assignee = () =>
		issue.assigneeId ? (store.usersById.get(issue.assigneeId) ?? null) : null;

	const statusMenu = Menu({
		trigger: Button(
			ReactiveIcon(
				() => issue.status,
				(status) => STATUS_META[status].icon,
				(status) => cx("h-4 w-4", STATUS_META[status].class),
			),
			Span().content(() => STATUS_META[issue.status].label),
		)
			.type("button")
			.className(propertyTrigger),
		items: statusMenuItems(
			() => issue.status,
			(status) => updateIssue(issue.id, { status }),
		),
		align: "right",
	});

	const priorityMenu = Menu({
		trigger: Button(
			ReactiveIcon(
				() => issue.priority,
				(priority) => PRIORITY_META[priority].icon,
				(priority) => cx("h-4 w-4", PRIORITY_META[priority].class),
			),
			Span().content(() => PRIORITY_META[issue.priority].label),
		)
			.type("button")
			.className(propertyTrigger),
		items: priorityMenuItems(
			() => issue.priority,
			(priority) => updateIssue(issue.id, { priority }),
		),
		align: "right",
	});

	const assigneeMenu = Menu({
		trigger: Button(
			ReactiveAvatar(assignee),
			Span().content(() => assignee()?.name ?? "Unassigned"),
		)
			.type("button")
			.className(propertyTrigger),
		items: assigneeMenuItems(
			() => issue.assigneeId,
			(assigneeId) => updateIssue(issue.id, { assigneeId }),
		),
		align: "right",
	});

	const toggleLabel = (labelId: string) => {
		const next = issue.labelIds.includes(labelId)
			? issue.labelIds.filter((id) => id !== labelId)
			: [...issue.labelIds, labelId];
		void updateIssue(issue.id, { labelIds: next });
	};

	const labelsMenu = Menu({
		trigger: Button(Icon("plus", "h-3.5 w-3.5"))
			.type("button")
			.className(
				"flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-zinc-700 text-zinc-500 transition-colors duration-100 hover:border-zinc-500 hover:text-zinc-300 focus:outline-none",
			),
		items: labelMenuItems(
			(labelId) => new Computed(() => issue.labelIds.includes(labelId)),
			toggleLabel,
		),
		align: "right",
	});

	return Div(
		Span()
			.content("Properties")
			.className("text-xs font-medium uppercase tracking-wide text-zinc-500"),
		PropertyRow("Status", statusMenu),
		PropertyRow("Priority", priorityMenu),
		PropertyRow("Assignee", assigneeMenu),
		PropertyRow(
			"Labels",
			Div(
				ForEach(
					() =>
						issue.labelIds
							.map((id) => store.labelsById.get(id))
							.filter((label): label is Label => label !== undefined),
					(entry) => {
						const [label] = entry.get();
						return LabelBadge(label).key(label.id);
					},
				),
				labelsMenu,
			).className("flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-0.5"),
		),
		Div().className("border-t border-zinc-800/80"),
		Div(
			Span().content(`Created ${formatAgo(issue.createdAt)}`),
			Span().content(() => `Updated ${formatAgo(issue.updatedAt)}`),
		).className("flex flex-col gap-1 text-xs text-zinc-500"),
	).className(
		"flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-800/80 px-5 py-5",
	);
}

function CommentItem(issue: Issue, comment: Comment) {
	const author = store.usersById.get(comment.authorId) ?? null;

	const remove = async () => {
		const { error } = await api.comments.delete({ id: comment.id });
		if (error) return;
		bumpCommentCount(issue.id, -1);
	};

	return Div(
		Avatar(author),
		Div(
			Div(
				Span()
					.content(author?.name ?? "Unknown")
					.className("text-[13px] font-medium text-zinc-200"),
				Span().content(formatRelative(comment.createdAt)).className("text-xs text-zinc-500"),
				Div().className("flex-1"),
				Button(Icon("x", "h-3 w-3"))
					.type("button")
					.className(
						"flex h-5 w-5 items-center justify-center rounded text-zinc-600 opacity-0 transition-all duration-100 hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none group-hover:opacity-100",
					)
					.on("click", remove),
			).className("flex items-center gap-2"),
			P()
				.content(comment.body)
				.className("whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300"),
		).className("flex min-w-0 flex-1 flex-col gap-1"),
	)
		.key(comment.id)
		.className("group flex gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3");
}

function CommentComposer(issue: Issue) {
	const draft = new Signal("");

	const post = async () => {
		const body = draft.get().trim();
		const me = store.currentUser;
		if (body === "" || !me) return;
		const { error } = await api.comments.create({ id: issue.id, authorId: me.id, body });
		if (error) return;
		draft.set("");
		bumpCommentCount(issue.id, 1);
	};

	return Div(
		TextArea({ value: draft, placeholder: "Leave a comment…", rows: 3 }),
		Div(
			Button(Span().content("Comment"))
				.type("button")
				.className([draft], (draft) =>
					cx(
						"inline-flex h-7 select-none items-center rounded-md bg-indigo-500 px-3 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
						draft.trim() === "" && "pointer-events-none opacity-40",
					),
				)
				.on("click", post),
		).className("flex justify-end"),
	)
		.className(
			"flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 transition-colors duration-150 focus-within:border-zinc-700",
		)
		.on("keydown", (e) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void post();
		});
}

function CommentsSection(issue: Issue) {
	return Div(
		Span()
			.content("Activity")
			.className("text-xs font-medium uppercase tracking-wide text-zinc-500"),
		Await(
			api.comments.list({ id: issue.id }).then(({ data, error }) => {
				if (error) throw new Error("Failed to load comments");
				return data ?? [];
			}),
		)
			.WhileLoading(P().content("Loading comments…").className("text-[13px] text-zinc-500"))
			.Then((comments) =>
				Div(
					ForEach(comments, (entry) => {
						const [comment] = entry.get();
						return CommentItem(issue, comment);
					}),
				).className("flex flex-col gap-2"),
			)
			.Catch((error) => P().content(error.message).className("text-[13px] text-red-400")),
		CommentComposer(issue),
	).className("flex flex-col gap-3");
}

function DetailHeader(issue: Issue) {
	const overflowMenu = Menu({
		trigger: Button(Icon("dots", "h-4 w-4"))
			.type("button")
			.className(
				"flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors duration-100 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none",
			),
		items: [
			{
				id: "delete",
				label: "Delete issue",
				icon: "trash",
				danger: true,
				onSelect: () => {
					navigate({ name: "list" });
					void deleteIssue(issue.id);
				},
			},
		],
		align: "right",
	});

	return Div(
		GhostButton(Icon("chevronLeft", "h-4 w-4"), Span().content("Issues")).on("click", () =>
			navigate({ name: "list" }),
		),
		Span().content(issue.identifier).className("text-xs tabular-nums text-zinc-500"),
		Div().className("flex-1"),
		overflowMenu,
	).className("flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800/80 px-4");
}

function IssueDetailView(issue: Issue) {
	const title = new Signal(issue.title);
	const description = new Signal(issue.description);

	const saveTitle = () => {
		const next = title.get().trim();
		if (next !== "" && next !== issue.title) {
			void updateIssue(issue.id, { title: next });
		}
	};

	const saveDescription = () => {
		void updateIssue(issue.id, { description: description.get() });
	};

	return Div(
		Div(
			DetailHeader(issue),
			Div(
				Input()
					.type("text")
					.value(title)
					.placeholder("Issue title")
					.className(
						"w-full bg-transparent text-xl font-semibold text-zinc-50 placeholder:text-zinc-600 focus:outline-none",
					)
					.on("blur", saveTitle)
					.on("keydown", (e) => {
						if (e.key === "Enter") e.target.blur();
					}),
				Div(
					TextArea({
						value: description,
						placeholder: "Add a description…",
						rows: 5,
					}),
					If(() => description.get() !== issue.description).Then(
						Div(
							GhostButton(Span().content("Discard")).on("click", () =>
								description.set(issue.description),
							),
							PrimaryButton(Span().content("Save")).on("click", saveDescription),
						).className("flex justify-end gap-2"),
					),
				).className("flex flex-col gap-2"),
				Div().className("border-t border-zinc-800/80"),
				CommentsSection(issue),
			).className("flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-6"),
		).className("flex min-w-0 flex-1 flex-col"),
		PropertiesPanel(issue),
	).className("flex min-h-0 flex-1");
}

/**
 * Renders the detail view for the routed issue. The issue is a live store
 * object, so field edits update in place; `Key` rebuilds only when the routed
 * issue itself changes (navigation, or the issue disappearing).
 */
export function IssueDetailHost() {
	const current = new Computed((): Issue | null => {
		const r = route.get();
		if (r.name !== "issue") return null;
		return store.issues.find((issue) => issue.id === r.id) ?? null;
	});

	return Key(current, (issue) => (issue ? IssueDetailView(issue) : null));
}
