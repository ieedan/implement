import { If, signal } from "@implementjs/core";
import { createForm, Form, useField } from "@implementjs/formish";
import * as v from "valibot";
import { Button } from "@/lib/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/lib/components/ui/field";
import { Input } from "@/lib/components/ui/input";

const SignUpSchema = v.object({
	email: v.pipe(
		v.string(),
		v.minLength(1, "Enter your email"),
		v.email("That does not look like an email"),
	),
	password: v.pipe(v.string(), v.minLength(8, "At least 8 characters")),
});

type SignUpForm = ReturnType<typeof createForm<typeof SignUpSchema>>;

export default function SignUpFormDemo() {
	const form = createForm({ schema: SignUpSchema, validate: "blur" });
	const signedUpAs = signal("");

	return Form(
		{
			of: form,
			onSubmit: (output) => signedUpAs.set(output.email),
			class: "w-full max-w-sm",
		},
		FieldGroup(
			TextField(form, {
				path: "email",
				label: "Email",
				type: "email",
				description: "We only use it to sign you in.",
			}),
			TextField(form, { path: "password", label: "Password", type: "password" }),
			Button({ type: "submit", disabled: form.isSubmitting }, "Sign up"),
			If(signedUpAs).Then(FieldDescription(signedUpAs.bind((email) => `Signed up as ${email}`))),
		),
	);
}

/**
 * One field of the form. The state comes from formish, the look from the ui
 * `Field` components: `data-invalid` on the field turns the label and the
 * message destructive, `aria-invalid` on the control is what gets announced.
 */
function TextField(
	form: SignUpForm,
	{
		path,
		label,
		type,
		description,
	}: {
		path: "email" | "password";
		label: string;
		type: "email" | "password";
		description?: string;
	},
) {
	const field = useField(form, { path: [path] });
	const id = `signup-${path}`;
	// set only while the field has an error: `data-invalid` styles the field,
	// `aria-invalid` announces it
	const invalid = field.errors.bind((errors) => (errors ? "true" : undefined));

	return Field(
		{ "data-invalid": invalid },
		FieldLabel({ for: id }, label),
		Input({ ...field.props, id, type, value: field.input, "aria-invalid": invalid }),
		...(description ? [FieldDescription(description)] : []),
		If(field.error).Then(FieldError(field.error)),
	);
}
