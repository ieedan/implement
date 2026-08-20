import { Div, signal, Span } from "@implementjs/core";
import { RatingGroup, RatingGroupItem } from "@/lib/components/ui/rating-group";

export default function RatingGroupDemo() {
	const value = signal(3);

	return Div(
		{ class: "flex flex-col items-center gap-2" },
		RatingGroup(
			{ value, "aria-label": "Rate this library" },
			...Array.from({ length: 5 }, (_, index) => RatingGroupItem({ index })),
		),
		Span(
			{ class: "text-sm text-muted-foreground tabular-nums" },
			value.bind((v) => `${v} out of 5`),
		),
	);
}
