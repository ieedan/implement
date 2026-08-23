import { derived, type Readable } from "@implementjs/core";
import { isDirtyInput } from "./path";
import { createFormStore, ROOT_NAME, type InternalFormStore } from "./store";
import { validateInput } from "./validate";
import type { FieldErrors, FormConfig, FormInput, FormSchema } from "./types";

/** The key the internal store hangs off a form store. */
export const INTERNAL: unique symbol = Symbol("formish.internal");

export interface FormStore<TSchema extends FormSchema = FormSchema> {
	/** @internal */
	readonly [INTERNAL]: InternalFormStore;
	/** What the fields currently hold. */
	readonly input: Readable<FormInput<TSchema>>;
	/**
	 * The errors of the form itself — issues the schema reported without a
	 * path, such as a check across two fields. Field errors live on the field.
	 */
	readonly errors: Readable<FieldErrors | null>;
	readonly isSubmitting: Readable<boolean>;
	readonly isSubmitted: Readable<boolean>;
	readonly isValidating: Readable<boolean>;
	/** Whether any field has been focused or written to. */
	readonly isTouched: Readable<boolean>;
	/** Whether any field's value has been changed. */
	readonly isEdited: Readable<boolean>;
	/** Whether any field differs from what it started at. */
	readonly isDirty: Readable<boolean>;
	/** Whether the last validation left no errors anywhere. */
	readonly isValid: Readable<boolean>;
}

/**
 * Creates a form from a [valibot](https://valibot.dev) schema. The schema types
 * the fields, validates the input and produces the output a submit handler
 * receives — and, because formish walks it up front, gives every field a
 * starting value whether or not anything ever renders one.
 *
 * ```ts
 * const form = createForm({
 * 	schema: v.object({ email: v.pipe(v.string(), v.email()) }),
 * 	initialInput: { email: "hi@example.com" },
 * });
 * ```
 */
export function createForm<TSchema extends FormSchema>(
	config: FormConfig<TSchema>,
): FormStore<TSchema> {
	const store = createFormStore(config);

	// deferred so nothing is validated before the caller holds the store; what
	// is validated does not depend on it, since the schema has already filled
	// the fields in
	if (store.validate === "initial") {
		queueMicrotask(() => void validateInput(store));
	}

	return {
		[INTERNAL]: store,
		input: store.input as unknown as Readable<FormInput<TSchema>>,
		errors: derived([store.errors], (errors) => errors.get(ROOT_NAME) ?? null),
		isSubmitting: store.isSubmitting,
		isSubmitted: store.isSubmitted,
		isValidating: store.isValidating,
		isTouched: derived([store.touched], (touched) => touched.size > 0),
		isEdited: derived([store.edited], (edited) => edited.size > 0),
		isDirty: derived([store.input, store.startInput], (input, start) => isDirtyInput(start, input)),
		isValid: derived([store.errors], (errors) => errors.size === 0),
	};
}
