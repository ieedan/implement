import { derived, Div, If, type Mountable, type Readable } from "@packages/ui_v2";
import type { User } from "../../api";
import { cx } from "../../lib/cx";
import { Icon } from "./icon";

const SIZES = {
	sm: "h-[18px] w-[18px] text-[8px]",
	md: "h-6 w-6 text-[10px]",
} as const;

function initials(name: string): string {
	return name
		.split(" ")
		.slice(0, 2)
		.map((word) => word[0] ?? "")
		.join("")
		.toUpperCase();
}

const circleClass = (size: keyof typeof SIZES) =>
	cx(
		SIZES[size],
		"flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white/90",
	);

/** Colored initials circle; a dashed placeholder when `user` is null. */
export function Avatar(user: User | null, size: keyof typeof SIZES = "sm"): Mountable {
	if (!user) {
		return Icon("userDashed", cx(SIZES[size], "text-zinc-500"));
	}

	return Div(
		{ class: circleClass(size), style: { backgroundColor: user.color } },
		initials(user.name),
	);
}

/** Avatar that tracks a readable user (for rows that patch in place). */
export function ReactiveAvatar(
	user: Readable<User | null>,
	size: keyof typeof SIZES = "sm",
): Mountable {
	return If(user)
		.Then(
			Div(
				{
					class: circleClass(size),
					style: { backgroundColor: derived([user], (user) => user?.color ?? "transparent") },
				},
				derived([user], (user) => initials(user?.name ?? "")),
			),
		)
		.Else(Icon("userDashed", cx(SIZES[size], "text-zinc-500")));
}
