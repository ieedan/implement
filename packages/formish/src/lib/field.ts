import { derived, isReadable, Ref, signal, type Readable } from "@implementjs/core";
import { INTERNAL } from "./internal";
import {
	bump,
	getElementInput,
	getFieldBool,
	getFieldInput,
	getFieldStore,
	isFieldElement,
	pathName,
	setFieldInput,
} from "./store";
import { validateIfRequired } from "./validate";
import type { FormStore } from "./form";
import type {
	FieldElement,
	FieldElementProps,
	FieldErrors,
	FieldPath,
	FormSchema,
	InferInput,
	InternalFieldStore,
	InternalFormStore,
	MaybeReadable,
	PartialValues,
	Path,
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
	readonly path: MaybeReadable<TPath>;
}

export interface FieldStore<
	TSchema extends FormSchema = FormSchema,
	TPath extends FieldPath<InferInput<TSchema>> = FieldPath<InferInput<TSchema>>,
> {
	readonly path: Readable<Path>;
	/** The field's name in the store and on its elements. */
	readonly name: Readable<string>;
	readonly input: Readable<PartialValues<PathValue<InferInput<TSchema>, TPath>>>;
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
	readonly onInput: (input: PartialValues<PathValue<InferInput<TSchema>, TPath>>) => void;
	/** Spread onto the element that edits this field. */
	readonly props: FieldElementProps;
}

/** Both a static and a readable path arrive here as one readable. */
export function toPathReadable(path: MaybeReadable<Path>): Readable<Path> {
	return isReadable<Path>(path) ? path : signal<Path>(path);
}

/** A readable over a field, recomputed whenever anything in the form changes. */
export function fieldReadable<T>(
	form: InternalFormStore,
	path: Readable<Path>,
	read: (field: InternalFieldStore | undefined) => T,
): Readable<T> {
	return derived([form.revision, path], (_, current) => read(getFieldStore(form, current)));
}

/**
 * A ref that registers its element with the field for as long as it is
 * mounted. `props` hands out a new one per spread, so a radio or checkbox
 * group registers each of its elements rather than only the last.
 */
class FieldElementRef extends Ref<HTMLElement> {
	#form: InternalFormStore;
	#path: Readable<Path>;
	#element: FieldElement | null = null;
	#registered: InternalFieldStore | null = null;
	#unwatch: (() => void) | null = null;

	constructor(form: InternalFormStore, path: Readable<Path>) {
		super();
		this.#form = form;
		this.#path = path;
	}

	override set(value: HTMLElement | null): void {
		if (value === null) {
			this.#unwatch?.();
			this.#unwatch = null;
			this.#detach();
			this.#element = null;
		} else if (isFieldElement(value)) {
			this.#element = value;
			this.#attach();
			// a row that moves keeps its elements but changes its path, so the
			// element has to follow it to the field store it now belongs to
			this.#unwatch ??= this.#path.onChange(() => {
				this.#detach();
				this.#attach();
			});
		}
		super.set(value);
	}

	#attach(): void {
		const element = this.#element;
		if (!element) return;
		const field = getFieldStore(this.#form, this.#path.get());
		if (!field) return;
		// an array reorder moves the elements between field stores, so the
		// element may already be registered against the one it moved to
		if (!field.elements.includes(element)) field.elements.push(element);
		this.#registered = field;
	}

	#detach(): void {
		const field = this.#registered;
		const element = this.#element;
		this.#registered = null;
		if (!field || !element) return;
		const elements = field.elements.filter((current) => current !== element);
		// `initialElements` follows while the field still owns its elements; a
		// reorder has moved them otherwise, and they belong to their new field
		if (field.elements === field.initialElements) field.initialElements = elements;
		field.elements = elements;
	}
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
	const name = derived([path], (current) => pathName(current));
	const errors = fieldReadable(store, path, (field) => field?.errors.get() ?? null);

	const write = (input: unknown): void => {
		const current = path.get();
		const field = getFieldStore(store, current);
		if (!field) return;
		setFieldInput(store, current, input);
		validateIfRequired(store, field, "input");
		bump(store);
	};

	const onEvent = (mode: "touch" | "change" | "blur"): void => {
		const field = getFieldStore(store, path.get());
		if (!field) return;
		if (mode === "touch") {
			field.isTouched.set(true);
			bump(store);
		}
		validateIfRequired(store, field, mode);
	};

	const props: FieldElementProps = {
		name,
		autofocus: derived([errors], (current) => Boolean(current)),
		// a getter, so every spread of `props` hands out a ref of its own — one
		// element per ref is what lets a group register all of its elements
		get this() {
			return new FieldElementRef(store, path);
		},
		onFocus: () => onEvent("touch"),
		onInput(event) {
			const field = getFieldStore(store, path.get());
			if (!field) return;
			write(getElementInput(event.currentTarget, field));
		},
		onChange: () => onEvent("change"),
		onBlur: () => onEvent("blur"),
	};

	return {
		path,
		name,
		input: fieldReadable(store, path, (field) =>
			field ? getFieldInput(field) : undefined,
		) as Readable<PartialValues<PathValue<InferInput<TSchema>, TPath>>>,
		errors,
		error: derived([errors], (current) => current?.[0] ?? null),
		isTouched: fieldReadable(store, path, (field) =>
			field ? getFieldBool(field, "isTouched") : false,
		),
		isEdited: fieldReadable(store, path, (field) =>
			field ? getFieldBool(field, "isEdited") : false,
		),
		isDirty: fieldReadable(store, path, (field) =>
			field ? getFieldBool(field, "isDirty") : false,
		),
		isValid: fieldReadable(store, path, (field) => !field || !getFieldBool(field, "errors")),
		onInput: write,
		props,
	};
}
