import { Div, signal, Span } from "@implementjs/core";
import { Input } from "@/lib/components/ui/input";
import { Label } from "@/lib/components/ui/label";

export default function InputDemo() {
	const value = signal("");

	return Div(
		{ class: "flex w-full max-w-sm flex-col gap-4" },
		Div(
			{ class: "flex flex-col gap-2" },
			Label({ for: "project" }, "Project name"),
			Input({ id: "project", placeholder: "acme-web", value }),
			Span(
				{ class: "text-sm text-muted-foreground" },
				value.bind((current) => (current === "" ? "Nothing typed yet." : `Typed: ${current}`)),
			),
		),
		Input({ placeholder: "Disabled", disabled: true }),
		Input({ placeholder: "Invalid", "aria-invalid": true }),
	);
}
