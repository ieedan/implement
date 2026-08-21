import { isReadable, type Readable } from "@implementjs/core";
import { INTERNAL, type FormStore } from "./form";
import { getAtPath, pathName, ROOT_NAME, setAtPath, type Path } from "./path";
import {
	clearStateUnder,
	createId,
	focusField,
	formElements,
	itemsSignal,
	markEdited,
	markTouched,
	namePath,
	readInput,
	remapItemState,
	writeInput,
	type InternalFormStore,
} from "./store";
import type { InferInput, InferOutput, StandardResult } from "./standard-schema";
import { validateIfRequired, validateInput, type ValidateConfig } from "./validate";
import type {
	ArrayPath,
	DeepPartial,
	FieldErrors,
	FieldPath,
	FormSchema,
	ItemValue,
	PartialInput,
	PathValue,
} from "./types";

/** A path given to a method, static or readable. */
type MaybeReadable<TPath extends Path> = TPath | Readable<TPath>;

function resolve(path: MaybeReadable<Path>): Path {
	return isReadable<Path>(path) ? path.get() : path;
}

function internal(form: FormStore): InternalFormStore {
	return form[INTERNAL];
}

/* -------------------------------------------------------------------------- */
/*                                    input                                    */
/* -------------------------------------------------------------------------- */

export interface GetInputConfig<TPath extends Path> {
	/** The field to read. Leave it out for the whole form. */
	readonly path?: MaybeReadable<TPath> | undefined;
}

/** Reads what a field holds right now, outside of any reactive binding. */
export function getInput<TSchema extends FormSchema>(
	form: FormStore<TSchema>,
): PartialInput<InferInput<TSchema>>;
export function getInput<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: FormStore<TSchema>,
	config: GetInputConfig<TPath>,
): PartialInput<PathValue<InferInput<TSchema>, TPath>>;
export function getInput(form: FormStore, config?: GetInputConfig<Path>): unknown {
	return readInput(internal(form), config?.path ? resolve(config.path) : []);
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
	form: FormStore<TSchema>,
	config: { readonly path?: undefined; readonly input: DeepPartial<InferInput<TSchema>> },
): void;
export function setInput<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: FormStore<TSchema>,
	config: SetInputConfig<TPath, PartialInput<PathValue<InferInput<TSchema>, TPath>>>,
): void;
export function setInput(form: FormStore, config: SetInputConfig<Path, unknown>): void {
	const store = internal(form);
	const path = config.path ? resolve(config.path) : [];
	writeInput(store, path, config.input);
	markTouched(store, path);
	markEdited(store, path);
	validateIfRequired(store, path, "input");
}

/* -------------------------------------------------------------------------- */
/*                                   errors                                    */
/* -------------------------------------------------------------------------- */

export interface ErrorsConfig<TPath extends Path> {
	readonly path?: MaybeReadable<TPath> | undefined;
}

/** The errors of a field, or the form's own errors when no path is given. */
export function getErrors<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: FormStore<TSchema>, config?: ErrorsConfig<TPath>): FieldErrors | null {
	const path = config?.path ? resolve(config.path) : [];
	return internal(form).errors.get().get(pathName(path)) ?? null;
}

/** Every error in the form, keyed by the path that reported it. */
export function getAllErrors<TSchema extends FormSchema>(
	form: FormStore<TSchema>,
): { path: Path; errors: FieldErrors }[] {
	return [...internal(form).errors.get()].map(([name, errors]) => ({
		path: namePath(name),
		errors,
	}));
}

export interface SetErrorsConfig<TPath extends Path> {
	/** The field to report on. Leave it out for an error about the form. */
	readonly path?: MaybeReadable<TPath> | undefined;
	readonly errors: string | FieldErrors;
}

/**
 * Reports errors a schema cannot know about — a server rejecting an email as
 * taken, say. The next validation replaces them.
 */
export function setErrors<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: FormStore<TSchema>, config: SetErrorsConfig<TPath>): void {
	const store = internal(form);
	const path = config.path ? resolve(config.path) : [];
	const errors = typeof config.errors === "string" ? [config.errors] : [...config.errors];
	const next = new Map(store.errors.get());
	next.set(pathName(path), errors as FieldErrors);
	store.errors.set(next);
}

/** Clears the errors of a field and everything inside it, or of the whole form. */
export function clearErrors<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: FormStore<TSchema>, config?: ErrorsConfig<TPath>): void {
	const store = internal(form);
	if (!config?.path) {
		store.errors.set(new Map());
		return;
	}
	const path = resolve(config.path);
	const next = new Map(store.errors.get());
	for (const name of next.keys()) {
		const fieldPath = namePath(name);
		if (fieldPath.length >= path.length && path.every((key, index) => key === fieldPath[index])) {
			next.delete(name);
		}
	}
	store.errors.set(next);
}

/* -------------------------------------------------------------------------- */
/*                            validation & submission                          */
/* -------------------------------------------------------------------------- */

/** Validates the form now, whatever its validation mode is. */
export function validate<TSchema extends FormSchema>(
	form: FormStore<TSchema>,
	config?: ValidateConfig,
): Promise<StandardResult<InferOutput<TSchema>>> {
	return validateInput(internal(form), config);
}

export interface FocusConfig<TPath extends Path> {
	readonly path: MaybeReadable<TPath>;
}

/** Focuses a field's element. Returns whether one took the focus. */
export function focus<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(form: FormStore<TSchema>, config: FocusConfig<TPath>): boolean {
	return focusField(internal(form), pathName(resolve(config.path)));
}

/** What a submit handler receives once the input has passed the schema. */
export type SubmitHandler<TSchema extends FormSchema> = (
	output: InferOutput<TSchema>,
	event?: SubmitLikeEvent,
) => unknown;

export interface SubmitLikeEvent {
	preventDefault: () => void;
}

/**
 * Wraps a submit handler so it only runs on valid input. The `Form` component
 * does this for you; reach for it directly when you render the `<form>`
 * element yourself.
 */
export function handleSubmit<TSchema extends FormSchema>(
	form: FormStore<TSchema>,
	handler: SubmitHandler<TSchema>,
): (event?: SubmitLikeEvent) => Promise<void> {
	return async (event?: SubmitLikeEvent) => {
		event?.preventDefault();
		const store = internal(form);
		store.isSubmitted.set(true);
		store.isSubmitting.set(true);

		try {
			const result = await validateInput(store, { shouldFocus: true });
			if (!result.issues) {
				await handler(result.value, event);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "An unknown error has occurred.";
			const errors = new Map(store.errors.get());
			errors.set(ROOT_NAME, [message]);
			store.errors.set(errors);
		} finally {
			store.isSubmitting.set(false);
		}
	};
}

/**
 * Submits the form as if its submit button had been pressed, so the `Form`
 * component's own handler runs. Without a mounted form element it validates
 * instead.
 */
export function submit<TSchema extends FormSchema>(form: FormStore<TSchema>): void {
	const store = internal(form);
	const element = store.element.get();
	if (element) {
		element.requestSubmit();
		return;
	}
	void validateInput(store, { shouldFocus: true });
}

/* -------------------------------------------------------------------------- */
/*                                    reset                                    */
/* -------------------------------------------------------------------------- */

export interface ResetConfig<TPath extends Path, TInput> {
	/** The field to reset. Leave it out for the whole form. */
	readonly path?: MaybeReadable<TPath> | undefined;
	/** A new starting value, which later resets go back to as well. */
	readonly initialInput?: TInput | undefined;
}

/**
 * Puts a field — or the whole form — back to what it started at, dropping its
 * errors, its touched and edited state, and the ids of its array items.
 */
export function reset<TSchema extends FormSchema>(
	form: FormStore<TSchema>,
	config?: { readonly path?: undefined; readonly initialInput?: DeepPartial<InferInput<TSchema>> },
): void;
export function reset<
	TSchema extends FormSchema,
	const TPath extends FieldPath<InferInput<TSchema>>,
>(
	form: FormStore<TSchema>,
	config: ResetConfig<TPath, PartialInput<PathValue<InferInput<TSchema>, TPath>>>,
): void;
export function reset(form: FormStore, config?: ResetConfig<Path, unknown>): void {
	const store = internal(form);
	const path = config?.path ? resolve(config.path) : [];

	if (config?.initialInput !== undefined) {
		store.initialInput.set(
			setAtPath(store.initialInput.get(), path, config.initialInput) as Record<string, unknown>,
		);
	}

	const next = getAtPath(store.initialInput.get(), path);
	store.startInput.set(setAtPath(store.startInput.get(), path, next) as Record<string, unknown>);
	clearStateUnder(store, path);

	// a fresh id per item so rows are rebuilt rather than reused for a
	// different item's value
	for (const [name, items] of store.items) {
		const itemsPath = namePath(name);
		if (itemsPath.length < path.length || !path.every((key, i) => key === itemsPath[i])) continue;
		const value = getAtPath(next, itemsPath.slice(path.length));
		items.set(Array.from({ length: Array.isArray(value) ? value.length : 0 }, createId));
	}

	writeInput(store, path, next);

	// a file input holds its selection outside the store, so it has to be
	// cleared on the element itself
	for (const element of formElements(store)) {
		if (!(element instanceof HTMLInputElement) || element.type !== "file") continue;
		const filePath = namePath(element.name);
		if (filePath.length >= path.length && path.every((key, i) => key === filePath[i])) {
			element.value = "";
		}
	}

	if (path.length === 0) {
		store.isSubmitted.set(false);
		store.isSubmitting.set(false);
	}
}

/* -------------------------------------------------------------------------- */
/*                                array methods                                */
/* -------------------------------------------------------------------------- */

type ArrayItem<TSchema extends FormSchema, TPath extends Path> = PartialInput<
	ItemValue<PathValue<InferInput<TSchema>, TPath>>
>;

/**
 * The number of items an array field currently has. Array methods are bounded
 * by it, so an index that is not there leaves the list alone instead of
 * writing a hole into it.
 */
function itemCount(store: InternalFormStore, path: Path): number {
	return itemsSignal(store, path).get().length;
}

function isItemIndex(index: number, length: number): boolean {
	return Number.isInteger(index) && index >= 0 && index < length;
}

/** Applies an array change: the input, the item ids and the field state all move together. */
function mutateArray(
	store: InternalFormStore,
	path: Path,
	change: {
		input: (array: unknown[]) => unknown[];
		items: (ids: string[]) => string[];
		mapIndex: (index: number) => number | null;
	},
): void {
	const current = readInput(store, path);
	const array = Array.isArray(current) ? [...current] : [];
	const items = itemsSignal(store, path);

	remapItemState(store, path, change.mapIndex);
	items.set(change.items([...items.get()]));
	writeInput(store, path, change.input(array));

	markTouched(store, path);
	markEdited(store, path);
	validateIfRequired(store, path, "input");
}

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
>(form: FormStore<TSchema>, config: InsertConfig<TSchema, TPath>): void {
	const store = internal(form);
	const path = resolve(config.path);
	const length = itemCount(store, path);
	const at = clamp(config.at ?? length, 0, length);

	mutateArray(store, path, {
		input: (array) => [...array.slice(0, at), config.initialInput, ...array.slice(at)],
		items: (ids) => [...ids.slice(0, at), createId(), ...ids.slice(at)],
		mapIndex: (index) => (index >= at ? index + 1 : index),
	});
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
>(form: FormStore<TSchema>, config: RemoveConfig<TPath>): void {
	const store = internal(form);
	const path = resolve(config.path);
	const { at } = config;
	if (!isItemIndex(at, itemCount(store, path))) return;

	mutateArray(store, path, {
		input: (array) => array.filter((_, index) => index !== at),
		items: (ids) => ids.filter((_, index) => index !== at),
		mapIndex: (index) => (index === at ? null : index > at ? index - 1 : index),
	});
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
>(form: FormStore<TSchema>, config: MoveConfig<TPath>): void {
	const store = internal(form);
	const path = resolve(config.path);
	const { from, to } = config;
	const length = itemCount(store, path);
	if (from === to || !isItemIndex(from, length) || !isItemIndex(to, length)) return;

	const moveItems = <T>(list: T[]): T[] => {
		const next = [...list];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item as T);
		return next;
	};

	mutateArray(store, path, {
		input: moveItems,
		items: moveItems,
		mapIndex: (index) => {
			if (index === from) return to;
			if (from < to && index > from && index <= to) return index - 1;
			if (from > to && index >= to && index < from) return index + 1;
			return index;
		},
	});
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
>(form: FormStore<TSchema>, config: SwapConfig<TPath>): void {
	const store = internal(form);
	const path = resolve(config.path);
	const { at, and } = config;
	const length = itemCount(store, path);
	if (at === and || !isItemIndex(at, length) || !isItemIndex(and, length)) return;

	const swapItems = <T>(list: T[]): T[] => {
		const next = [...list];
		const first = next[at] as T;
		next[at] = next[and] as T;
		next[and] = first;
		return next;
	};

	mutateArray(store, path, {
		input: swapItems,
		items: swapItems,
		mapIndex: (index) => (index === at ? and : index === and ? at : index),
	});
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
>(form: FormStore<TSchema>, config: ReplaceConfig<TSchema, TPath>): void {
	const store = internal(form);
	const path = resolve(config.path);
	const { at } = config;
	if (!isItemIndex(at, itemCount(store, path))) return;
	clearStateUnder(store, [...path, at]);

	mutateArray(store, path, {
		input: (array) => array.map((item, index) => (index === at ? config.initialInput : item)),
		items: (ids) => ids.map((id, index) => (index === at ? createId() : id)),
		mapIndex: (index) => index,
	});
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
