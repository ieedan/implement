import { Div, Input, Label, P, Span, signal } from "@implementjs/core";
import { createForm, Field, Form } from "@implementjs/formish";
import * as v from "valibot";
import { Button } from "@/lib/components/ui/button";

const SignUpSchema = v.object({
	email: v.pipe(
		v.string(),
		v.minLength(1, "Enter your email"),
		v.email("That does not look like an email"),
	),
	password: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),
});

const inputClass =
	"h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function SignUpFormDemo() {
	const form = createForm({ schema: SignUpSchema, validate: "blur" });
	const signedUpAs = signal("");

	return Form(
		{
			of: form,
			onSubmit: (output) => signedUpAs.set(output.email),
			class: "flex w-full max-w-xs flex-col gap-4",
		},
		TextField(form, "email", "Email", "email"),
		TextField(form, "password", "Password", "password"),
		Button({ type: "submit", disabled: form.isSubmitting }, "Sign up"),
		P(
			{ class: "min-h-5 text-sm text-muted-foreground" },
			signedUpAs.bind((email) => (email ? `Signed up as ${email}` : "")),
		),
	);
}

function TextField(
	form: ReturnType<typeof createForm<typeof SignUpSchema>>,
	path: "email" | "password",
	label: string,
	type: "email" | "password",
) {
	return Field({ of: form, path: [path] }, (field) =>
		Div(
			{ class: "flex flex-col gap-1.5" },
			Label({ for: `signup-${path}`, class: "text-sm font-medium" }, label),
			Input({ ...field.props, id: `signup-${path}`, type, class: inputClass, value: field.input }),
			Span({ class: "min-h-4 text-xs text-destructive" }, field.error),
		),
	);
}
