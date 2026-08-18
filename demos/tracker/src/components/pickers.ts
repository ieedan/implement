import { derived, isReadable, Span, type Readable } from "@implementjs/core";
import type { Priority, Status } from "../api";
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER } from "../lib/meta";
import { labels, users } from "../state/store";
import { Avatar } from "./ui/avatar";
import type { MenuItem } from "./ui/menu";

/**
 * Item builders shared by every status/priority/assignee/label menu in the app.
 * `current` can be a plain value (for static UI) or any Readable (for
 * long-lived forms and rows that patch in place).
 */

type MaybeReadable<T> = T | Readable<T>;

function selectedFor<T>(current: MaybeReadable<T>, candidate: T): boolean | Readable<boolean> {
	if (isReadable<T>(current)) {
		return derived([current], (value) => value === candidate);
	}
	return current === candidate;
}

export function statusMenuItems(
	current: MaybeReadable<Status>,
	onSelect: (status: Status) => void,
): MenuItem[] {
	return STATUS_ORDER.map((status) => ({
		id: status,
		label: STATUS_META[status].label,
		icon: STATUS_META[status].icon,
		iconClass: STATUS_META[status].class,
		selected: selectedFor(current, status),
		onSelect: () => onSelect(status),
	}));
}

export function priorityMenuItems(
	current: MaybeReadable<Priority>,
	onSelect: (priority: Priority) => void,
): MenuItem[] {
	return PRIORITY_ORDER.map((priority) => ({
		id: priority,
		label: PRIORITY_META[priority].label,
		icon: PRIORITY_META[priority].icon,
		iconClass: PRIORITY_META[priority].class,
		selected: selectedFor(current, priority),
		onSelect: () => onSelect(priority),
	}));
}

export function assigneeMenuItems(
	current: MaybeReadable<string | null>,
	onSelect: (userId: string | null) => void,
): MenuItem[] {
	const unassigned: MenuItem = {
		id: "unassigned",
		label: "Unassigned",
		icon: "userDashed",
		iconClass: "text-zinc-500",
		selected: selectedFor(current, null),
		onSelect: () => onSelect(null),
	};

	return [
		unassigned,
		...users.get().map((user): MenuItem => ({
			id: user.id,
			label: user.name,
			leading: Avatar(user),
			selected: selectedFor(current, user.id),
			onSelect: () => onSelect(user.id),
		})),
	];
}

export function labelMenuItems(
	isSelected: (labelId: string) => boolean | Readable<boolean>,
	onToggle: (labelId: string) => void,
): MenuItem[] {
	return labels.get().map((label): MenuItem => ({
		id: label.id,
		label: label.name,
		leading: Span({
			class: "h-2.5 w-2.5 shrink-0 rounded-full",
			style: { backgroundColor: label.color },
		}),
		selected: isSelected(label.id),
		keepOpen: true,
		onSelect: () => onToggle(label.id),
	}));
}
