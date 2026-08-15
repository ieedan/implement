import { Button, type Mountable } from "@packages/ui";
import { cx } from "../../lib/cx";
import { Icon, type IconName } from "./icon";

const base =
	"inline-flex select-none items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60";

/** Filled call-to-action button. */
export function PrimaryButton(...children: Mountable[]) {
	return Button(...children)
		.type("button")
		.className(cx(base, "h-8 bg-indigo-500 px-3 text-white hover:bg-indigo-400"));
}

/** Bordered secondary button. */
export function SecondaryButton(...children: Mountable[]) {
	return Button(...children)
		.type("button")
		.className(
			cx(
				base,
				"h-8 border border-zinc-700/80 bg-zinc-900 px-3 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800",
			),
		);
}

/** Borderless button for low-emphasis actions. */
export function GhostButton(...children: Mountable[]) {
	return Button(...children)
		.type("button")
		.className(cx(base, "h-7 px-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"));
}

/** Square icon-only button. */
export function IconButton(name: IconName, iconClass = "h-4 w-4") {
	return Button(Icon(name, iconClass))
		.type("button")
		.className(cx(base, "h-7 w-7 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"));
}
