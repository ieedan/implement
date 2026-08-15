import type { IconName } from "../components/ui/icon";
import type { Priority, Status } from "../api";

export type StatusMeta = {
	label: string;
	icon: IconName;
	class: string;
};

export const STATUS_META: Record<Status, StatusMeta> = {
	backlog: { label: "Backlog", icon: "statusBacklog", class: "text-zinc-500" },
	todo: { label: "Todo", icon: "statusTodo", class: "text-zinc-300" },
	in_progress: { label: "In Progress", icon: "statusInProgress", class: "text-amber-400" },
	done: { label: "Done", icon: "statusDone", class: "text-indigo-400" },
	canceled: { label: "Canceled", icon: "statusCanceled", class: "text-zinc-500" },
};

/** Display order for grouped issue lists. */
export const STATUS_ORDER: Status[] = ["in_progress", "todo", "backlog", "done", "canceled"];

export type PriorityMeta = {
	label: string;
	icon: IconName;
	class: string;
	rank: number;
};

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
	urgent: { label: "Urgent", icon: "priorityUrgent", class: "text-orange-400", rank: 0 },
	high: { label: "High", icon: "priorityHigh", class: "text-zinc-400", rank: 1 },
	medium: { label: "Medium", icon: "priorityMedium", class: "text-zinc-400", rank: 2 },
	low: { label: "Low", icon: "priorityLow", class: "text-zinc-400", rank: 3 },
	none: { label: "No priority", icon: "priorityNone", class: "text-zinc-500", rank: 4 },
};

/** Display order for priority pickers. */
export const PRIORITY_ORDER: Priority[] = ["none", "urgent", "high", "medium", "low"];
