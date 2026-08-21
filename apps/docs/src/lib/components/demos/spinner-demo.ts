import { Div } from "@implementjs/core";
import { Button } from "@/lib/components/ui/button";
import { Spinner } from "@/lib/components/ui/spinner";

export default function SpinnerDemo() {
	return Div(
		{ class: "flex flex-wrap items-center justify-center gap-6" },
		Spinner({ "aria-label": "Loading projects" }),
		Spinner({ class: "size-6 text-muted-foreground", "aria-label": "Loading" }),
		Button({ disabled: true }, Spinner(), "Saving"),
	);
}
