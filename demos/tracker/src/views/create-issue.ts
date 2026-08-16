import { Button, Derived, Div, Input, Span } from "@packages/ui";
import {
	assigneeMenuItems,
	labelMenuItems,
	priorityMenuItems,
	statusMenuItems,
} from "../components/pickers";
import { Icon, ReactiveIcon } from "../components/ui/icon";
import { Dialog } from "../components/ui/dialog";
import { Menu } from "../components/ui/menu";
import { TextArea } from "../components/ui/textarea";
import { cx } from "../lib/cx";
import { PRIORITY_META, STATUS_META } from "../lib/meta";
import { createIssue, store } from "../state/store";
import { createDialogOpen, createForm } from "../state/ui";

const chip =
	"flex h-7 select-none items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-900 px-2 text-[13px] text-zinc-300 transition-colors duration-100 hover:border-zinc-600 hover:bg-zinc-800 focus:outline-none";

export function CreateIssueDialog() {
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
		trigger: Button(
			ReactiveIcon(
				createForm.status,
				(s) => STATUS_META[s].icon,
				(s) => cx("h-4 w-4", STATUS_META[s].class),
			),
			Span().content([createForm.status], (status) => STATUS_META[status].label),
		)
			.type("button")
			.className(chip),
		items: statusMenuItems(createForm.status, (status) => createForm.status.set(status)),
	});

	const priorityMenu = Menu({
		trigger: Button(
			ReactiveIcon(
				createForm.priority,
				(p) => PRIORITY_META[p].icon,
				(p) => cx("h-4 w-4", PRIORITY_META[p].class),
			),
			Span().content([createForm.priority], (priority) => PRIORITY_META[priority].label),
		)
			.type("button")
			.className(chip),
		items: priorityMenuItems(createForm.priority, (priority) => createForm.priority.set(priority)),
	});

	const assigneeMenu = Menu({
		trigger: Button(
			Icon("user", "h-4 w-4 text-zinc-500"),
			Span().content([createForm.assigneeId], (id) =>
				id === null ? "Assignee" : (store.usersById.get(id)?.name ?? "Assignee"),
			),
		)
			.type("button")
			.className(chip),
		items: assigneeMenuItems(createForm.assigneeId, (id) => createForm.assigneeId.set(id)),
	});

	const toggleLabel = (labelId: string) => {
		createForm.labelIds.update((current) =>
			current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId],
		);
	};

	const labelsMenu = Menu({
		trigger: Button(
			Icon("tag", "h-4 w-4 text-zinc-500"),
			Span().content([createForm.labelIds], (ids) =>
				ids.length === 0 ? "Labels" : `${ids.length} label${ids.length === 1 ? "" : "s"}`,
			),
		)
			.type("button")
			.className(chip),
		items: labelMenuItems(
			(labelId) => new Derived([createForm.labelIds], (ids) => ids.includes(labelId)),
			toggleLabel,
		),
	});

	return Dialog(
		createDialogOpen,
		"max-w-xl",
		Div(
			Span().content("New issue").className("text-[13px] font-medium text-zinc-300"),
			Div().className("flex-1"),
			Button(Icon("x", "h-4 w-4"))
				.type("button")
				.className(
					"flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors duration-100 hover:bg-zinc-800 hover:text-zinc-300 focus:outline-none",
				)
				.on("click", () => createDialogOpen.set(false)),
		).className("flex items-center border-b border-zinc-800/80 px-4 py-3"),

		Div(
			Input()
				.type("text")
				.placeholder("Issue title")
				.value(createForm.title)
				// the dialog subtree is remounted on every open, so this focuses
				// the title field each time
				.afterMount((el) => el.focus())
				.className(
					"w-full bg-transparent text-lg font-medium text-zinc-50 placeholder:text-zinc-600 focus:outline-none",
				)
				.on("keydown", (e) => {
					if (e.key === "Enter") void submit();
				}),
			TextArea({
				value: createForm.description,
				placeholder: "Add a description…",
				rows: 4,
			}).on("keydown", (e) => {
				if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
			}),
			Div(statusMenu, priorityMenu, assigneeMenu, labelsMenu).className(
				"flex flex-wrap items-center gap-2",
			),
		).className("flex flex-col gap-3 px-4 py-4"),

		Div(
			Div().className("flex-1"),
			Button(Span().content("Create issue"))
				.type("button")
				.className([createForm.title], (title) =>
					cx(
						"inline-flex h-8 select-none items-center rounded-md bg-indigo-500 px-3 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60",
						title.trim() === "" && "pointer-events-none opacity-40",
					),
				)
				.on("click", submit),
		).className("flex items-center border-t border-zinc-800/80 px-4 py-3"),
	);
}
