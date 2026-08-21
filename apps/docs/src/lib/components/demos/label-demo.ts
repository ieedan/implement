import { Div } from "@implementjs/core";
import { Checkbox } from "@/lib/components/ui/checkbox";
import { Input } from "@/lib/components/ui/input";
import { Label } from "@/lib/components/ui/label";

export default function LabelDemo() {
	return Div(
		{ class: "flex w-full max-w-sm flex-col gap-4" },
		Div(
			{ class: "flex flex-col gap-2" },
			Label({ for: "email" }, "Email"),
			Input({ id: "email", type: "email", placeholder: "you@example.com" }),
		),
		Div(
			{ class: "flex items-center gap-2" },
			Checkbox({ id: "remember" }),
			Label({ for: "remember" }, "Remember me"),
		),
	);
}
