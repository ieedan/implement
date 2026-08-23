import { Div, P } from "@implementjs/core";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
	DrawerTrigger,
} from "@/lib/components/ui/drawer";
import type { DrawerDirection } from "@implementjs/primitives";

const directions: DrawerDirection[] = ["top", "right", "bottom", "left"];

function DirectionDrawer(direction: DrawerDirection) {
	return Drawer(
		{ direction },
		DrawerTrigger({ size: "sm" }, direction),
		DrawerContent(
			Div(
				{ class: "flex flex-1 flex-col justify-center gap-1.5 p-6" },
				DrawerTitle(`From the ${direction}`),
				DrawerDescription("Drag it back the way it came, or press Escape."),
			),
		),
	);
}

export default function DrawerDirectionsDemo() {
	return Div(
		{ class: "flex flex-col items-center gap-3" },
		Div({ class: "flex flex-wrap justify-center gap-2" }, ...directions.map(DirectionDrawer)),
		P({ class: "text-xs text-muted-foreground" }, "Every panel drags out the edge it came in on."),
	);
}
