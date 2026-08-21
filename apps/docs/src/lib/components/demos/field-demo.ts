import { Checkbox } from "@/lib/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
} from "@/lib/components/ui/field";
import { Input } from "@/lib/components/ui/input";
import { Textarea } from "@/lib/components/ui/textarea";

export default function FieldDemo() {
	return FieldSet(
		{ class: "w-full max-w-md" },
		FieldLegend("Report a bug"),
		FieldGroup(
			Field(
				FieldLabel({ for: "field-title" }, "Title"),
				Input({ id: "field-title", placeholder: "Dialog does not close on Escape" }),
				FieldDescription("One line describing what went wrong."),
			),
			Field(
				{ "data-invalid": "true" },
				FieldLabel({ for: "field-steps" }, "Steps to reproduce"),
				Textarea({ id: "field-steps", "aria-invalid": true, placeholder: "1. Open the dialog…" }),
				FieldError("Tell us how to reproduce it before submitting."),
			),
			FieldSeparator("and"),
			Field(
				{ orientation: "horizontal" },
				Checkbox({ id: "field-subscribe" }),
				FieldContent(
					FieldTitle("Email me about this"),
					FieldDescription("We only write when the status changes."),
				),
			),
		),
	);
}
