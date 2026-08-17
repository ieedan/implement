import { Button, type Child, type ElementProps, type Mountable } from "@packages/ui_v2";
import { cx } from "../../lib/cx";

const base =
	"inline-flex select-none items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 disabled:pointer-events-none disabled:opacity-40";

type ButtonProps = Omit<ElementProps<"button">, "class"> & { class?: string };

function variant(classes: string) {
	return (props: ButtonProps, ...children: Child[]): Mountable =>
		Button({ type: "button", ...props, class: cx(base, classes, props.class) }, ...children);
}

/** Filled call-to-action button. */
export const PrimaryButton = variant("h-8 bg-indigo-500 px-3 text-white hover:bg-indigo-400");

/** Bordered secondary button. */
export const SecondaryButton = variant(
	"h-8 border border-zinc-700/80 bg-zinc-900 px-3 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800",
);

/** Borderless button for low-emphasis actions. */
export const GhostButton = variant("h-7 px-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200");
