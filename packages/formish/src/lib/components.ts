import {
	Form as FormElement,
	Fragment,
	type Child,
	type ElementProps,
	type Mountable,
} from "@implementjs/core";
import { useField, type FieldStore, type UseFieldConfig } from "./field";
import { useFieldArray, type FieldArrayStore, type UseFieldArrayConfig } from "./field-array";
import { INTERNAL, type FormStore } from "./form";
import { handleSubmit, type SubmitHandler } from "./methods";
import type { InferInput } from "./standard-schema";
import type { ArrayPath, FieldPath, FormSchema } from "./types";

export type FormProps<TSchema extends FormSchema> = Omit<
	ElementProps<"form">,
	"onSubmit" | "noValidate" | "this"
> & {
	/** The form this element submits. */
	readonly of: FormStore<TSchema>;
	/** Runs with the schema's output once the input validates. */
	readonly onSubmit: SubmitHandler<TSchema>;
};

/**
 * The `<form>` element behind a form store. It validates on submit, hands the
 * output to `onSubmit`, and focuses the first field with an error — the
 * browser's own validation stays out of the way.
 *
 * ```ts
 * Form({ of: form, onSubmit: (output) => api.signUp(output) },
 * 	Field({ of: form, path: ["email"] }, (field) => …),
 * 	Button({ type: "submit" }, "Sign up"),
 * );
 * ```
 */
export function Form<TSchema extends FormSchema>(
	props: FormProps<TSchema>,
	...children: Child[]
): Mountable {
	const { of, onSubmit, ...rest } = props;
	return FormElement(
		{
			...(rest as ElementProps<"form">),
			noValidate: true,
			this: of[INTERNAL].element,
			onSubmit: handleSubmit(of, onSubmit),
		},
		...children,
	);
}

export interface FieldProps<
	TSchema extends FormSchema,
	TPath extends FieldPath<InferInput<TSchema>>,
> extends UseFieldConfig<TSchema, TPath> {
	readonly of: FormStore<TSchema>;
}

/**
 * Renders a field. The same as calling `useField` and rendering the result,
 * with the field's path and the markup that reads it kept side by side.
 *
 * ```ts
 * Field({ of: form, path: ["email"] }, (field) =>
 * 	Div(
 * 		Input({ ...field.props, type: "email", value: field.input }),
 * 		If(field.error).Then(() => Span(field.error)),
 * 	),
 * );
 * ```
 */
export function Field<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	props: FieldProps<TSchema, TPath>,
	render: (field: FieldStore<TSchema, TPath>) => Child | Child[],
): Mountable {
	return Fragment(...toChildren(render(useField(props.of, props)))) as Mountable;
}

export interface FieldArrayProps<
	TSchema extends FormSchema,
	TPath extends ArrayPath<InferInput<TSchema>>,
> extends UseFieldArrayConfig<TSchema, TPath> {
	readonly of: FormStore<TSchema>;
}

/**
 * Renders an array field, whose items are rendered by id so a row keeps its
 * element — and its state — when the list is reordered.
 */
export function FieldArray<
	TSchema extends FormSchema,
	const TPath extends ArrayPath<InferInput<TSchema>>,
>(
	props: FieldArrayProps<TSchema, TPath>,
	render: (field: FieldArrayStore<TSchema, TPath>) => Child | Child[],
): Mountable {
	return Fragment(...toChildren(render(useFieldArray(props.of, props)))) as Mountable;
}

function toChildren(result: Child | Child[]): Child[] {
	return Array.isArray(result) ? result : [result];
}
