import { Div } from "@implementjs/core";
import { Skeleton } from "@/lib/components/ui/skeleton";

export default function SkeletonDemo() {
	return Div(
		{ class: "flex w-full max-w-sm items-center gap-4" },
		Skeleton({ class: "size-12 shrink-0 rounded-full" }),
		Div(
			{ class: "flex flex-1 flex-col gap-2" },
			Skeleton({ class: "h-4 w-full" }),
			Skeleton({ class: "h-4 w-2/3" }),
		),
	);
}
