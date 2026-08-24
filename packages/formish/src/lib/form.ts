import { derived, type Readable } from "@implementjs/core";
import { INTERNAL } from "./internal";
import { createFormStore, getFieldBool, getFieldInput } from "./store";
import { validateFormInput } from "./validate";
import type {
	BaseFormStore,
	FieldErrors,
	FormConfig,
	FormSchema,
	InferInput,
	InternalFormStore,
	PartialValues,
} from "./types";
import * as v from "valibot";

export interface FormStore<TSchema extends FormSchema = FormSchema> extends BaseFormStore<TSchema> {
	/**
	 * What the fields currently hold. Formisch reads this with `getInput`; a
	 * readable is what the same thing looks like when it can be bound.
	 */
	readonly input: Readable<PartialValues<InferInput<TSchema>>>;
	/**
	 * The errors of the form itself — issues the schema reported without a
	 * path, such as a check across two fields. For everything below it, use
	 * `getDeepErrors`.
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
	const store: InternalFormStore<TSchema> = createFormStore(config, (input) =>
		v.safeParseAsync(config.schema, input),
	);

	// deferred so nothing is validated before the caller holds the store; what
	// is validated does not depend on it, since the schema has already filled
	// the fields in
	if (store.validate === "initial") {
		queueMicrotask(() => void validateFormInput(store));
	}

	return {
		[INTERNAL]: store,
		input: derived([store.revision], () => getFieldInput(store)) as Readable<
			PartialValues<InferInput<TSchema>>
		>,
		errors: store.errors,
		isSubmitting: store.isSubmitting,
		isSubmitted: store.isSubmitted,
		isValidating: store.isValidating,
		isTouched: derived([store.revision], () => getFieldBool(store, "isTouched")),
		isEdited: derived([store.revision], () => getFieldBool(store, "isEdited")),
		isDirty: derived([store.revision], () => getFieldBool(store, "isDirty")),
		isValid: derived([store.revision], () => !getFieldBool(store, "errors")),
	};
}
