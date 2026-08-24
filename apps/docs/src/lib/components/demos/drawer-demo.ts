import { Div, P, signal } from "@implementjs/core";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
	DrawerTrigger,
} from "@/lib/components/ui/drawer";
import { Button } from "@/lib/components/ui/button";

const MIN = 60;
const MAX = 400;

export default function DrawerDemo() {
	const goal = signal(350);
	const step = (by: number) => goal.update((value) => Math.min(MAX, Math.max(MIN, value + by)));

	return Drawer(
		DrawerTrigger("Move goal"),
		DrawerContent(
			Div(
				{ class: "mx-auto flex w-full max-w-sm flex-col gap-6 p-4 pb-8" },
				Div(
					{ class: "grid gap-1.5" },
					DrawerTitle("Move goal"),
					DrawerDescription("Set your daily activity goal."),
				),
				Div(
					{ class: "flex items-center justify-center gap-6" },
					Button(
						{
							variant: "outline",
							size: "icon",
							class: "rounded-full",
							"aria-label": "Decrease goal",
							disabled: goal.bind((value) => value <= MIN),
							onClick: () => step(-10),
						},
						"−",
					),
					Div(
						{ class: "flex w-24 flex-col items-center" },
						P({ class: "text-5xl font-bold tabular-nums" }, goal),
						P({ class: "text-xs text-muted-foreground uppercase" }, "calories/day"),
					),
					Button(
						{
							variant: "outline",
							size: "icon",
							class: "rounded-full",
							"aria-label": "Increase goal",
							disabled: goal.bind((value) => value >= MAX),
							onClick: () => step(10),
						},
						"+",
					),
				),
				Div(
					{ class: "grid gap-2" },
					DrawerClose({ variant: "default" }, "Submit"),
					DrawerClose("Cancel"),
				),
			),
		),
	);
}
