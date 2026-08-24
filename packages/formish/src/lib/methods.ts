import { isReadable } from "@implementjs/core";
import type * as v from "valibot";
import { INTERNAL } from "./internal";
import {
	bump,
	childOf,
	copyItemState,
	createId,
	createItemStore,
	focusFieldElement,
	getDirtyFieldInput,
	getFieldBool,
	getFieldInput,
	getFieldStore,
	resetItemState,
	setFieldInput,
	setInitialFieldInput,
	swapItemState,
	walkFieldStore,
} from "./store";
import { validateFormInput, validateIfRequired, type ValidateConfig } from "./validate";
import type {
	ArrayPath,
	BaseFormStore,
	DeepPartial,
	DirtyPath,
	FieldErrors,
	FieldPath,
	FormSchema,
	InferInput,
	InternalArrayStore,
	InternalFieldStore,
	InternalFormStore,
	MaybeReadable,
	PartialValues,
	Path,
	PathValue,
	RequiredPath,
	SubmitEventHandler,
	SubmitHandler,
	SubmitLikeEvent,
} from "./types";

/** A path may arrive as a readable, so a method can follow an array item. */
function resolve<TPath extends Path>(path: MaybeReadable<TPath> | undefined): Path {
	if (path === undefined) return [];
	return isReadable<TPath>(path) ? path.get() : path;
}

/** The field a config points at: the one at `path`, or the form itself. */
function fieldAt(
	form: InternalFormStore,
	config?: { readonly path?: MaybeReadable<Path> | undefined },
): InternalFieldStore | undefined {
	return config?.path ? getFieldStore(form, resolve(config.path)) : form;
}

function arrayAt(
	form: InternalFormStore,
	path: MaybeReadable<Path>,
): InternalArrayStore | undefined {
	const field = getFieldStore(form, resolve(path));
	return field?.kind === "array" ? field : undefined;
}

/** A config naming a field, or naming none and meaning the whole form. */
export interface FieldConfig<TPath extends Path> {
	/** The field to act on. Leave it out for the whole form. */
	readonly path?: MaybeReadable<TPath> | undefined;
}

/** A config naming a field it cannot do without. */
export interface RequiredFieldConfig<TPath extends Path> {
	readonly path: MaybeReadable<TPath>;
}

/* -------------------------------------------------------------------------- */
/*                                    input                                    */
/* -------------------------------------------------------------------------- */

export type GetInputConfig<TPath extends Path> = FieldConfig<TPath>;

/** Reads what a field holds right now, outside of any reactive binding. */
export function getInput<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
): PartialValues<InferInput<TSchema>>;
export function getInput<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: BaseFormStore<TSchema>,
	config: GetInputConfig<TPath>,
): PartialValues<PathValue<InferInput<TSchema>, TPath>>;
export function getInput(form: BaseFormStore, config?: GetInputConfig<Path>): unknown {
	const field = fieldAt(form[INTERNAL], config);
	return field ? getFieldInput(field) : undefined;
}

export interface SetInputConfig<TPath extends Path, TInput> {
	/** The field to write. Leave it out to replace the whole input. */
	readonly path?: MaybeReadable<TPath> | undefined;
	readonly input: TInput;
}

/**
 * Writes a field, or the whole form input. The field counts as touched and
 * edited afterwards, exactly as if it had been typed into, and the form
 * revalidates if its validation mode calls for it.
 */
export function setInput<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
	config: { readonly path?: undefined; readonly input: DeepPartial<InferInput<TSchema>> },
): void;
export function setInput<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: BaseFormStore<TSchema>,
	config: SetInputConfig<TPath, DeepPartial<PathValue<InferInput<TSchema>, TPath>>>,
): void;
export function setInput(form: BaseFormStore, config: SetInputConfig<Path, unknown>): void {
	const store = form[INTERNAL];
	const path = resolve(config.path);
	const field = getFieldStore(store, path);
	if (!field) return;
	setFieldInput(store, path, config.input);
	validateIfRequired(store, field, "input");
	bump(store);
}

/** The parts of a field that differ from what it started at. */
export type GetDirtyInputConfig<TPath extends Path> = FieldConfig<TPath>;

/**
 * Only the dirty parts of a field, or of the whole form. An array is atomic —
 * reported in full when any item is dirty — while an object key with nothing
 * dirty below it is left out. `undefined` when nothing is dirty at all.
 */
export function getDirtyInput<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
): DeepPartial<InferInput<TSchema>> | undefined;
export function getDirtyInput<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: BaseFormStore<TSchema>,
	config: GetDirtyInputConfig<TPath>,
): DeepPartial<PathValue<InferInput<TSchema>, TPath>> | undefined;
export function getDirtyInput(form: BaseFormStore, config?: GetDirtyInputConfig<Path>): unknown {
	const field = fieldAt(form[INTERNAL], config);
	return field ? getDirtyFieldInput(field) : undefined;
}

export type GetDirtyPathsConfig<TPath extends Path> = FieldConfig<TPath>;

/**
 * The paths of the fields that differ from what they started at. An object
 * contributes the paths of its children, an array its own — a dirty array is
 * reported whole, since its items have moved rather than only changed.
 */
export function getDirtyPaths<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
	config?: GetDirtyPathsConfig<FieldPath<InferInput<TSchema>>>,
): DirtyPath<InferInput<TSchema>>[] {
	const paths: RequiredPath[] = [];
	const field = fieldAt(form[INTERNAL], config);
	if (field) collectDirtyPaths(field, paths);
	return paths as DirtyPath<InferInput<TSchema>>[];
}

function collectDirtyPaths(field: InternalFieldStore, paths: RequiredPath[]): void {
	if (field.kind === "object" && field.input.get()) {
		// the recursion prunes clean subtrees on its own, so checking each child
		// up front would only walk every dirty one twice
		const before = paths.length;
		for (const key in field.children) {
			const child = field.children[key];
			if (child) collectDirtyPaths(child, paths);
		}
		// an object that turned dirty without any child doing so — one that went
		// from missing to present — still has a change worth reporting
		if (paths.length === before && field.isDirty.get() && field.path.length > 0) {
			paths.push(field.path as RequiredPath);
		}
		return;
	}

	if (field.kind === "value") {
		if (field.isDirty.get() && field.path.length > 0) paths.push(field.path as RequiredPath);
		return;
	}

	if (getFieldBool(field, "isDirty") && field.path.length > 0) {
		paths.push(field.path as RequiredPath);
	}
}

export interface PickDirtyConfig<TValue extends object> {
	/** The value to narrow down to its dirty parts. */
	readonly from: TValue;
}

/**
 * The parts of `from` the form reports as dirty — the form is the mask, the
 * value is what is read through it. Useful for sending a server only what
 * actually changed, from a value that is not the form input itself.
 */
export function pickDirty<TSchema extends FormSchema, TValue extends object>(
	form: BaseFormStore<TSchema>,
	config: PickDirtyConfig<TValue>,
): DeepPartial<TValue> | undefined {
	const store = form[INTERNAL];
	if (!getFieldBool(store, "isDirty")) return undefined;
	const result = pickFieldValue(store, config.from) as Record<string, unknown>;
	// every dirty key may be absent from the value, which leaves nothing to send
	return Object.keys(result).length ? (result as DeepPartial<TValue>) : undefined;
}

function pickFieldValue(field: InternalFieldStore, value: unknown): unknown {
	if (
		field.kind === "object" &&
		field.input.get() &&
		value &&
		typeof value === "object" &&
		!Array.isArray(value)
	) {
		const result: Record<string, unknown> = {};
		for (const key in field.children) {
			const child = field.children[key];
			if (child && getFieldBool(child, "isDirty") && key in value) {
				result[key] = pickFieldValue(child, (value as Record<string, unknown>)[key]);
			}
		}
		return result;
	}
	// the field is atomic, or the value's shape has diverged from the form's
	return value;
}

/* -------------------------------------------------------------------------- */
/*                                   errors                                    */
/* -------------------------------------------------------------------------- */

export type GetErrorsConfig<TPath extends Path> = FieldConfig<TPath>;

/**
 * The errors of a field, or the form's own when no path is given. Only the
 * field's own — for the errors of everything below it, use
 * {@link getDeepErrors}.
 */
export function getErrors<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config?: GetErrorsConfig<TPath>): FieldErrors | null {
	return fieldAt(form[INTERNAL], config)?.errors.get() ?? null;
}

/**
 * Every error message of a field and everything below it, the form's own
 * included. `null` when there are none.
 */
export function getDeepErrors<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config?: GetErrorsConfig<TPath>): FieldErrors | null {
	const field = fieldAt(form[INTERNAL], config);
	if (!field) return null;
	const messages: string[] = [];
	walkFieldStore(field, (current) => {
		const errors = current.errors.get();
		if (errors) messages.push(...errors);
	});
	return messages.length ? (messages as FieldErrors) : null;
}

/**
 * The first error message of a field or of everything below it, whichever
 * comes first — the field's own before its children's. Useful for a field
 * whose value is a shape of its own, such as a tags input.
 */
export function getDeepError<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config?: GetErrorsConfig<TPath>): string | null {
	return getDeepErrorEntry(form, config)?.errors[0] ?? null;
}

/** A field's errors, together with the path that reported them. */
export interface DeepErrorEntry<TValue = unknown> {
	/** The path of the field, or an empty path for the form's own errors. */
	readonly path: unknown extends TValue ? Path : readonly [] | FieldPath<TValue>;
	readonly errors: FieldErrors;
}

/**
 * The errors of the first field that has any, at or below the given one, with
 * the path they belong to.
 */
export function getDeepErrorEntry<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: BaseFormStore<TSchema>,
	config?: GetErrorsConfig<TPath>,
): DeepErrorEntry<InferInput<TSchema>> | null {
	const field = fieldAt(form[INTERNAL], config);
	if (!field) return null;
	let entry: DeepErrorEntry<InferInput<TSchema>> | null = null;
	walkFieldStore(field, (current) => {
		const errors = current.errors.get();
		if (!errors) return false;
		entry = { path: current.path, errors } as DeepErrorEntry<InferInput<TSchema>>;
		return true;
	});
	return entry;
}

/**
 * Every error of a field and everything below it, each paired with the path
 * that reported it — which is what an error summary that links back to its
 * fields is built from.
 */
export function getDeepErrorEntries<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: BaseFormStore<TSchema>,
	config?: GetErrorsConfig<TPath>,
): DeepErrorEntry<InferInput<TSchema>>[] {
	const field = fieldAt(form[INTERNAL], config);
	if (!field) return [];
	const entries: DeepErrorEntry<InferInput<TSchema>>[] = [];
	walkFieldStore(field, (current) => {
		const errors = current.errors.get();
		if (errors) {
			entries.push({ path: current.path, errors } as DeepErrorEntry<InferInput<TSchema>>);
		}
	});
	return entries;
}

export interface SetErrorsConfig<TPath extends Path> {
	/** The field to report on. Leave it out for an error about the form. */
	readonly path?: MaybeReadable<TPath> | undefined;
	/** The messages, or `null` to clear the ones the field has. */
	readonly errors: FieldErrors | null;
}

/**
 * Reports errors a schema cannot know about — a server rejecting an email as
 * taken, say — or clears a field's with `null`. The next validation replaces
 * whatever is set here.
 */
export function setErrors<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: SetErrorsConfig<TPath>): void {
	const store = form[INTERNAL];
	const field = fieldAt(store, config);
	if (!field) return;
	field.errors.set(config.errors);
	bump(store);
}

/* -------------------------------------------------------------------------- */
/*                                    state                                    */
/* -------------------------------------------------------------------------- */

export type StateConfig<TPath extends Path> = FieldConfig<TPath>;

/** Whether a field, or anything below it, has been focused or written to. */
export function isTouched<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config?: StateConfig<TPath>): boolean {
	const field = fieldAt(form[INTERNAL], config);
	return field ? getFieldBool(field, "isTouched") : false;
}

/** Whether a field, or anything below it, has had its value changed. */
export function isEdited<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config?: StateConfig<TPath>): boolean {
	const field = fieldAt(form[INTERNAL], config);
	return field ? getFieldBool(field, "isEdited") : false;
}

/** Whether a field, or anything below it, differs from what it started at. */
export function isDirty<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config?: StateConfig<TPath>): boolean {
	const field = fieldAt(form[INTERNAL], config);
	return field ? getFieldBool(field, "isDirty") : false;
}

/** Whether the last validation left a field, and everything below it, clean. */
export function isValid<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config?: StateConfig<TPath>): boolean {
	const field = fieldAt(form[INTERNAL], config);
	return !field || !getFieldBool(field, "errors");
}

/* -------------------------------------------------------------------------- */
/*                            validation & submission                          */
/* -------------------------------------------------------------------------- */

/** Validates the form now, whatever its validation mode is. */
export function validate<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
	config?: ValidateConfig,
): Promise<v.SafeParseResult<TSchema>> {
	return validateFormInput(form[INTERNAL], config);
}

export type FocusConfig<TPath extends Path> = RequiredFieldConfig<TPath>;

/** Focuses the first element of a field that can take the focus. */
export function focus<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: FocusConfig<TPath>): void {
	const field = getFieldStore(form[INTERNAL], resolve(config.path));
	if (field) focusFieldElement(field);
}

/**
 * Wraps a submit handler so it only runs on valid input. The `Form` component
 * does this for you; reach for it directly when you render the `<form>`
 * element yourself.
 */
export function handleSubmit<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
	handler: SubmitHandler<TSchema>,
): () => Promise<void>;
export function handleSubmit<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
	handler: SubmitEventHandler<TSchema>,
): (event: SubmitLikeEvent) => Promise<void>;
export function handleSubmit(
	form: BaseFormStore,
	handler: SubmitHandler<FormSchema> | SubmitEventHandler<FormSchema>,
): (event?: SubmitLikeEvent) => Promise<void> {
	return async (event?: SubmitLikeEvent) => {
		event?.preventDefault();
		const store = form[INTERNAL];
		store.isSubmitted.set(true);
		store.isSubmitting.set(true);
		bump(store);

		try {
			const result = await validateFormInput(store, { shouldFocus: true });
			if (result.success) {
				await (handler as SubmitEventHandler<FormSchema>)(result.output, event as SubmitLikeEvent);
			}
		} catch (error) {
			store.errors.set([
				error &&
				typeof error === "object" &&
				"message" in error &&
				typeof error.message === "string"
					? error.message
					: "An unknown error has occurred.",
			]);
		} finally {
			store.isSubmitting.set(false);
			bump(store);
		}
	};
}

/**
 * Submits the form as if its submit button had been pressed, so the `Form`
 * component's own handler runs. Does nothing without a mounted form element.
 */
export function submit<TSchema extends FormSchema>(form: BaseFormStore<TSchema>): void {
	form[INTERNAL].element.get()?.requestSubmit();
}

/* -------------------------------------------------------------------------- */
/*                                    reset                                    */
/* -------------------------------------------------------------------------- */

interface ResetBaseConfig {
	/** Keep the values the fields hold. Off by default. */
	readonly keepInput?: boolean | undefined;
	/** Keep the touched state. Off by default. */
	readonly keepTouched?: boolean | undefined;
	/** Keep the edited state. Off by default. */
	readonly keepEdited?: boolean | undefined;
	/** Keep the errors. Off by default. */
	readonly keepErrors?: boolean | undefined;
}

export interface ResetFormConfig<TSchema extends FormSchema> extends ResetBaseConfig {
	readonly path?: undefined;
	/** A new starting point, which later resets go back to as well. */
	readonly initialInput?: DeepPartial<InferInput<TSchema>> | undefined;
	/** Keep the submitted state. Off by default. */
	readonly keepSubmitted?: boolean | undefined;
}

export interface ResetFieldConfig<
	TSchema extends FormSchema,
	TPath extends Path,
> extends ResetBaseConfig {
	readonly path: MaybeReadable<TPath>;
	/** A new starting point for the field, which later resets go back to as well. */
	readonly initialInput?: DeepPartial<PathValue<InferInput<TSchema>, TPath>> | undefined;
}

/**
 * Puts a field — or the whole form — back to what it started at, dropping its
 * errors, its touched and edited state, and the ids of its array items. Each
 * of those can be kept with the matching `keep` option.
 */
export function reset<TSchema extends FormSchema>(
	form: BaseFormStore<TSchema>,
	config?: ResetFormConfig<TSchema>,
): void;
export function reset<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: ResetFieldConfig<TSchema, TPath>): void;
export function reset(
	form: BaseFormStore,
	config?: ResetFormConfig<FormSchema> | ResetFieldConfig<FormSchema, Path>,
): void {
	const store = form[INTERNAL];
	const field = fieldAt(store, config);
	if (!field) return;

	if (config && "initialInput" in config) {
		setInitialFieldInput(store, field, config.initialInput);
	}

	walkFieldStore(field, (current) => {
		// array methods move elements between field stores, so this is what puts
		// each field back on its own — without it, focusing and clearing a file
		// input would reach the wrong element after a reorder and then a reset
		current.elements = current.initialElements;

		if (!config?.keepErrors) current.errors.set(null);
		if (!config?.keepTouched) current.isTouched.set(false);
		if (!config?.keepEdited) current.isEdited.set(false);

		current.startInput.set(current.initialInput.get() as never);
		if (!config?.keepInput) current.input.set(current.initialInput.get() as never);

		if (current.kind === "array") {
			current.startItems.set(current.initialItems.get());
			// the ids are formish's own bookkeeping: they are reset alongside an
			// equal-length list too, or a field would report itself dirty with
			// nothing on screen having changed
			if (!config?.keepInput || current.startItems.get().length === current.items.get().length) {
				current.items.set(current.initialItems.get());
			}
			// by content, not by identity: a signal only takes a value that differs
			// from the one it holds, so two lists of the same ids stay two arrays
			current.isDirty.set(
				current.startInput.get() !== current.input.get() ||
					current.startItems.get().join() !== current.items.get().join(),
			);
			return;
		}

		if (current.kind === "object") {
			current.isDirty.set(current.startInput.get() !== current.input.get());
			return;
		}

		const startInput = current.startInput.get();
		const input = current.input.get();
		current.isDirty.set(
			startInput !== input &&
				// an empty string or `NaN` is not a change from a field that started
				// at nothing
				(startInput != null || (input !== "" && !Number.isNaN(input))),
		);

		// a file input holds its selection outside the store, so it has to be
		// cleared on the element itself
		for (const element of current.elements) {
			if (element.type === "file") element.value = "";
		}
	});

	if (!config?.path) {
		if (!config?.keepSubmitted) {
			store.isSubmitted.set(false);
		}
		if (store.validate === "initial") void validateFormInput(store);
	}

	bump(store);
}

/* -------------------------------------------------------------------------- */
/*                                array methods                                */
/* -------------------------------------------------------------------------- */

type ArrayItem<TSchema extends FormSchema, TPath extends Path> = DeepPartial<
	PathValue<InferInput<TSchema>, [...TPath, number]>
>;

export interface InsertConfig<TSchema extends FormSchema, TPath extends Path> {
	readonly path: MaybeReadable<TPath>;
	/** Where to insert. Defaults to the end of the list. */
	readonly at?: number | undefined;
	readonly initialInput?: ArrayItem<TSchema, TPath> | undefined;
}

/** Inserts an item into an array field. */
export function insert<
	TSchema extends FormSchema,
	const TPath extends ArrayPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: InsertConfig<TSchema, TPath>): void {
	const store = form[INTERNAL];
	const path = resolve(config.path);
	const array = arrayAt(store, path);
	if (!array) return;

	// a container that was missing is present once it has an item in it
	let field: InternalFieldStore = store;
	for (let index = 0; index < path.length - 1; index++) {
		const child = childOf(field, path[index]);
		if (!child) return;
		field = child;
		field.input.set(true);
	}

	const items = array.items.get();
	const at = config.at ?? items.length;
	if (at < 0 || at > items.length) return;

	const nextItems = [...items];
	nextItems.splice(at, 0, createId());
	array.items.set(nextItems);

	// every item after the insertion point moves one index up, state and all
	for (let index = items.length; index > at; index--) {
		const target = array.children[index] ?? createItemStore(store, array, index, undefined);
		array.children[index] = target;
		const source = array.children[index - 1];
		if (source) copyItemState(store, source, target);
	}

	const existing = array.children[at];
	if (existing) {
		resetItemState(store, existing, config.initialInput);
	} else {
		array.children[at] = createItemStore(store, array, at, config.initialInput);
	}

	array.input.set(true);
	array.isTouched.set(true);
	array.isEdited.set(true);
	array.isDirty.set(true);
	validateIfRequired(store, array, "input");
	bump(store);
}

export interface RemoveConfig<TPath extends Path> {
	readonly path: MaybeReadable<TPath>;
	/** The index to remove. */
	readonly at: number;
}

/** Removes an item from an array field. */
export function remove<
	TSchema extends FormSchema,
	const TPath extends ArrayPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: RemoveConfig<TPath>): void {
	const store = form[INTERNAL];
	const array = arrayAt(store, config.path);
	if (!array) return;

	const items = array.items.get();
	if (config.at < 0 || config.at > items.length - 1) return;

	const nextItems = [...items];
	nextItems.splice(config.at, 1);
	array.items.set(nextItems);

	for (let index = config.at; index < items.length - 1; index++) {
		const source = array.children[index + 1];
		const target = array.children[index];
		if (source && target) copyItemState(store, source, target);
	}

	array.isTouched.set(true);
	array.isEdited.set(true);
	array.isDirty.set(array.startItems.get().join() !== nextItems.join());
	validateIfRequired(store, array, "input");
	bump(store);
}

export interface MoveConfig<TPath extends Path> {
	readonly path: MaybeReadable<TPath>;
	readonly from: number;
	readonly to: number;
}

/** Moves an item of an array field to another position. */
export function move<
	TSchema extends FormSchema,
	const TPath extends ArrayPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: MoveConfig<TPath>): void {
	const store = form[INTERNAL];
	const array = arrayAt(store, config.path);
	if (!array) return;

	const items = array.items.get();
	const { from, to } = config;
	if (from < 0 || from > items.length - 1 || to < 0 || to > items.length - 1 || from === to) {
		return;
	}

	const nextItems = [...items];
	nextItems.splice(to, 0, ...nextItems.splice(from, 1));
	array.items.set(nextItems);

	// the item being moved is parked while the ones it passes shift over it
	const parked = createItemStore(store, array, from, undefined);
	const source = array.children[from];
	if (source) copyItemState(store, source, parked);

	if (from < to) {
		for (let index = from; index < to; index++) {
			const next = array.children[index + 1];
			const target = array.children[index];
			if (next && target) copyItemState(store, next, target);
		}
	} else {
		for (let index = from; index > to; index--) {
			const previous = array.children[index - 1];
			const target = array.children[index];
			if (previous && target) copyItemState(store, previous, target);
		}
	}

	const destination = array.children[to];
	if (destination) copyItemState(store, parked, destination);

	array.isTouched.set(true);
	array.isEdited.set(true);
	array.isDirty.set(array.startItems.get().join() !== nextItems.join());
	validateIfRequired(store, array, "input");
	bump(store);
}

export interface SwapConfig<TPath extends Path> {
	readonly path: MaybeReadable<TPath>;
	readonly at: number;
	readonly and: number;
}

/** Swaps two items of an array field. */
export function swap<
	TSchema extends FormSchema,
	const TPath extends ArrayPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: SwapConfig<TPath>): void {
	const store = form[INTERNAL];
	const array = arrayAt(store, config.path);
	if (!array) return;

	const items = array.items.get();
	const { at, and } = config;
	if (at < 0 || at > items.length - 1 || and < 0 || and > items.length - 1 || at === and) {
		return;
	}

	const nextItems = [...items];
	nextItems[at] = items[and] as string;
	nextItems[and] = items[at] as string;
	array.items.set(nextItems);

	const first = array.children[at];
	const second = array.children[and];
	if (first && second) swapItemState(store, first, second);

	array.isTouched.set(true);
	array.isEdited.set(true);
	array.isDirty.set(array.startItems.get().join() !== nextItems.join());
	validateIfRequired(store, array, "input");
	bump(store);
}

export interface ReplaceConfig<TSchema extends FormSchema, TPath extends Path> {
	readonly path: MaybeReadable<TPath>;
	readonly at: number;
	readonly initialInput?: ArrayItem<TSchema, TPath> | undefined;
}

/** Replaces an item of an array field, dropping the state of the old one. */
export function replace<
	TSchema extends FormSchema,
	const TPath extends ArrayPath<InferInput<TSchema>>,
>(form: BaseFormStore<TSchema>, config: ReplaceConfig<TSchema, TPath>): void {
	const store = form[INTERNAL];
	const array = arrayAt(store, config.path);
	if (!array) return;

	const items = array.items.get();
	if (config.at < 0 || config.at > items.length - 1) return;

	// a fresh id, so the row is rebuilt rather than reused for another value
	const nextItems = [...items];
	nextItems[config.at] = createId();
	array.items.set(nextItems);

	const child = array.children[config.at];
	if (child) resetItemState(store, child, config.initialInput);

	array.isTouched.set(true);
	array.isEdited.set(true);
	array.isDirty.set(true);
	validateIfRequired(store, array, "input");
	bump(store);
}
