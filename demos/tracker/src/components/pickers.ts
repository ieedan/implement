import { Computed, Derived, isReadable, Span, type Readable } from "@packages/ui";
import type { Priority, Status } from "../api";
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER } from "../lib/meta";
import { store } from "../state/store";
import { Avatar } from "./ui/avatar";
import type { MenuItem } from "./ui/menu";

/**
 * Item builders shared by every status/priority/assignee/label menu in the app.
 * `current` can be a plain value (for static UI), any Readable (for long-lived
 * forms), or a tracked getter reading a store object (`() => issue.status`).
 */

type MaybeReactive<T> = T | Readable<T> | (() => T);

function selectedFor<T>(current: MaybeReactive<T>, candidate: T): boolean | Readable<boolean> {
	if (typeof current === "function") {
		const get = current as () => T;
		return new Computed(() => get() === candidate);
	}
	if (isReadable<T>(current)) {
		return new Derived([current], (value) => value === candidate);
	}
	return current === candidate;
}

export function statusMenuItems(
	current: MaybeReactive<Status>,
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
	current: MaybeReactive<Priority>,
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
	current: MaybeReactive<string | null>,
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
		...store.users.map((user): MenuItem => ({
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
	return store.labels.map((label): MenuItem => ({
		id: label.id,
		label: label.name,
		leading: Span()
			.style({ backgroundColor: label.color })
			.className("h-2.5 w-2.5 shrink-0 rounded-full"),
		selected: isSelected(label.id),
		keepOpen: true,
		onSelect: () => onToggle(label.id),
	}));
}
