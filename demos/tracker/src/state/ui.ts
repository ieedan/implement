import { Signal } from "@packages/ui";
import type { Issue, Priority, Status } from "../api";
import type { IconName } from "../components/ui/icon";

// ---------------------------------------------------------------------------
// Sidebar views
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

export const activeView = new Signal<ViewId>("all");
export const searchQuery = new Signal("");

// ---------------------------------------------------------------------------
// Create-issue dialog
// ---------------------------------------------------------------------------

export const createDialogOpen = new Signal(false);

export const createForm = {
	title: new Signal(""),
	description: new Signal(""),
	status: new Signal<Status>("todo"),
	priority: new Signal<Priority>("none"),
	assigneeId: new Signal<string | null>(null),
	labelIds: new Signal<string[]>([]),
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
