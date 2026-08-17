import {
	Div,
	If,
	Portal,
	UIFramework,
	type Child,
	type Mountable,
	type Signal,
} from "@packages/ui_v2";
import { cx } from "../../lib/cx";

/**
 * Modal dialog gated on `open`, rendered into `document.body` via Portal so
 * no ancestor stacking/overflow context can trap it. Closes on overlay click
 * and Escape. The listeners live in the `If` branch, so they are only
 * attached while the dialog is open.
 */
export function Dialog(open: Signal<boolean>, panelClass: string, ...children: Child[]): Mountable {
	return If(open).Then(
		Portal(
			Div(
				{
					class: "fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[14vh]",
					onClick: () => open.set(false),
				},
				Div(
					{
						class: cx(
							"w-full rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/60",
							panelClass,
						),
						onClick: (event) => event.stopPropagation(),
					},
					...children,
				),
			),
		),
		UIFramework.Document({
			onKeydown: (event) => {
				if (event.key === "Escape") open.set(false);
			},
		}),
	);
}
