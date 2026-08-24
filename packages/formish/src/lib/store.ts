import { ref, signal, type Signal } from "@implementjs/core";
import * as v from "valibot";
import type {
	EmptyInput,
	FieldElement,
	FieldErrors,
	FormConfig,
	FormSchema,
	InternalArrayStore,
	InternalFieldStore,
	InternalFormStore,
	InternalObjectStore,
	InternalValueStore,
	Path,
	PathKey,
	Schema,
} from "./types";

/**
 * The default empty input of a form: a required string field starts as an
 * empty string, so an untouched text input matches the DOM and validates with
 * the schema's own message. Every other type starts as `undefined`.
 */
export const DEFAULT_EMPTY_INPUT: EmptyInput = { string: "" };

let idCount = 0;

/** An id for an array item — stable across reorders, unlike its index. */
export function createId(): string {
	idCount += 1;
	return `${idCount}`;
}

/**
 * The `name` attribute a field's elements carry, which is what ties a radio or
 * checkbox group together. Dotted, like `todos.0.label`, so it is a name the
 * DOM, CSS selectors and a form post all handle — Formisch writes the path as
 * JSON here, which a selector cannot address.
 */
export function pathName(path: Path): string {
	return path.join(".");
}

/** The path as a key that cannot collide, used to match issues to fields. */
export function pathKey(path: Path): string {
	return JSON.stringify(path);
}

/**
 * Bumps the form's revision. Everything that reads across a field and its
 * descendants derives from it, so it has to be called once after any change to
 * the tree — the last thing a public method does.
 */
export function bump(form: InternalFormStore): void {
	form.revision.set(form.revision.get() + 1);
}

/* -------------------------------------------------------------------------- */
/*                                initialization                               */
/* -------------------------------------------------------------------------- */

/**
 * The parts of a valibot schema the walk reads. Structural rather than a union
 * of every schema type, so a schema valibot adds later is still walked as far
 * as it can be instead of failing to typecheck.
 */
interface SchemaNode {
	readonly type: string;
	readonly entries?: Record<string, SchemaNode> | undefined;
	readonly wrapped?: SchemaNode | undefined;
	readonly item?: SchemaNode | undefined;
	readonly items?: readonly SchemaNode[] | undefined;
	readonly options?: readonly SchemaNode[] | undefined;
	readonly getter?: ((input: unknown) => SchemaNode) | undefined;
}

/** Schemas whose fields cannot be known up front, so a form cannot be built from them. */
const UNSUPPORTED = new Set(["object_with_rest", "record", "tuple_with_rest", "promise"]);

/** Wrappers that accept a missing value, so an absent field stays absent. */
const NULLISH_WRAPPERS = new Set([
	"exact_optional",
	"nullable",
	"nullish",
	"optional",
	"undefinedable",
]);

/** Wrappers that only narrow what they wrap, so the value passes through. */
const STRICT_WRAPPERS = new Set(["non_nullable", "non_nullish", "non_optional"]);

/** Schemas whose fields are the several branches of one shape. */
const OPTION_TYPES = new Set(["intersect", "union", "variant"]);

const ARRAY_TYPES = new Set(["array", "loose_tuple", "strict_tuple", "tuple"]);
const OBJECT_TYPES = new Set(["loose_object", "object", "strict_object"]);

function asNode(schema: Schema): SchemaNode {
	return schema;
}

/**
 * Builds the field store for `schema` and everything below it. The schema —
 * not what happens to be rendered — is what says which fields exist, so every
 * one of them has state whether or not an element is ever mounted for it.
 */
export function initializeFieldStore(
	form: InternalFormStore,
	field: Partial<InternalFieldStore>,
	schema: Schema,
	initialInput: unknown,
	path: Path,
	nullish = false,
	nullishValue?: null,
	exactOptional = false,
): void {
	const node = asNode(schema);

	if (UNSUPPORTED.has(node.type)) {
		throw new Error(`"${node.type}" schema is not supported`);
	}

	if (node.type === "lazy") {
		initializeFieldStore(
			form,
			field,
			node.getter?.(undefined) as unknown as Schema,
			initialInput,
			path,
			nullish,
			nullishValue,
			exactOptional,
		);
		return;
	}

	if (NULLISH_WRAPPERS.has(node.type)) {
		// a `nullable` accepts `null` but not `undefined`, so that is where a
		// missing value lands — and an exact optional wants no key at all
		const nextNullishValue = node.type === "nullable" ? null : nullishValue;
		const value = initialInput === undefined ? defaultOf(schema) : initialInput;
		initializeFieldStore(
			form,
			field,
			node.wrapped as unknown as Schema,
			value === undefined ? nextNullishValue : value,
			path,
			true,
			nextNullishValue,
			exactOptional || node.type === "exact_optional",
		);
		return;
	}

	if (STRICT_WRAPPERS.has(node.type)) {
		// the flag carries on, so `v.optional(v.nonOptional(…))` is still a field
		// that may be missing
		initializeFieldStore(
			form,
			field,
			node.wrapped as unknown as Schema,
			initialInput,
			path,
			nullish,
			nullishValue,
			exactOptional,
		);
		return;
	}

	if (OPTION_TYPES.has(node.type)) {
		// The branches share one field store per key, so metadata that differs
		// between them — the schema, the kind, whether it is nullish — is the
		// last branch's. A key that is required in one branch and optional in
		// another is therefore only approximated.
		for (const option of node.options ?? []) {
			initializeFieldStore(
				form,
				field,
				option as unknown as Schema,
				initialInput,
				path,
				nullish,
				nullishValue,
				exactOptional,
			);
		}
		return;
	}

	field.schema = schema;
	field.name = pathName(path);
	field.path = path;
	field.isNullish = nullish;
	field.nullishValue = nullishValue;
	field.isExactOptional = exactOptional;

	// `initialElements` and `elements` start as one array so that `reset` can
	// restore elements the array methods move between field stores
	const initialElements: FieldElement[] = [];
	field.initialElements = initialElements;
	field.elements = initialElements;

	field.errors = signal<FieldErrors | null>(null);
	field.isTouched = signal(false);
	field.isEdited = signal(false);
	field.isDirty = signal(false);

	if (ARRAY_TYPES.has(node.type)) {
		initializeArrayStore(form, field, node, initialInput, path, nullish);
	} else if (OBJECT_TYPES.has(node.type)) {
		initializeObjectStore(form, field, node, initialInput, path, nullish);
	} else {
		initializeValueStore(form, field, node, initialInput, nullish);
	}
}

function assertKind(field: Partial<InternalFieldStore>, kind: InternalFieldStore["kind"]): void {
	if (field.kind && field.kind !== kind) {
		throw new Error(`Store initialized as "${field.kind}" cannot be reinitialized as "${kind}"`);
	}
}

function initializeArrayStore(
	form: InternalFormStore,
	field: Partial<InternalFieldStore>,
	node: SchemaNode,
	initialInput: unknown,
	path: Path,
	nullish: boolean,
): void {
	assertKind(field, "array");
	const array = field as Partial<InternalArrayStore>;
	array.kind = "array";
	array.children ??= [];
	const children = array.children;

	if (node.type === "array") {
		// a dynamic array has as many items as the input gives it
		const from = Array.isArray(initialInput) ? initialInput : [];
		for (let index = 0; index < from.length; index++) {
			const child = {} as InternalFieldStore;
			children[index] = child;
			initializeFieldStore(form, child, node.item as unknown as Schema, from[index], [
				...path,
				index,
			]);
		}
	} else {
		// a tuple names each of its items, so its children come from the schema
		const from = Array.isArray(initialInput) ? initialInput : [];
		node.items?.forEach((item, index) => {
			const child = {} as InternalFieldStore;
			children[index] = child;
			initializeFieldStore(form, child, item as unknown as Schema, from[index], [...path, index]);
		});
	}

	const input = nullish && initialInput == null ? initialInput : true;
	array.initialInput = signal<true | null | undefined>(input);
	array.startInput = signal<true | null | undefined>(input);
	array.input = signal<true | null | undefined>(input);

	const items = children.map(createId);
	array.initialItems = signal(items);
	array.startItems = signal(items);
	array.items = signal(items);
}

function initializeObjectStore(
	form: InternalFormStore,
	field: Partial<InternalFieldStore>,
	node: SchemaNode,
	initialInput: unknown,
	path: Path,
	nullish: boolean,
): void {
	assertKind(field, "object");
	const object = field as Partial<InternalObjectStore>;
	object.kind = "object";
	object.children ??= {};
	const children = object.children;
	const from = isPlainObject(initialInput) ? initialInput : undefined;

	for (const key in node.entries) {
		const child = (children[key] ??= {} as InternalFieldStore);
		initializeFieldStore(form, child, node.entries[key] as unknown as Schema, from?.[key], [
			...path,
			key,
		]);
	}

	const input = nullish && initialInput == null ? initialInput : true;
	object.initialInput = signal<true | null | undefined>(input);
	object.startInput = signal<true | null | undefined>(input);
	object.input = signal<true | null | undefined>(input);
}

/** Where a field lands when nothing fills it in. */
export function emptyValueOf(form: InternalFormStore, field: InternalFieldStore): unknown {
	if (field.isNullish) return field.nullishValue;
	return form.emptyInput[(field.schema as unknown as SchemaNode).type as keyof EmptyInput];
}

/** The same, for a container: `true` unless a missing value is what it takes. */
function emptyContainerOf(field: InternalFieldStore, input: unknown): true | null | undefined {
	if (!field.isNullish || input != null) return true;
	return input ?? field.nullishValue;
}

function initializeValueStore(
	form: InternalFormStore,
	field: Partial<InternalFieldStore>,
	node: SchemaNode,
	initialInput: unknown,
	nullish: boolean,
): void {
	assertKind(field, "value");
	const value = field as Partial<InternalValueStore>;
	value.kind = "value";

	// a required field with nothing to start from falls back to the empty input
	// for its type, so an untouched field validates with the schema's own
	// message instead of a type error about `undefined`
	const input =
		initialInput === undefined && !nullish
			? form.emptyInput[node.type as keyof EmptyInput]
			: initialInput;

	value.initialInput = signal<unknown>(input);
	value.startInput = signal<unknown>(input);
	value.input = signal<unknown>(input);
}

/** A wrapper's default, ignoring an async one — a promise is not a field value. */
function defaultOf(schema: Schema): unknown {
	const value = v.getDefault(schema as v.GenericSchema);
	return typeof (value as { then?: unknown } | null | undefined)?.then === "function"
		? undefined
		: value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Builds the store behind a form, field tree and all. */
export function createFormStore<TSchema extends FormSchema>(
	config: FormConfig<TSchema>,
	parse: (input: unknown) => Promise<v.SafeParseResult<TSchema>>,
): InternalFormStore<TSchema> {
	const store: Partial<InternalFormStore<TSchema>> = {};

	// merged before the fields are built, since that is where they read it
	store.emptyInput = { ...DEFAULT_EMPTY_INPUT, ...config.emptyInput };
	store.element = ref<HTMLFormElement>();
	store.revision = signal(0);
	store.validationId = 0;
	store.validate = config.validate ?? "submit";
	store.revalidate = config.revalidate ?? "input";
	store.parse = parse;
	store.isSubmitting = signal(false);
	store.isSubmitted = signal(false);
	store.isValidating = signal(false);

	initializeFieldStore(store as InternalFormStore, store, config.schema, config.initialInput, []);

	return store as InternalFormStore<TSchema>;
}

/* -------------------------------------------------------------------------- */
/*                                   reading                                   */
/* -------------------------------------------------------------------------- */

/** The child field store under `key`, when the field has children at all. */
export function childOf(
	field: InternalFieldStore,
	key: PathKey | undefined,
): InternalFieldStore | undefined {
	if (key === undefined) return undefined;
	if (field.kind === "array") return field.children[key as number];
	if (field.kind === "object") return field.children[key as string];
	return undefined;
}

/**
 * The field store at `path`, or `undefined` when an array item along the way
 * does not exist.
 */
export function getFieldStore(form: InternalFormStore, path: Path): InternalFieldStore | undefined {
	let field: InternalFieldStore = form;
	for (const key of path) {
		if (field.kind === "array" && field.items.get()[key as number] === undefined) return undefined;
		const child = childOf(field, key);
		if (!child) return undefined;
		field = child;
	}
	return field;
}

/**
 * Walks a field store and everything below it, depth first. The callback stops
 * the walk by returning `true`, which is also what the walk returns.
 */
export function walkFieldStore(
	field: InternalFieldStore,
	callback: (field: InternalFieldStore) => boolean | void,
): boolean {
	if (callback(field)) return true;

	if (field.kind === "array") {
		const length = field.items.get().length;
		for (let index = 0; index < length; index++) {
			const child = field.children[index];
			if (child && walkFieldStore(child, callback)) return true;
		}
	} else if (field.kind === "object") {
		for (const key in field.children) {
			const child = field.children[key];
			if (child && walkFieldStore(child, callback)) return true;
		}
	}

	return false;
}

/** What a field holds, assembled from its children when it has any. */
export function getFieldInput(field: InternalFieldStore): unknown {
	if (field.kind === "array") {
		if (!field.input.get()) return field.input.get();
		const value: unknown[] = [];
		const length = field.items.get().length;
		for (let index = 0; index < length; index++) {
			const child = field.children[index];
			value[index] = child ? getFieldInput(child) : undefined;
		}
		return value;
	}

	if (field.kind === "object") {
		if (!field.input.get()) return field.input.get();
		const value: Record<string, unknown> = {};
		for (const key in field.children) {
			const child = field.children[key];
			if (!child) continue;
			const input = getFieldInput(child);
			// an exact optional wants its key absent rather than present and
			// `undefined`, which is what the schema itself rejects
			if (input === undefined && child.isExactOptional) continue;
			value[key] = input;
		}
		return value;
	}

	return field.input.get();
}

/** Whether a flag is set on a field or anywhere below it. */
export function getFieldBool(
	field: InternalFieldStore,
	type: "errors" | "isTouched" | "isEdited" | "isDirty",
): boolean {
	return walkFieldStore(field, (current) => Boolean(current[type].get()));
}

/** Sets a flag on a field and everything below it. */
export function setFieldBool(
	field: InternalFieldStore,
	type: "isTouched" | "isDirty",
	value: boolean,
): void {
	walkFieldStore(field, (current) => {
		current[type].set(value);
	});
}

/**
 * Only the parts of a field that are dirty. An array is atomic — reported in
 * full when any item is dirty — while an object key with no dirty field below
 * it is left out. `undefined` when nothing below is dirty.
 */
export function getDirtyFieldInput(field: InternalFieldStore, dirtyOnly = true): unknown {
	if (dirtyOnly && !getFieldBool(field, "isDirty")) return undefined;

	if (field.kind === "array") {
		if (!field.input.get()) return field.input.get();
		const value: unknown[] = [];
		const length = field.items.get().length;
		for (let index = 0; index < length; index++) {
			const child = field.children[index];
			value[index] = child ? getDirtyFieldInput(child, false) : undefined;
		}
		return value;
	}

	if (field.kind === "object") {
		if (!field.input.get()) return field.input.get();
		const value: Record<string, unknown> = {};
		for (const key in field.children) {
			const child = field.children[key];
			if (child && (!dirtyOnly || getFieldBool(child, "isDirty"))) {
				value[key] = getDirtyFieldInput(child, dirtyOnly);
			}
		}
		return value;
	}

	return field.input.get();
}

/* -------------------------------------------------------------------------- */
/*                                   writing                                   */
/* -------------------------------------------------------------------------- */

/**
 * Whether a value counts as changed from its baseline. An untouched text input
 * reads back as `""` and an untouched number input as `NaN`, so neither may
 * look different from the `undefined` a field started at.
 */
function isValueDirty(startInput: unknown, input: unknown): boolean {
	return startInput !== input && (startInput != null || (input !== "" && !Number.isNaN(input)));
}

/** Sets the input of a field and everything below it, marking it edited. */
function setNestedInput(form: InternalFormStore, field: InternalFieldStore, input: unknown): void {
	field.isTouched.set(true);
	field.isEdited.set(true);

	if (field.kind === "array") {
		const arrayInput = (input ?? []) as unknown[];
		const items = field.items.get();

		// a tuple has a fixed number of children and no item schema to build more
		// from, so extra input items are ignored rather than grown into
		const length = field.schema.type === "array" ? arrayInput.length : field.children.length;

		if (length < items.length) {
			field.items.set(items.slice(0, length));
		} else if (length > items.length) {
			for (let index = items.length; index < length; index++) {
				const existing = field.children[index];
				if (existing) {
					// a child left over from a longer array still holds stale errors
					// and values, but its baseline is what says whether a regrown
					// index is dirty — so that part is kept
					resetItemState(form, existing, arrayInput[index], true);
				} else {
					const child = {} as InternalFieldStore;
					field.children[index] = child;
					initializeFieldStore(
						form,
						child,
						(field.schema as unknown as SchemaNode).item as unknown as Schema,
						arrayInput[index],
						[...field.path, index],
					);
				}
			}
			field.items.set([...items, ...Array.from({ length: length - items.length }, createId)]);
		}

		for (let index = 0; index < length; index++) {
			const child = field.children[index];
			if (child) setNestedInput(form, child, arrayInput[index]);
		}

		field.input.set(input == null ? input : true);
		field.isDirty.set(
			field.startInput.get() !== field.input.get() ||
				field.startItems.get().length !== field.items.get().length,
		);
		return;
	}

	if (field.kind === "object") {
		const from = isPlainObject(input) ? input : undefined;
		for (const key in field.children) {
			const child = field.children[key];
			if (child) setNestedInput(form, child, from?.[key]);
		}
		field.input.set(input == null ? input : true);
		field.isDirty.set(field.startInput.get() !== field.input.get());
		return;
	}

	field.input.set(input);
	field.isDirty.set(isValueDirty(field.startInput.get(), input));
}

/**
 * Writes the input at `path`, marking every container along the way as
 * present. Does not bump the revision — the caller does, once it is done.
 */
export function setFieldInput(form: InternalFormStore, path: Path, input: unknown): void {
	let field: InternalFieldStore = form;

	for (let index = 0; index < path.length; index++) {
		const child = childOf(field, path[index]);
		if (!child) return;
		field = child;

		if (index < path.length - 1) {
			field.input.set(true);
			// a container that was missing is now present even when the child
			// being written matches its own baseline; an array also compares its
			// item ids, so a changed length or order still reads as dirty
			field.isDirty.set(
				field.startInput.get() !== field.input.get() ||
					(field.kind === "array" && field.startItems.get().join() !== field.items.get().join()),
			);
		}
	}

	setNestedInput(form, field, input);
}

/** Sets what a field and its children go back to on a reset. */
export function setInitialFieldInput(
	form: InternalFormStore,
	field: InternalFieldStore,
	initialInput: unknown,
): void {
	if (field.kind === "array") {
		field.initialInput.set(initialInput == null ? initialInput : true);
		const from = (initialInput ?? []) as unknown[];
		const length = field.schema.type === "array" ? from.length : field.children.length;

		for (let index = field.children.length; index < length; index++) {
			const child = {} as InternalFieldStore;
			field.children[index] = child;
			initializeFieldStore(
				form,
				child,
				(field.schema as unknown as SchemaNode).item as unknown as Schema,
				from[index],
				[...field.path, index],
			);
		}

		field.initialItems.set(Array.from({ length }, createId));

		for (let index = 0; index < field.children.length; index++) {
			const child = field.children[index];
			if (child) setInitialFieldInput(form, child, from[index]);
		}
		return;
	}

	if (field.kind === "object") {
		field.initialInput.set(initialInput == null ? initialInput : true);
		const from = isPlainObject(initialInput) ? initialInput : undefined;
		for (const key in field.children) {
			const child = field.children[key];
			if (child) setInitialFieldInput(form, child, from?.[key]);
		}
		return;
	}

	// left where a fresh field would start, so an initial input that leaves a
	// field out is the same as never having had one
	field.initialInput.set(initialInput === undefined ? emptyValueOf(form, field) : initialInput);
}

/* -------------------------------------------------------------------------- */
/*                                  elements                                   */
/* -------------------------------------------------------------------------- */

/**
 * What an element currently holds, as the field should store it. The schema
 * decides the shape — an array field reads a group of checkboxes, a `multiple`
 * select and a file input as lists — so a mis-set `multiple` attribute cannot
 * corrupt the field. A text input reads back as a string, so a field typed as
 * a number or a date needs a handler of its own to convert.
 */
export function getElementInput(element: FieldElement, field: InternalFieldStore): unknown {
	if (typeof HTMLSelectElement !== "undefined" && element instanceof HTMLSelectElement) {
		if (field.kind !== "array") return element.value;
		return [...element.options]
			.filter((option) => option.selected && !option.disabled)
			.map((option) => option.value);
	}

	if (typeof HTMLInputElement !== "undefined" && element instanceof HTMLInputElement) {
		if (element.type === "checkbox") {
			if (field.kind !== "array") return element.checked;
			// the schema says this is a group, so the other boxes under the same
			// name are read too — even when only one of them is rendered
			return [...document.getElementsByName(element.name)]
				.filter(
					(option): option is HTMLInputElement =>
						option instanceof HTMLInputElement &&
						option.checked &&
						!option.disabled &&
						option.form === element.form,
				)
				.map((option) => option.value);
		}

		// an unchecked radio says nothing about the field: the checked one in the
		// group already reported the value
		if (element.type === "radio") {
			return element.checked ? element.value : getFieldInput(field);
		}

		if (element.type === "file") {
			const files = [...(element.files ?? [])];
			return field.kind === "array" ? files : files[0];
		}
	}

	return element.value;
}

/**
 * Focuses the first element of a field that can actually take focus, so a
 * hidden or disabled one does not swallow it. The browser decides, which is
 * read back through the element's own root so a shadow root works too.
 */
export function focusFieldElement(field: InternalFieldStore): boolean {
	for (const element of field.elements) {
		element.focus();
		if ((element.getRootNode() as Document | ShadowRoot).activeElement === element) return true;
	}
	return false;
}

export function isFieldElement(element: unknown): element is FieldElement {
	// a server render has no DOM constructors to compare against, and nothing
	// there is a field element in the first place
	if (typeof HTMLInputElement === "undefined") return false;
	return (
		element instanceof HTMLInputElement ||
		element instanceof HTMLSelectElement ||
		element instanceof HTMLTextAreaElement
	);
}

/* -------------------------------------------------------------------------- */
/*                               array item state                              */
/* -------------------------------------------------------------------------- */

/**
 * Copies the state of one array item onto another: its value, its flags, its
 * errors and the elements bound to it. Everything the item carries travels
 * with it, so a row keeps its own state when its neighbours move — all except
 * `initialInput` and `initialItems`, which belong to the index rather than the
 * item and are what a reset goes back to.
 */
export function copyItemState(
	form: InternalFormStore,
	from: InternalFieldStore,
	to: InternalFieldStore,
): void {
	to.elements = from.elements;
	to.errors.set(from.errors.get());
	to.startInput.set(from.startInput.get() as never);
	to.input.set(from.input.get() as never);
	to.isTouched.set(from.isTouched.get());
	to.isEdited.set(from.isEdited.get());
	to.isDirty.set(from.isDirty.get());

	if (from.kind === "array" && to.kind === "array") {
		const fromItems = from.items.get();
		to.startItems.set(from.startItems.get());
		to.items.set(fromItems);
		for (let index = 0; index < fromItems.length; index++) {
			const child = from.children[index];
			if (!child) continue;
			copyItemState(form, child, childAt(form, to, index));
		}
	} else if (from.kind === "object" && to.kind === "object") {
		for (const key in from.children) {
			const child = from.children[key];
			const target = to.children[key];
			if (child && target) copyItemState(form, child, target);
		}
	}
}

/** Swaps the state of two array items, everything below them included. */
export function swapItemState(
	form: InternalFormStore,
	first: InternalFieldStore,
	second: InternalFieldStore,
): void {
	const elements = first.elements;
	first.elements = second.elements;
	second.elements = elements;

	swapSignals(first.errors, second.errors);
	swapSignals(first.startInput as Signal<unknown>, second.startInput as Signal<unknown>);
	swapSignals(first.input as Signal<unknown>, second.input as Signal<unknown>);
	swapSignals(first.isTouched, second.isTouched);
	swapSignals(first.isEdited, second.isEdited);
	swapSignals(first.isDirty, second.isDirty);

	if (first.kind === "array" && second.kind === "array") {
		const firstItems = first.items.get();
		const secondItems = second.items.get();
		swapSignals(first.startItems, second.startItems);
		first.items.set(secondItems);
		second.items.set(firstItems);

		const length = Math.max(firstItems.length, secondItems.length);
		for (let index = 0; index < length; index++) {
			swapItemState(form, childAt(form, first, index), childAt(form, second, index));
		}
	} else if (first.kind === "object" && second.kind === "object") {
		for (const key in first.children) {
			const child = first.children[key];
			const other = second.children[key];
			if (child && other) swapItemState(form, child, other);
		}
	}
}

function swapSignals<T>(first: Signal<T>, second: Signal<T>): void {
	const value = first.get();
	first.set(second.get());
	second.set(value);
}

/**
 * Puts an array item back to a starting point: a fresh value, no errors, no
 * flags and no elements. `initialInput` and `initialItems` are left alone, so a
 * later `reset` still goes back to where the form started. `keepStart` leaves
 * the dirty baseline alone too, which is what a regrown index needs for an edit
 * to still read as dirty.
 */
export function resetItemState(
	form: InternalFormStore,
	field: InternalFieldStore,
	input: unknown,
	keepStart = false,
): void {
	// the elements are cleared, and `initialElements` follows while the field
	// still owns them — a reorder has moved them otherwise, and the field they
	// moved to is the one that should keep them
	const elements: FieldElement[] = [];
	if (field.elements === field.initialElements) field.initialElements = elements;
	field.elements = elements;

	field.errors.set(null);
	field.isTouched.set(false);
	field.isEdited.set(false);
	field.isDirty.set(false);

	if (field.kind === "array" || field.kind === "object") {
		// a container holds `true`, `null` or `undefined` rather than a value, and
		// a missing input on a required one becomes a present empty container —
		// the same as where it would have started
		const containerInput = emptyContainerOf(field, input);
		if (!keepStart) field.startInput.set(containerInput);
		field.input.set(containerInput);

		if (field.kind === "array") {
			// a tuple's children come from the schema, which cannot recreate them,
			// so it keeps them even when the input is missing
			const isTuple = field.schema.type !== "array";

			if (input || isTuple) {
				const from = input as unknown[] | null | undefined;
				const length = isTuple ? field.children.length : (from as unknown[]).length;
				const items = Array.from({ length }, createId);
				if (!keepStart) field.startItems.set(items);
				field.items.set(items);

				for (let index = 0; index < length; index++) {
					const itemInput = from?.[index];
					const child = field.children[index];
					if (child) {
						resetItemState(form, child, itemInput, keepStart);
					} else {
						field.children[index] = createItemStore(form, field, index, itemInput);
					}
				}
			} else {
				if (!keepStart) field.startItems.set([]);
				field.items.set([]);
			}
		} else {
			const from = isPlainObject(input) ? input : undefined;
			for (const key in field.children) {
				const child = field.children[key];
				if (child) resetItemState(form, child, from?.[key], keepStart);
			}
		}
		return;
	}

	// a required field with nothing to start from falls back to its empty input,
	// so a reset lands where initialization would have
	const valueInput = input === undefined ? emptyValueOf(form, field) : input;
	if (!keepStart) field.startInput.set(valueInput);
	field.input.set(valueInput);
}

/** The item store at `index`, built from the array's item schema if it is missing. */
export function childAt(
	form: InternalFormStore,
	array: InternalArrayStore,
	index: number,
): InternalFieldStore {
	const existing = array.children[index];
	if (existing) return existing;
	const child = createItemStore(form, array, index, undefined);
	array.children[index] = child;
	return child;
}

/** A field store for an array item the array has never had. */
export function createItemStore(
	form: InternalFormStore,
	array: InternalArrayStore,
	index: number,
	initialInput: unknown,
): InternalFieldStore {
	const child = {} as InternalFieldStore;
	initializeFieldStore(
		form,
		child,
		(array.schema as unknown as SchemaNode).item as unknown as Schema,
		initialInput,
		[...array.path, index],
	);
	return child;
}
