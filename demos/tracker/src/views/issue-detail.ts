import {
	Await,
	Button,
	derived,
	Div,
	ForEach,
	Fragment,
	If,
	Input,
	P,
	signal,
	Span,
	Implement,
	type Child,
	type Mountable,
	type Readable,
} from "@packages/implement";
import type { Comment, Issue } from "../api";
import {
	assigneeMenuItems,
	labelMenuItems,
	priorityMenuItems,
	statusMenuItems,
} from "../components/pickers";
import { ReactiveAvatar } from "../components/ui/avatar";
import { LabelBadge } from "../components/ui/badge";
import { GhostButton, PrimaryButton } from "../components/ui/button";
import { Icon, ReactiveIcon } from "../components/ui/icon";
import { Menu } from "../components/ui/menu";
import { TextArea } from "../components/ui/textarea";
import { cx } from "../lib/cx";
import { PRIORITY_META, STATUS_META } from "../lib/meta";
import { formatAgo, formatRelative } from "../lib/time";
import { router } from "../router";
import {
	api,
	bumpCommentCount,
	currentUser,
	deleteIssue,
	issues,
	labelsById,
	updateIssue,
	usersById,
} from "../state/store";

const propertyTrigger =
	"flex h-7 select-none items-center gap-2 rounded-md px-2 text-[13px] text-zinc-200 transition-colors duration-100 hover:bg-zinc-800 focus:outline-none";

const sectionLabel = "text-xs font-medium uppercase tracking-wide text-zinc-500";

function PropertyRow(label: string, control: Mountable): Mountable {
	return Div(
		{ class: "flex items-start gap-2" },
		Span({ class: "w-20 shrink-0 pt-1.5 text-xs text-zinc-500" }, label),
		control,
	);
}

function PropertiesPanel(issue: Readable<Issue | null>): Mountable {
	const status = derived([issue], (issue) => issue?.status ?? "todo");
	const priority = derived([issue], (issue) => issue?.priority ?? "none");
	const assigneeId = derived([issue], (issue) => issue?.assigneeId ?? null);
	const assignee = derived([assigneeId, usersById], (id, users) =>
		id ? (users.get(id) ?? null) : null,
	);
	const issueLabels = derived([issue, labelsById], (issue, labels) =>
		(issue?.labelIds ?? [])
			.map((labelId) => labels.get(labelId))
			.filter((label) => label !== undefined),
	);

	const patch = (fields: Parameters<typeof updateIssue>[1]) => {
		const current = issue.get();
		if (current) void updateIssue(current.id, fields);
	};

	const statusMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: propertyTrigger, onClick: toggle },
				ReactiveIcon(
					status,
					(status) => STATUS_META[status].icon,
					(status) => cx("h-4 w-4", STATUS_META[status].class),
				),
				Span(
					{},
					derived([status], (status) => STATUS_META[status].label),
				),
			),
		items: statusMenuItems(status, (status) => patch({ status })),
		align: "right",
	});

	const priorityMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: propertyTrigger, onClick: toggle },
				ReactiveIcon(
					priority,
					(priority) => PRIORITY_META[priority].icon,
					(priority) => cx("h-4 w-4", PRIORITY_META[priority].class),
				),
				Span(
					{},
					derived([priority], (priority) => PRIORITY_META[priority].label),
				),
			),
		items: priorityMenuItems(priority, (priority) => patch({ priority })),
		align: "right",
	});

	const assigneeMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: propertyTrigger, onClick: toggle },
				ReactiveAvatar(assignee),
				Span(
					{},
					derived([assignee], (assignee) => assignee?.name ?? "Unassigned"),
				),
			),
		items: assigneeMenuItems(assigneeId, (assigneeId) => patch({ assigneeId })),
		align: "right",
	});

	const toggleLabel = (labelId: string) => {
		const current = issue.get();
		if (!current) return;
		const next = current.labelIds.includes(labelId)
			? current.labelIds.filter((id) => id !== labelId)
			: [...current.labelIds, labelId];
		void updateIssue(current.id, { labelIds: next });
	};

	const labelsMenu = Menu({
		trigger: (toggle) =>
			Button(
				{
					type: "button",
					class:
						"flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-zinc-700 text-zinc-500 transition-colors duration-100 hover:border-zinc-500 hover:text-zinc-300 focus:outline-none",
					onClick: toggle,
				},
				Icon("plus", "h-3.5 w-3.5"),
			),
		items: labelMenuItems(
			(labelId) => derived([issue], (issue) => issue?.labelIds.includes(labelId) ?? false),
			toggleLabel,
		),
		align: "right",
	});

	return Div(
		{
			class:
				"flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-800/80 px-5 py-5",
		},
		Span({ class: sectionLabel }, "Properties"),
		PropertyRow("Status", statusMenu),
		PropertyRow("Priority", priorityMenu),
		PropertyRow("Assignee", assigneeMenu),
		PropertyRow(
			"Labels",
			Div(
				{ class: "flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pt-0.5" },
				ForEach(issueLabels, (label) => label.id, LabelBadge),
				labelsMenu,
			),
		),
		Div({ class: "border-t border-zinc-800/80" }),
		Div(
			{ class: "flex flex-col gap-1 text-xs text-zinc-500" },
			Span(
				{},
				issue.bind((issue) => (issue ? `Created ${formatAgo(issue.createdAt)}` : "")),
			),
			Span(
				{},
				issue.bind((issue) => (issue ? `Updated ${formatAgo(issue.updatedAt)}` : "")),
			),
		),
	);
}

function CommentItem(comment: Readable<Comment>, onDeleted: () => void): Mountable {
	const author = derived([comment, usersById], (comment, users) => users.get(comment.authorId));

	const remove = async () => {
		const current = comment.get();
		const { error } = await api.comments.delete({ id: current.id });
		if (error) return;
		bumpCommentCount(current.issueId, -1);
		onDeleted();
	};

	return Div(
		{ class: "group flex gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 p-3" },
		ReactiveAvatar(derived([author], (author) => author ?? null)),
		Div(
			{ class: "flex min-w-0 flex-1 flex-col gap-1" },
			Div(
				{ class: "flex items-center gap-2" },
				Span(
					{ class: "text-[13px] font-medium text-zinc-200" },
					author.bind((author) => author?.name ?? "Unknown"),
				),
				Span(
					{ class: "text-xs text-zinc-500" },
					comment.bind((comment) => formatRelative(comment.createdAt)),
				),
				Div({ class: "flex-1" }),
				Button(
					{
						type: "button",
						class:
							"flex h-5 w-5 items-center justify-center rounded text-zinc-600 opacity-0 transition-all duration-100 hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none group-hover:opacity-100",
						onClick: () => void remove(),
					},
					Icon("x", "h-3 w-3"),
				),
			),
			P(
				{ class: "whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300" },
				comment.bind("body"),
			),
		),
	);
}

function CommentComposer(id: Readable<string>, refetch: () => void): Mountable {
	const draft = signal("");

	const post = async () => {
		const body = draft.get().trim();
		const me = currentUser.get();
		if (body === "" || !me) return;
		const { error } = await api.comments.create({ id: id.get(), authorId: me.id, body });
		if (error) return;
		draft.set("");
		bumpCommentCount(id.get(), 1);
		refetch();
	};

	return Div(
		{
			class:
				"flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 transition-colors duration-150 focus-within:border-zinc-700",
			onKeydown: (event) => {
				if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void post();
			},
		},
		TextArea({ value: draft, placeholder: "Leave a comment…", rows: 3 }),
		Div(
			{ class: "flex justify-end" },
			PrimaryButton(
				{
					class: "h-7",
					disabled: derived([draft], (draft) => draft.trim() === ""),
					onClick: () => void post(),
				},
				"Comment",
			),
		),
	);
}

function CommentsSection(id: Readable<string>): Mountable {
	const fetchComments = (issueId: string) =>
		api.comments.list({ id: issueId }).then(({ data, error }) => {
			if (error) throw new Error("Failed to load comments");
			return data ?? [];
		});

	// Refetching swaps the promise in the signal; Await re-follows it and
	// patches the resolved readable in place (old comments stay visible while
	// the new fetch is in flight).
	const query = signal(fetchComments(id.get()));
	const refetch = () => query.set(fetchComments(id.get()));

	return Div(
		{ class: "flex flex-col gap-3" },
		Implement.Lifecycle({ onMount: () => id.onChange(refetch) }),
		Span({ class: sectionLabel }, "Activity"),
		Await(query)
			.WhileLoading(P({ class: "text-[13px] text-zinc-500" }, "Loading comments…"))
			.Then((comments) =>
				Div(
					{ class: "flex flex-col gap-2" },
					ForEach(
						comments,
						(comment) => comment.id,
						(comment) => CommentItem(comment, refetch),
					),
				),
			)
			.Catch((error) => P({ class: "text-[13px] text-red-400" }, error.message)),
		CommentComposer(id, refetch),
	);
}

function DetailHeader(id: Readable<string>, issue: Readable<Issue | null>): Mountable {
	// Prev/next navigate /issues/:id → /issues/:id; the router patches the
	// `id` param in place instead of remounting the view.
	const index = derived([issues, id], (issues, id) => issues.findIndex((i) => i.id === id));

	const step = (delta: number) => {
		const target = issues.get()[index.get() + delta];
		if (target) router.navigate("/issues/:id", { id: target.id });
	};

	const stepButton = (delta: number, iconClass: string) =>
		Button(
			{
				type: "button",
				class:
					"flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors duration-100 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none disabled:pointer-events-none disabled:opacity-30",
				disabled: derived([issues, index], (issues, index) => {
					const target = index + delta;
					return index === -1 || target < 0 || target >= issues.length;
				}),
				onClick: () => step(delta),
			},
			Icon("chevronDown", iconClass),
		);

	const overflowMenu = Menu({
		trigger: (toggle) =>
			Button(
				{
					type: "button",
					class:
						"flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors duration-100 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none",
					onClick: toggle,
				},
				Icon("dots", "h-4 w-4"),
			),
		items: [
			{
				id: "delete",
				label: "Delete issue",
				icon: "trash",
				danger: true,
				onSelect: () => {
					const current = issue.get();
					router.navigate("/");
					if (current) void deleteIssue(current.id);
				},
			},
		],
		align: "right",
	});

	return Div(
		{ class: "flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800/80 px-4" },
		router.Link(
			{
				to: "/",
				class:
					"inline-flex h-7 select-none items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-zinc-400 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-200 focus:outline-none",
			},
			Icon("chevronLeft", "h-4 w-4"),
			Span({}, "Issues"),
		),
		Span(
			{ class: "text-xs tabular-nums text-zinc-500" },
			issue.bind((issue) => issue?.identifier ?? ""),
		),
		Div({ class: "flex-1" }),
		stepButton(-1, "h-4 w-4 rotate-180"),
		stepButton(1, "h-4 w-4"),
		overflowMenu,
	);
}

function TitleEditor(id: Readable<string>, issue: Readable<Issue | null>): Child {
	const draft = signal(issue.get()?.title ?? "");

	const save = () => {
		const current = issue.get();
		const next = draft.get().trim();
		if (!current || next === "" || next === current.title) return;
		void updateIssue(current.id, { title: next });
	};

	return Fragment(
		{},
		// navigating issue → issue patches `id` in place; reseed the draft
		Implement.Lifecycle({ onMount: () => id.onChange(() => draft.set(issue.get()?.title ?? "")) }),
		Input({
			type: "text",
			value: draft,
			placeholder: "Issue title",
			class:
				"w-full bg-transparent text-xl font-semibold text-zinc-50 placeholder:text-zinc-600 focus:outline-none",
			onBlur: save,
			onKeydown: (event) => {
				if (event.key === "Enter") event.target.blur();
			},
		}),
	);
}

function DescriptionEditor(id: Readable<string>, issue: Readable<Issue | null>): Mountable {
	const draft = signal(issue.get()?.description ?? "");
	const dirty = derived(
		[draft, issue],
		(draft, issue) => issue !== null && draft !== issue.description,
	);

	return Div(
		{ class: "flex flex-col gap-2" },
		Implement.Lifecycle({
			onMount: () => id.onChange(() => draft.set(issue.get()?.description ?? "")),
		}),
		TextArea({ value: draft, placeholder: "Add a description…", rows: 5 }),
		If(dirty).Then(
			Div(
				{ class: "flex justify-end gap-2" },
				GhostButton({ onClick: () => draft.set(issue.get()?.description ?? "") }, "Discard"),
				PrimaryButton(
					{
						onClick: () => {
							const current = issue.get();
							if (current) void updateIssue(current.id, { description: draft.get() });
						},
					},
					"Save",
				),
			),
		),
	);
}

/**
 * The routed issue detail. `id` is the `:id` route param — navigating between
 * issues patches it in place, so this view is mounted once and every field
 * follows the readable.
 */
export function IssueDetailView(id: Readable<string>): Mountable {
	const issue = derived([issues, id], (issues, id) => issues.find((i) => i.id === id) ?? null);

	return If(issue)
		.Then(
			Div(
				{ class: "flex min-h-0 flex-1" },
				Div(
					{ class: "flex min-w-0 flex-1 flex-col" },
					DetailHeader(id, issue),
					Div(
						{ class: "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-6" },
						TitleEditor(id, issue),
						DescriptionEditor(id, issue),
						Div({ class: "border-t border-zinc-800/80" }),
						CommentsSection(id),
					),
				),
				PropertiesPanel(issue),
			),
		)
		.Else(
			Div(
				{ class: "flex flex-1 flex-col items-center justify-center gap-3" },
				Span({ class: "text-sm text-zinc-400" }, "This issue does not exist."),
				router.Link(
					{ to: "/", class: "text-[13px] text-indigo-400 hover:text-indigo-300" },
					"Back to issues",
				),
			),
		);
}
