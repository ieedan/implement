import { Div, ImplementLifecycle, signal, Span } from "@implementjs/core";
import { Progress } from "@/lib/components/ui/progress";

export default function ProgressDemo() {
	const value = signal<number | null>(13);

	return Div(
		{ class: "flex w-full max-w-sm flex-col gap-2" },
		ImplementLifecycle({
			onMount: () => {
				const timer = setInterval(() => {
					value.update((v) => (v === null || v >= 100 ? 13 : Math.min(100, v + 29)));
				}, 1000);
				return () => clearInterval(timer);
			},
		}),
		Div(
			{ class: "flex items-center justify-between text-sm font-medium" },
			Span({ id: "upload-label" }, "Uploading photos"),
			Span(
				{ class: "tabular-nums" },
				value.bind((v) => `${v ?? 0}%`),
			),
		),
		Progress({ "aria-labelledby": "upload-label", value }),
	);
}
