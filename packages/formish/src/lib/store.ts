import { ref, signal, type Ref, type Signal } from "@implementjs/core";
import {
	getAtPath,
	isPrefix,
	isRelated,
	namePath,
	pathName,
	ROOT_NAME,
	setAtPath,
	type Path,
	type PathKey,
} from "./path";
import { DEFAULT_EMPTY_INPUT, seedField, seedInput, type EmptyInput } from "./schema";
import type {
	FieldElement,
	FieldErrors,
	FormConfig,
	FormSchema,
	RevalidationMode,
	ValidationMode,
} from "./types";

/**
 * The state behind a form. Field state is keyed by path name rather than held
 * in a tree of field objects, so a field that is not rendered (or not rendered
 * yet) still has errors, and `useField` is free to look one up at any time.
 */
export interface InternalFormStore {
	readonly schema: FormSchema;
	/** The `<form>` element, once a `Form` component has mounted one. */
	readonly element: Ref<HTMLFormElement>;

	/** The single source of truth for what the fields hold. */
	readonly input: Signal<Record<string, unknown>>;
	/** What `reset` goes back to. */
	readonly initialInput: Signal<Record<string, unknown>>;
	/** The baseline the dirty state is measured against. */
	readonly startInput: Signal<Record<string, unknown>>;

	/** Errors by field name. The root's own errors are under {@link ROOT_NAME}. */
	readonly errors: Signal<ReadonlyMap<string, FieldErrors>>;
	readonly touched: Signal<ReadonlySet<string>>;
	readonly edited: Signal<ReadonlySet<string>>;

	/** Item ids of array fields, by field name. Created when first observed. */
	readonly items: Map<string, Signal<string[]>>;
	/**
	 * Fields known to hold a list, by name. A checkbox group or an empty array
	 * field looks like nothing at all until something says otherwise, and this
	 * is what says so.
	 */
	readonly arrayFields: Set<string>;

	readonly isSubmitting: Signal<boolean>;
	readonly isSubmitted: Signal<boolean>;
	readonly isValidating: Signal<boolean>;

	/** Where a required field of a given type starts, defaults already merged in. */
	readonly emptyInput: EmptyInput;

	/** Orders validations so a slow one cannot overwrite a newer one's result. */
	validationId: number;
	readonly validate: ValidationMode;
	readonly revalidate: RevalidationMode;
}

let idCount = 0;

/** An id for an array item — stable across reorders, unlike its index. */
export function createId(): string {
	idCount += 1;
	return `${idCount}`;
}

export function createFormStore(config: FormConfig<FormSchema>): InternalFormStore {
	const emptyInput = { ...DEFAULT_EMPTY_INPUT, ...config.emptyInput };
	const arrayFields = new Set<string>();

	// the schema is what says which fields exist — not what happens to be
	// rendered — so every one of them starts at a value, whether or not
	// anything ever mounts an element for it
	const initialInput = seedInput(config.schema, config.initialInput, {
		emptyInput,
		onArrayField: (path) => arrayFields.add(pathName(path)),
	});

	return {
		schema: config.schema,
		element: ref<HTMLFormElement>(),
		input: signal(initialInput),
		initialInput: signal(initialInput),
		startInput: signal(initialInput),
		errors: signal<ReadonlyMap<string, FieldErrors>>(new Map()),
		touched: signal<ReadonlySet<string>>(new Set()),
		edited: signal<ReadonlySet<string>>(new Set()),
		items: new Map(),
		arrayFields,
		isSubmitting: signal(false),
		isSubmitted: signal(false),
		isValidating: signal(false),
		emptyInput,
		validationId: 0,
		validate: config.validate ?? "submit",
		revalidate: config.revalidate ?? "input",
	};
}

/**
 * Fills in the fields the schema names below `path` on a value headed there —
 * a new array item, or a new starting point for `reset`. What the caller gave
 * always wins; this only reaches the fields it left out.
 */
export function seedValue(store: InternalFormStore, path: Path, input: unknown): unknown {
	return seedField(store.schema, path, input, {
		emptyInput: store.emptyInput,
		onArrayField: (target) => store.arrayFields.add(pathName(target)),
	});
}

export function readInput(store: InternalFormStore, path: Path): unknown {
	return getAtPath(store.input.get(), path);
}

/**
 * Writes `input` at `path` and brings the item ids of any array below it back
 * in step with the new value. Does not touch the touched or edited state —
 * that is the caller's call, since a programmatic write and a keystroke mean
 * different things.
 */
export function writeInput(store: InternalFormStore, path: Path, input: unknown): void {
	store.input.set(setAtPath(store.input.get(), path, input) as Record<string, unknown>);
	syncItems(store, path);
}

/** Remembers that a field holds a list, so an empty one still validates as one. */
export function markArrayField(store: InternalFormStore, path: Path): void {
	store.arrayFields.add(pathName(path));
}

export function markTouched(store: InternalFormStore, path: Path): void {
	const name = pathName(path);
	if (store.touched.get().has(name)) return;
	store.touched.set(new Set(store.touched.get()).add(name));
}

export function markEdited(store: InternalFormStore, path: Path): void {
	const name = pathName(path);
	if (store.edited.get().has(name)) return;
	store.edited.set(new Set(store.edited.get()).add(name));
}

/**
 * Whether a flag applies to `path`: set on the field itself, on one of its
 * children, or on an ancestor — marking a field marks everything it contains.
 */
export function hasFlag(names: ReadonlySet<string>, path: Path): boolean {
	for (const name of names) {
		if (isRelated(namePath(name), path)) return true;
	}
	return false;
}

export function errorsAt(errors: ReadonlyMap<string, FieldErrors>, path: Path): FieldErrors | null {
	return errors.get(pathName(path)) ?? null;
}

/** Whether the field at `path`, or anything inside it, has errors. */
export function hasErrorsUnder(errors: ReadonlyMap<string, FieldErrors>, path: Path): boolean {
	for (const name of errors.keys()) {
		if (isPrefix(path, namePath(name))) return true;
	}
	return false;
}

/**
 * The item ids of the array at `path`, created from the current input the
 * first time the array is observed.
 */
export function itemsSignal(store: InternalFormStore, path: Path): Signal<string[]> {
	const name = pathName(path);
	const existing = store.items.get(name);
	if (existing) return existing;
	const value = readInput(store, path);
	const created = signal(Array.from({ length: Array.isArray(value) ? value.length : 0 }, createId));
	store.items.set(name, created);
	return created;
}

/**
 * Brings item ids back in step with the input after a write that was not an
 * array method — a `setInput` with a longer list, a `reset`, a load. Ids of
 * items that stayed are kept, so their rows are not remounted.
 */
export function syncItems(store: InternalFormStore, path: Path): void {
	for (const [name, items] of store.items) {
		const itemsPath = namePath(name);
		if (!isRelated(path, itemsPath)) continue;
		const value = readInput(store, itemsPath);
		const length = Array.isArray(value) ? value.length : 0;
		const current = items.get();
		if (current.length === length) continue;
		items.set(
			length < current.length
				? current.slice(0, length)
				: [...current, ...Array.from({ length: length - current.length }, createId)],
		);
	}
}

/** Drops the state of every field below `path`, the field itself included. */
export function clearStateUnder(store: InternalFormStore, path: Path): void {
	const errors = new Map(store.errors.get());
	// deleting while iterating a Map is safe: the iterator skips removed entries
	for (const name of errors.keys()) {
		if (isPrefix(path, namePath(name))) errors.delete(name);
	}
	store.errors.set(errors);

	for (const flags of [store.touched, store.edited]) {
		const next = new Set(flags.get());
		for (const name of next) {
			if (isPrefix(path, namePath(name))) next.delete(name);
		}
		flags.set(next);
	}
}

/**
 * Moves field state between array indices after an array method. `mapIndex`
 * answers where the item at an index ended up, or `null` when it is gone.
 * Errors, flags and the item ids of nested arrays all travel with the item, so
 * a row keeps its own state when its neighbours move.
 */
export function remapItemState(
	store: InternalFormStore,
	path: Path,
	mapIndex: (index: number) => number | null,
): void {
	const remap = (name: string): string | null => {
		const fieldPath = namePath(name);
		if (!isPrefix(path, fieldPath) || fieldPath.length <= path.length) return name;
		const index = fieldPath[path.length];
		if (typeof index !== "number") return name;
		const next = mapIndex(index);
		if (next === null) return null;
		if (next === index) return name;
		const rest = fieldPath.slice(path.length + 1) as readonly PathKey[];
		return pathName([...path, next, ...rest]);
	};

	const errors = new Map<string, FieldErrors>();
	for (const [name, value] of store.errors.get()) {
		const next = remap(name);
		if (next !== null) errors.set(next, value);
	}
	store.errors.set(errors);

	for (const flags of [store.touched, store.edited]) {
		const next = new Set<string>();
		for (const name of flags.get()) {
			const mapped = remap(name);
			if (mapped !== null) next.add(mapped);
		}
		flags.set(next);
	}

	const items = new Map<string, Signal<string[]>>();
	for (const [name, value] of store.items) {
		const next = remap(name);
		if (next !== null) items.set(next, value);
	}
	store.items.clear();
	for (const [name, value] of items) store.items.set(name, value);
}

/**
 * The elements bound to a field. They are found by name rather than tracked on
 * mount, which is what lets a radio group or a checkbox group — many elements,
 * one field — work without registering anything.
 */
export function fieldElements(store: InternalFormStore, name: string): FieldElement[] {
	return allElements(store).filter((element) => element.name === name);
}

/**
 * Every named field element in scope: the ones the form owns, or — when the
 * form element is not rendered by `Form` — every one in the document.
 */
function allElements(store: InternalFormStore): FieldElement[] {
	// a server render has no DOM to read: the form's own element is a
	// serializable stand-in, not an `HTMLFormElement` with controls on it
	if (typeof document === "undefined") return [];
	const controls = store.element.get()?.elements;
	if (controls) return [...controls].filter(isFieldElement);
	return [...document.querySelectorAll("input, select, textarea")].filter(isFieldElement);
}

export function isFieldElement(element: Element): element is FieldElement {
	return (
		element instanceof HTMLInputElement ||
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement
	);
}

/** Every named field element of the form, in document order. */
export function formElements(store: InternalFormStore): FieldElement[] {
	return allElements(store).filter((element) => element.name !== "");
}

/**
 * Focuses the first element of a field that can actually take focus, so a
 * hidden or disabled one does not swallow it.
 */
export function focusField(store: InternalFormStore, name: string): boolean {
	for (const element of fieldElements(store, name)) {
		element.focus();
		if ((element.getRootNode() as Document | ShadowRoot).activeElement === element) return true;
	}
	return false;
}

export { namePath, ROOT_NAME };
