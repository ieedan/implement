import { Div } from "@implementjs/core";
import { Label } from "@/lib/components/ui/label";
import { Textarea } from "@/lib/components/ui/textarea";

export default function TextareaDemo() {
	return Div(
		{ class: "flex w-full max-w-sm flex-col gap-2" },
		Label({ for: "message" }, "Message"),
		Textarea({ id: "message", placeholder: "Tell us what happened…", class: "max-h-40" }),
		Div({ class: "text-sm text-muted-foreground" }, "It grows with what you type."),
	);
}
