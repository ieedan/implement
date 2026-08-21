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
 * Creates a form from a schema. The schema types the fields, validates the
 * input and produces the output a submit handler receives — anything
 * implementing [Standard Schema](https://standardschema.dev) works, so valibot,
 * zod and arktype are all fair game.
 *
 * ```ts
 * const form = createForm({
 * 	schema: v.object({ email: v.pipe(v.string(), v.email()) }),
 * 	initialInput: { email: "" },
 * });
 * ```
 */
export function createForm<TSchema extends FormSchema>(
	config: FormConfig<TSchema>,
): FormStore<TSchema> {
	const store = createFormStore(config);

	// deferred so the first validation reports on a mounted form: its elements
	// are what tell an empty text field apart from a missing one
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
