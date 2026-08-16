import { Derived, Div, If, type Readable } from "@packages/ui";
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
export function Avatar(user: User | null, size: keyof typeof SIZES = "sm") {
	if (!user) {
		return Icon("userDashed", cx(SIZES[size], "text-zinc-500"));
	}

	return Div()
		.content(initials(user.name))
		.style({ backgroundColor: user.color })
		.className(circleClass(size));
}

/** Avatar that tracks a readable user (for rows that patch in place). */
export function ReactiveAvatar(user: Readable<User | null>, size: keyof typeof SIZES = "sm") {
	const color = new Derived([user], (user) => user?.color ?? "transparent");

	return If(user)
		.Then(
			Div()
				.content([user], (user) => initials(user?.name ?? ""))
				.style({ backgroundColor: color })
				.className(circleClass(size)),
		)
		.Else(Icon("userDashed", cx(SIZES[size], "text-zinc-500")));
}
