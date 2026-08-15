import { Div, If, Portal, Signal, type Mountable } from "@packages/ui";
import { cx } from "../../lib/cx";

/**
 * Modal dialog gated on `open`, rendered into `document.body` via Portal so
 * no ancestor stacking/overflow context can trap it. Closes on overlay click
 * and Escape. The Escape listener follows the overlay's lifecycle: attached
 * when the dialog mounts, removed when it unmounts.
 */
export function Dialog(open: Signal<boolean>, panelClass: string, ...children: Mountable[]) {
	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") open.set(false);
	};

	return If(open).Then(
		Portal(
			Div(
				Div(...children)
					.className(
						cx(
							"w-full rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60",
							panelClass,
						),
					)
					.on("click", (e) => e.stopPropagation()),
			)
				.className("fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh]")
				.on("click", () => open.set(false))
				.afterMount(() => document.addEventListener("keydown", onKeyDown))
				.beforeUnmount(() => document.removeEventListener("keydown", onKeyDown)),
		),
	);
}
