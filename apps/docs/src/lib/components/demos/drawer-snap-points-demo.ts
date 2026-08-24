import { Div, ForEach, P, signal } from "@implementjs/core";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
	DrawerTrigger,
} from "@/lib/components/ui/drawer";

const releases = [
	{ version: "0.4.0", note: "Snap points, and an overlay that fades between them." },
	{ version: "0.3.2", note: "Focus returns to the trigger that opened the panel." },
	{ version: "0.3.1", note: "A drag no longer clicks whatever it started on." },
	{ version: "0.3.0", note: "Four directions, one set of offset variables." },
	{ version: "0.2.4", note: "Scroll containers keep their scroll until they reach the edge." },
	{ version: "0.2.3", note: "Rubber band past the open position instead of a hard stop." },
	{ version: "0.2.2", note: "Velocity decides the landing, not just the distance." },
	{ version: "0.2.1", note: "Escape and the scrim both dismiss." },
];

export default function DrawerSnapPointsDemo() {
	const snap = signal<number | string | null>(0.4);

	return Drawer(
		{ snapPoints: [0.4, 0.75, 1], activeSnapPoint: snap, fadeFromIndex: 1 },
		DrawerTrigger("Changelog"),
		DrawerContent(
			Div(
				{ class: "mx-auto flex w-full max-w-md flex-col gap-1.5 px-4" },
				DrawerTitle("Changelog"),
				DrawerDescription(
					snap.bind((point) =>
						point === 1 ? "Drag down to shrink it back." : "Drag up, or tap the handle, for more.",
					),
				),
			),
			Div(
				{ class: "mt-4 flex-1 overflow-y-auto overscroll-contain px-4 pb-8" },
				Div(
					{ class: "mx-auto grid w-full max-w-md gap-3" },
					ForEach(
						releases,
						(release) => release.version,
						(release) =>
							Div(
								{ class: "rounded-lg border bg-card p-3" },
								P({ class: "text-sm font-medium" }, release.bind("version")),
								P({ class: "text-sm text-muted-foreground" }, release.bind("note")),
							),
					),
				),
			),
		),
	);
}
