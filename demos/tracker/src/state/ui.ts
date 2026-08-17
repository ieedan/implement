import { signal } from "@packages/implement";
import type { Issue, Priority, Status } from "../api";
import type { IconName } from "../components/ui/icon";

// ---------------------------------------------------------------------------
// Sidebar views — the active view lives in the URL (`/` and `/views/:view`),
// not in a signal; the router owns it.
// ---------------------------------------------------------------------------

export type ViewId = "all" | "mine" | "active" | "backlog";

export type ViewMeta = {
	id: ViewId;
	label: string;
	icon: IconName;
	filter: (issue: Issue, currentUserId: string | null) => boolean;
};

export const VIEWS: ViewMeta[] = [
	{ id: "all", label: "All Issues", icon: "list", filter: () => true },
	{
		id: "mine",
		label: "My Issues",
		icon: "user",
		filter: (issue, currentUserId) => currentUserId !== null && issue.assigneeId === currentUserId,
	},
	{
		id: "active",
		label: "Active",
		icon: "statusInProgress",
		filter: (issue) => issue.status === "todo" || issue.status === "in_progress",
	},
	{
		id: "backlog",
		label: "Backlog",
		icon: "statusBacklog",
		filter: (issue) => issue.status === "backlog",
	},
];

export function viewById(id: string): ViewMeta {
	return VIEWS.find((view) => view.id === id) ?? VIEWS[0]!;
}

// ---------------------------------------------------------------------------
// Create-issue dialog
// ---------------------------------------------------------------------------

export const createDialogOpen = signal(false);

export const createForm = {
	title: signal(""),
	description: signal(""),
	status: signal<Status>("todo"),
	priority: signal<Priority>("none"),
	assigneeId: signal<string | null>(null),
	labelIds: signal<string[]>([]),
};

export function openCreateDialog(preset?: { status?: Status }) {
	createForm.title.set("");
	createForm.description.set("");
	createForm.status.set(preset?.status ?? "todo");
	createForm.priority.set("none");
	createForm.assigneeId.set(null);
	createForm.labelIds.set([]);
	createDialogOpen.set(true);
}
