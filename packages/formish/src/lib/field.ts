import { derived, isReadable, signal, type Readable } from "@implementjs/core";
import { getElementInput, isArrayField } from "./element";
import { INTERNAL, type FormStore } from "./form";
import { getAtPath, isDirtyInput, pathName, type Path } from "./path";
import {
	errorsAt,
	hasErrorsUnder,
	hasFlag,
	markArrayField,
	markEdited,
	markTouched,
	writeInput,
	type InternalFormStore,
} from "./store";
import type { InferInput } from "./standard-schema";
import { validateIfRequired } from "./validate";
import type {
	FieldElementProps,
	FieldErrors,
	FieldPath,
	FormSchema,
	PartialInput,
	PathValue,
} from "./types";

export interface UseFieldConfig<
	TSchema extends FormSchema,
	TPath extends FieldPath<InferInput<TSchema>>,
> {
	/**
	 * Where the field lives, e.g. `["email"]` or `["todos", 0, "label"]`. A
	 * readable path lets a field follow an array item as it moves.
	 */
	readonly path: TPath | Readable<TPath>;
	/**
	 * Force the field to hold a list. Only needed for a group that starts out
	 * empty and carries no `multiple` attribute, such as a set of checkboxes.
	 */
	readonly array?: boolean | undefined;
}

export interface FieldStore<
	TSchema extends FormSchema = FormSchema,
	TPath extends FieldPath<InferInput<TSchema>> = FieldPath<InferInput<TSchema>>,
> {
	readonly path: Readable<Path>;
	/** The field's name in the store and on its elements. */
	readonly name: Readable<string>;
	readonly input: Readable<PartialInput<PathValue<InferInput<TSchema>, TPath>>>;
	readonly errors: Readable<FieldErrors | null>;
	/** The first error, which is what a field usually shows. */
	readonly error: Readable<string | null>;
	readonly isTouched: Readable<boolean>;
	readonly isEdited: Readable<boolean>;
	readonly isDirty: Readable<boolean>;
	readonly isValid: Readable<boolean>;
	/**
	 * Writes the field, as an element's handler would. Use it for values the
	 * DOM cannot express — a number, a date — or for a custom component.
	 */
	readonly setInput: (input: PartialInput<PathValue<InferInput<TSchema>, TPath>>) => void;
	/** Spread onto the element that edits this field. */
	readonly props: FieldElementProps;
}

/** Both a static and a readable path arrive here as one readable. */
function toPathReadable(path: Path | Readable<Path>): Readable<Path> {
	return isReadable<Path>(path) ? path : signal(path);
}

/**
 * Connects a field of the form to whatever renders it. The returned readables
 * update on their own, so the field's value, errors and state can be bound
 * straight into the DOM.
 *
 * ```ts
 * const email = useField(form, { path: ["email"] });
 * Input({ ...email.props, type: "email", value: email.input });
 * ```
 */
export function useField<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: FormStore<TSchema>, config: UseFieldConfig<TSchema, TPath>): FieldStore<TSchema, TPath> {
	const store: InternalFormStore = form[INTERNAL];
	const path = toPathReadable(config.path);
	const name = derived([path], (value) => pathName(value));

	if (config.array) markArrayField(store, path.get());

	const errors = derived([store.errors, path], (map, value) => errorsAt(map, value));

	const write = (input: unknown, mode: "input" | "change"): void => {
		const target = path.get();
		if (config.array) markArrayField(store, target);
		writeInput(store, target, input);
		markTouched(store, target);
		markEdited(store, target);
		validateIfRequired(store, target, mode);
	};

	const props: FieldElementProps = {
		name,
		onFocus() {
			const target = path.get();
			markTouched(store, target);
			validateIfRequired(store, target, "touch");
		},
		onInput(event) {
			const target = path.get();
			const element = event.currentTarget;
			const array = isArrayField(store, target, config.array, element);
			write(getElementInput(store, element, target, array), "input");
		},
		onChange() {
			validateIfRequired(store, path.get(), "change");
		},
		onBlur() {
			validateIfRequired(store, path.get(), "blur");
		},
	};

	return {
		path,
		name,
		input: derived([store.input, path], (input, value) => getAtPath(input, value)) as Readable<
			PartialInput<PathValue<InferInput<TSchema>, TPath>>
		>,
		errors,
		error: derived([errors], (value) => value?.[0] ?? null),
		isTouched: derived([store.touched, path], (touched, value) => hasFlag(touched, value)),
		isEdited: derived([store.edited, path], (edited, value) => hasFlag(edited, value)),
		isDirty: derived([store.input, store.startInput, path], (input, start, value) =>
			isDirtyInput(getAtPath(start, value), getAtPath(input, value)),
		),
		isValid: derived([store.errors, path], (map, value) => !hasErrorsUnder(map, value)),
		setInput: (input) => write(input, "input"),
		props,
	};
}
