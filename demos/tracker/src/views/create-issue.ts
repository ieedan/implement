import {
	Button,
	derived,
	Div,
	Input,
	Ref,
	Span,
	Implement,
	type Mountable,
} from "@packages/implement";
import {
	assigneeMenuItems,
	labelMenuItems,
	priorityMenuItems,
	statusMenuItems,
} from "../components/pickers";
import { PrimaryButton } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Icon, ReactiveIcon } from "../components/ui/icon";
import { Menu } from "../components/ui/menu";
import { TextArea } from "../components/ui/textarea";
import { cx } from "../lib/cx";
import { PRIORITY_META, STATUS_META } from "../lib/meta";
import { createIssue, usersById } from "../state/store";
import { createDialogOpen, createForm } from "../state/ui";

const chip =
	"flex h-7 select-none items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-900 px-2 text-[13px] text-zinc-300 transition-colors duration-100 hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none";

export function CreateIssueDialog(): Mountable {
	const titleInput = new Ref<HTMLInputElement>();

	const submit = async () => {
		const title = createForm.title.get().trim();
		if (title === "") return;

		const created = await createIssue({
			title,
			description: createForm.description.get().trim() || undefined,
			status: createForm.status.get(),
			priority: createForm.priority.get(),
			assigneeId: createForm.assigneeId.get(),
			labelIds: createForm.labelIds.get(),
		});
		if (created) createDialogOpen.set(false);
	};

	const statusMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: chip, onClick: toggle },
				ReactiveIcon(
					createForm.status,
					(status) => STATUS_META[status].icon,
					(status) => cx("h-4 w-4", STATUS_META[status].class),
				),
				Span(
					{},
					derived([createForm.status], (status) => STATUS_META[status].label),
				),
			),
		items: statusMenuItems(createForm.status, (status) => createForm.status.set(status)),
	});

	const priorityMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: chip, onClick: toggle },
				ReactiveIcon(
					createForm.priority,
					(priority) => PRIORITY_META[priority].icon,
					(priority) => cx("h-4 w-4", PRIORITY_META[priority].class),
				),
				Span(
					{},
					derived([createForm.priority], (priority) => PRIORITY_META[priority].label),
				),
			),
		items: priorityMenuItems(createForm.priority, (priority) => createForm.priority.set(priority)),
	});

	const assigneeMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: chip, onClick: toggle },
				Icon("user", "h-4 w-4 text-zinc-500"),
				Span(
					{},
					derived([createForm.assigneeId, usersById], (id, users) =>
						id === null ? "Assignee" : (users.get(id)?.name ?? "Assignee"),
					),
				),
			),
		items: assigneeMenuItems(createForm.assigneeId, (id) => createForm.assigneeId.set(id)),
	});

	const toggleLabel = (labelId: string) => {
		createForm.labelIds.update((current) =>
			current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId],
		);
	};

	const labelsMenu = Menu({
		trigger: (toggle) =>
			Button(
				{ type: "button", class: chip, onClick: toggle },
				Icon("tag", "h-4 w-4 text-zinc-500"),
				Span(
					{},
					derived([createForm.labelIds], (ids) =>
						ids.length === 0 ? "Labels" : `${ids.length} label${ids.length === 1 ? "" : "s"}`,
					),
				),
			),
		items: labelMenuItems(
			(labelId) => derived([createForm.labelIds], (ids) => ids.includes(labelId)),
			toggleLabel,
		),
	});

	return Dialog(
		createDialogOpen,
		"max-w-xl",
		Div(
			{ class: "flex items-center border-b border-zinc-800/80 px-4 py-3" },
			Span({ class: "text-[13px] font-medium text-zinc-300" }, "New issue"),
			Div({ class: "flex-1" }),
			Button(
				{
					type: "button",
					class:
						"flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors duration-100 hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none",
					onClick: () => createDialogOpen.set(false),
				},
				Icon("x", "h-4 w-4"),
			),
		),

		Div(
			{ class: "flex flex-col gap-3 px-4 py-4" },
			Input({
				this: titleInput,
				type: "text",
				placeholder: "Issue title",
				value: createForm.title,
				class:
					"w-full bg-transparent text-lg font-medium text-zinc-50 placeholder:text-zinc-600 focus:outline-none",
				onKeydown: (event) => {
					if (event.key === "Enter") void submit();
				},
			}),
			// the dialog subtree is remounted on every open; `onMount` waits until
			// the tree is connected, so focus works
			Implement.Lifecycle({ onMount: () => titleInput.get()?.focus() }),
			TextArea({
				value: createForm.description,
				placeholder: "Add a description…",
				rows: 4,
				onKeydown: (event) => {
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit();
				},
			}),
			Div(
				{ class: "flex flex-wrap items-center gap-2" },
				statusMenu,
				priorityMenu,
				assigneeMenu,
				labelsMenu,
			),
		),

		Div(
			{ class: "flex items-center border-t border-zinc-800/80 px-4 py-3" },
			Div({ class: "flex-1" }),
			PrimaryButton(
				{
					disabled: derived([createForm.title], (title) => title.trim() === ""),
					onClick: () => void submit(),
				},
				"Create issue",
			),
		),
	);
}
