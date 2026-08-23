import * as v from "valibot";
import { isPlainObject, type Path, type PathKey } from "./path";

/**
 * What a required field of a given type starts at when nothing else fills it
 * in. An optional field is left missing and a nullable one starts at `null`,
 * since each already accepts that; so is any type not named here.
 */
export interface EmptyInput {
	/**
	 * Where a string field starts. An empty string by default, so an untouched
	 * text input validates with the message the schema gives it rather than a
	 * type error about `undefined`. Set it to `undefined` to opt out.
	 */
	readonly string?: string | undefined;
	/**
	 * Where a boolean field starts. `false` by default, so an untouched
	 * checkbox validates as unchecked rather than as missing.
	 */
	readonly boolean?: boolean | undefined;
	/** Where a number field starts. `undefined` by default. */
	readonly number?: number | undefined;
	/** Where a date field starts. `undefined` by default. */
	readonly date?: Date | undefined;
}

/**
 * The empty input a form uses unless its config overrides it. Strings and
 * booleans are the two a rendered form always shows a value for — an empty
 * text box, an unchecked box — so they start there instead of missing. A
 * number input shows nothing at all when it is empty, so it stays missing.
 */
export const DEFAULT_EMPTY_INPUT: EmptyInput = { string: "", boolean: false };

export interface SeedConfig {
	readonly emptyInput: EmptyInput;
	/** Called with the path of every field the schema says holds a list. */
	readonly onArrayField?: ((path: Path) => void) | undefined;
}

/**
 * The parts of a valibot schema the walk reads. Kept structural rather than as
 * a union of every schema type, so a schema valibot adds later walks as far as
 * it can instead of failing to typecheck.
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

/** Wrappers that accept a missing value, so an absent field stays absent. */
const NULLISH_WRAPPERS = new Set([
	"optional",
	"exact_optional",
	"nullable",
	"nullish",
	"undefinedable",
]);

/** Wrappers that only narrow what they wrap, so the value passes through. */
const STRICT_WRAPPERS = new Set(["non_optional", "non_nullable", "non_nullish"]);

const OBJECT_TYPES = new Set(["object", "loose_object", "strict_object", "object_with_rest"]);
const TUPLE_TYPES = new Set(["tuple", "loose_tuple", "strict_tuple", "tuple_with_rest"]);

/**
 * Types the walk cannot see inside of. A union or a variant could be seeded
 * from any of its branches and there is nothing to say which; a record's keys
 * only exist at runtime. Their value is left exactly as it came.
 */
const OPAQUE_TYPES = new Set(["union", "variant", "record", "promise"]);

/**
 * How deep the walk goes before it gives up. A schema that recurses through
 * required fields describes a value no input can satisfy, and only a bound
 * keeps it from running off the stack.
 */
const MAX_DEPTH = 40;

/**
 * The form input the schema describes: `initialInput` with every field the
 * schema names filled in, down to the leaves.
 *
 * This is what makes a field the form never renders behave like one it does. A
 * text field that is on screen but untouched and a text field nobody rendered
 * both validate as `""`, so the schema answers with its own message either way
 * — instead of the form quietly refusing to submit over a `undefined` no field
 * is showing.
 */
export function seedInput(
	schema: unknown,
	initialInput: unknown,
	config: SeedConfig,
): Record<string, unknown> {
	const seeded = seed(schema as SchemaNode, initialInput, [], false, config, 0);
	return isPlainObject(seeded) ? seeded : {};
}

/**
 * The same, for a value destined for one field — a new array item, or a new
 * starting point handed to `reset`. Falls back to the value as given when the
 * schema cannot be walked down to `path`.
 */
export function seedField(
	schema: unknown,
	path: Path,
	input: unknown,
	config: SeedConfig,
): unknown {
	const node = schemaAt(schema as SchemaNode, path, 0);
	return node ? seed(node, input, path, false, config, 0) : input;
}

function seed(
	node: SchemaNode | undefined,
	input: unknown,
	path: Path,
	nullish: boolean,
	config: SeedConfig,
	depth: number,
): unknown {
	if (!node || depth > MAX_DEPTH) return input;

	if (node.type === "lazy") {
		return seed(node.getter?.(input), input, path, nullish, config, depth + 1);
	}

	if (NULLISH_WRAPPERS.has(node.type)) {
		const value = input === undefined ? defaultOf(node) : input;
		// a field that is not there stays not there: seeding the fields of an
		// absent object would make it look present, and a schema that recurses
		// through an optional would never bottom out. A nullable is the one that
		// still needs a value, since it accepts `null` but not `undefined`.
		if (value == null) return node.type === "nullable" ? null : value;
		return seed(node.wrapped, value, path, true, config, depth + 1);
	}

	if (STRICT_WRAPPERS.has(node.type)) {
		// the flag carries on, so `v.optional(v.nonOptional(…))` is still a field
		// that may be missing
		return seed(node.wrapped, input, path, nullish, config, depth + 1);
	}

	if (node.type === "intersect") {
		const parts = node.options?.map((option) =>
			seed(option, input, path, nullish, config, depth + 1),
		);
		// only an intersection of objects has a value that can be put back
		// together; anything else is left as it came
		if (!parts?.length || !parts.every(isPlainObject)) return input;
		return Object.assign({}, ...parts) as Record<string, unknown>;
	}

	if (OBJECT_TYPES.has(node.type)) {
		const from = isPlainObject(input) ? input : {};
		// keys the schema does not name are carried over rather than dropped: a
		// loose object and an object with a rest schema both accept them
		const value: Record<string, unknown> = { ...from };
		for (const key in node.entries) {
			const child = seed(node.entries[key], from[key], [...path, key], false, config, depth + 1);
			// a key that seeds to nothing is left out rather than written as
			// `undefined`: an exact optional wants it absent, and every other
			// optional reads the same either way
			if (child === undefined && !(key in from)) continue;
			value[key] = child;
		}
		return value;
	}

	if (node.type === "array") {
		config.onArrayField?.(path);
		const from = Array.isArray(input) ? input : [];
		return from.map((item, index) =>
			seed(node.item, item, [...path, index], false, config, depth + 1),
		);
	}

	if (TUPLE_TYPES.has(node.type)) {
		config.onArrayField?.(path);
		const from = Array.isArray(input) ? (input as unknown[]) : [];
		// items past the fixed ones belong to the rest schema, so they stay
		const value = [...from];
		node.items?.forEach((item, index) => {
			value[index] = seed(item, from[index], [...path, index], false, config, depth + 1);
		});
		return value;
	}

	if (OPAQUE_TYPES.has(node.type)) return input;

	if (input !== undefined || nullish) return input;
	return config.emptyInput[node.type as keyof EmptyInput];
}

/** The schema of the field at `path`, or `undefined` when the walk cannot reach it. */
function schemaAt(node: SchemaNode | undefined, path: Path, depth: number): SchemaNode | undefined {
	const unwrapped = unwrap(node, depth);
	if (!unwrapped || path.length === 0) return unwrapped;

	const [key, ...rest] = path as readonly [PathKey, ...Path];
	return schemaAt(childAt(unwrapped, key, depth), rest, depth + 1);
}

function childAt(node: SchemaNode, key: PathKey, depth: number): SchemaNode | undefined {
	if (node.type === "intersect") {
		for (const option of node.options ?? []) {
			const child = childAt(unwrap(option, depth) ?? option, key, depth + 1);
			if (child) return child;
		}
		return undefined;
	}
	if (typeof key === "number") {
		// an array has one schema for every item; a tuple names each of its own
		return node.type === "array" ? node.item : node.items?.[key];
	}
	return node.entries?.[key];
}

/** Strips the wrappers that do not change where a field's children live. */
function unwrap(node: SchemaNode | undefined, depth: number): SchemaNode | undefined {
	if (!node || depth > MAX_DEPTH) return node;
	if (node.type === "lazy") return unwrap(node.getter?.(undefined), depth + 1);
	if (NULLISH_WRAPPERS.has(node.type) || STRICT_WRAPPERS.has(node.type)) {
		return unwrap(node.wrapped, depth + 1);
	}
	return node;
}

/** A wrapper's default, ignoring an async one — a promise is not a field value. */
function defaultOf(node: SchemaNode): unknown {
	const value = v.getDefault(node as unknown as v.GenericSchema);
	return typeof (value as { then?: unknown } | null | undefined)?.then === "function"
		? undefined
		: value;
}
