import { Implement, navigateTo, P, type Child } from "@implementjs/core";
import { tutorials } from "@/lib/tutorials";
import { TutorialPage } from "@/lib/views/tutorial-page";

/** Renders the first lesson and settles the URL onto its permalink. */
export default function Page(): Child {
	const first = tutorials[0];
	if (first == null) {
		return P({ class: "p-6 text-sm text-foreground/60" }, "No lessons yet.");
	}

	return Implement.Lifecycle(
		{
			onMount: () => {
				navigateTo(first.permalink, { replace: true });
			},
		},
		TutorialPage(first),
	);
}
