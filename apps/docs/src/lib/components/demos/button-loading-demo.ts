import { Div, signal } from "@implementjs/core";
import { RefreshCwIcon } from "@implementjs/lucide";
import { Button } from "@/lib/components/ui/button";

function save() {
	return new Promise<void>((resolve) => setTimeout(resolve, 2000));
}

export default function ButtonLoadingDemo() {
	const publishing = signal(false);

	return Div(
		{ class: "flex flex-wrap items-center justify-center gap-2" },
		// the state the button owns: it loads until the promise settles
		Button({ onClickPromise: save }, "Save"),
		// the state you own: flip a signal and the button follows
		Button(
			{
				variant: "outline",
				loading: publishing,
				onClick: () => {
					publishing.set(true);
					void save().finally(() => publishing.set(false));
				},
			},
			"Publish",
		),
		Button(
			{ variant: "outline", size: "icon", "aria-label": "Refresh", onClickPromise: save },
			RefreshCwIcon({ "aria-hidden": true }),
		),
		Button({ loading: true }, "Always loading"),
	);
}
