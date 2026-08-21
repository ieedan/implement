import type { Readable, ReadableSource } from "@implementjs/core";
import type { Path, PathKey, RequiredPath } from "./path";
import type { InferInput, StandardSchemaV1 } from "./standard-schema";

/**
 * A schema a form can be built from: anything implementing Standard Schema
 * whose input is an object, since a form's fields are its properties.
 */
export type FormSchema = StandardSchemaV1<Record<string, unknown>, unknown>;

/** The elements a field can be bound to. */
export type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** A field's errors, if it has any. There is never an empty list. */
export type FieldErrors = [string, ...string[]];

/**
 * Values that end a path: they have no fields of their own, so no path
 * navigates into them.
 */
type Leaf =
	| string
	| number
	| boolean
	| bigint
	| symbol
	| null
	| undefined
	| Date
	| File
	| Blob
	| ((...args: never[]) => unknown);

/** The keys a path may step through at `T`: array indices, or object keys. */
type KeysOf<T> = T extends Leaf
	? never
	: T extends readonly unknown[]
		? number
		: T extends object
			? Extract<keyof T, PathKey>
			: never;

/** The value reached by stepping through `K` at `T`. */
type ValueAt<T, K extends PathKey> = T extends readonly (infer Item)[]
	? Item
	: K extends keyof T
		? T[K]
		: never;

type DeepFieldPath<TChild, TKey extends PathKey, TDepth extends 0[]> = [KeysOf<TChild>] extends [
	never,
]
	? never
	: readonly [TKey, ...FieldPath<TChild, [...TDepth, 0]>];

/**
 * Every path that addresses a field of `TInput`, as a union of tuples — which
 * is what gives `path` its autocompletion.
 *
 * Exact for the first five levels of nesting; below that any path is accepted,
 * so a deeply nested field still works, only without the narrowing.
 */
export type FieldPath<TInput, TDepth extends 0[] = []> = TDepth["length"] extends 5
	? RequiredPath
	: [KeysOf<NonNullable<TInput>>] extends [never]
		? never
		: {
				[TKey in KeysOf<NonNullable<TInput>>]:
					| readonly [TKey]
					| DeepFieldPath<NonNullable<ValueAt<NonNullable<TInput>, TKey>>, TKey, TDepth>;
			}[KeysOf<NonNullable<TInput>>];

type DeepArrayPath<TChild, TKey extends PathKey, TDepth extends 0[]> = [KeysOf<TChild>] extends [
	never,
]
	? never
	: readonly [TKey, ...ArrayPath<TChild, [...TDepth, 0]>];

/** Like {@link FieldPath}, narrowed to the paths whose value is an array. */
export type ArrayPath<TInput, TDepth extends 0[] = []> = TDepth["length"] extends 5
	? RequiredPath
	: [KeysOf<NonNullable<TInput>>] extends [never]
		? never
		: {
				[TKey in KeysOf<NonNullable<TInput>>]:
					| (NonNullable<ValueAt<NonNullable<TInput>, TKey>> extends readonly unknown[]
							? readonly [TKey]
							: never)
					| DeepArrayPath<NonNullable<ValueAt<NonNullable<TInput>, TKey>>, TKey, TDepth>;
			}[KeysOf<NonNullable<TInput>>];

/** The value `TPath` addresses within `TInput`. */
export type PathValue<TInput, TPath extends Path> = TPath extends readonly [
	infer TKey extends PathKey,
	...infer TRest extends Path,
]
	? PathValue<ValueAt<NonNullable<TInput>, TKey>, TRest>
	: TInput;

/** The item type of an array field. */
export type ItemValue<TValue> =
	NonNullable<TValue> extends readonly (infer TItem)[] ? TItem : never;

export type DeepPartial<T> = T extends Leaf
	? T
	: T extends readonly (infer TItem)[]
		? DeepPartial<TItem>[]
		: { [TKey in keyof T]?: DeepPartial<T[TKey]> };

/**
 * What a field actually holds while the form is being filled in: the schema's
 * input type, but every part of it may still be missing.
 */
export type PartialInput<T> = DeepPartial<T> | undefined;

/** The form input as it currently stands, before it has been validated. */
export type FormInput<TSchema extends FormSchema> = PartialInput<InferInput<TSchema>> &
	Record<string, unknown>;

/** A path, or a readable of one — a field whose path moves, like an array item. */
export type MaybeReadablePath<TPath extends Path> = TPath | ReadableSource<TPath>;

/**
 * When a form validates. `initial` validates once up front, `submit` on the
 * first submit, and the rest on the matching field event.
 */
export type ValidationMode = "initial" | "touch" | "input" | "change" | "blur" | "submit";

/** How a form revalidates once a field has already reported an error. */
export type RevalidationMode = Exclude<ValidationMode, "initial">;

export interface FormConfig<TSchema extends FormSchema> {
	/** The schema the form input is validated against. */
	readonly schema: TSchema;
	/** What the fields start at. Anything left out starts empty. */
	readonly initialInput?: DeepPartial<InferInput<TSchema>> | undefined;
	/** When the form first validates. Defaults to `"submit"`. */
	readonly validate?: ValidationMode | undefined;
	/** When it validates again after a field reported an error. Defaults to `"input"`. */
	readonly revalidate?: RevalidationMode | undefined;
}

/**
 * The props a field element needs to take part in the form. Spread them onto
 * an `Input`, `Select` or `Textarea` and add the value binding the element
 * calls for (`value` for text, `checked` for a checkbox).
 */
export interface FieldElementProps {
	/** Identifies the element as this field's, in the store and for grouped inputs. */
	readonly name: Readable<string>;
	readonly onFocus: () => void;
	readonly onInput: (event: { readonly currentTarget: FieldElement }) => void;
	readonly onChange: (event: { readonly currentTarget: FieldElement }) => void;
	readonly onBlur: () => void;
}
