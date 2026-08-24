import type { Readable, Ref, Signal } from "@implementjs/core";
import type * as v from "valibot";
import type { INTERNAL } from "./internal";

/* -------------------------------------------------------------------------- */
/*                                   utility                                   */
/* -------------------------------------------------------------------------- */

/** True when `T` is `any`. */
type IsAny<T> = 0 extends 1 & T ? true : false;

/** True when `T` is `never`. */
type IsNever<T> = [T] extends [never] ? true : false;

/** A value that may or may not have to be awaited. */
export type MaybePromise<T> = T | Promise<T>;

/**
 * A value that may arrive as a readable. Formisch takes plain values because a
 * framework re-renders around them; implement binds instead, so a path that has
 * to follow an array item as it moves arrives as a readable.
 */
export type MaybeReadable<T> = T | Readable<T>;

/** Makes every property deeply optional. */
export type DeepPartial<TValue> = TValue extends Record<PropertyKey, unknown> | readonly unknown[]
	? { [TKey in keyof TValue]?: DeepPartial<TValue[TKey]> | undefined }
	: TValue | undefined;

/**
 * Makes every value property optional, leaving the shape itself alone.
 *
 * For a dynamic array only plain objects and nested arrays are recursed into;
 * primitives and class instances are kept as they are, so a `File[]` does not
 * become a `(File | undefined)[]`.
 */
export type PartialValues<TValue> = TValue extends readonly (infer TItem)[]
	? number extends TValue["length"]
		? // `infer TItem` is naked, so the conditional distributes over each
			// member of a union item type instead of testing the union as a whole
			(TItem extends Record<PropertyKey, unknown> | readonly unknown[]
				? { [TKey in keyof TItem]: PartialValues<TItem[TKey]> }
				: TItem)[]
		: { [TKey in keyof TValue]: PartialValues<TValue[TKey]> }
	: TValue extends Record<PropertyKey, unknown>
		? { [TKey in keyof TValue]: PartialValues<TValue[TKey]> }
		: TValue | undefined;

/** What a field holds while the form is being filled in. */
export type PartialInput<TValue> = PartialValues<TValue>;

/* -------------------------------------------------------------------------- */
/*                                    paths                                    */
/* -------------------------------------------------------------------------- */

/** A single segment of a {@link Path}: an object key or an array index. */
export type PathKey = string | number;

/** Where a field lives in the form input, e.g. `["todos", 0, "label"]`. */
export type Path = readonly PathKey[];

/** A path with at least one segment — every field except the form root. */
export type RequiredPath = readonly [PathKey, ...Path];

/**
 * The keys that may be stepped through at `TValue`: the literal indices of a
 * tuple, `number` for a dynamic array, the keys of an object, and nothing at
 * all for anything else.
 */
export type ExactKeysOf<TValue> =
	IsAny<TValue> extends true
		? never
		: TValue extends readonly unknown[]
			? number extends TValue["length"]
				? number
				: {
						[TKey in keyof TValue]: TKey extends `${infer TIndex extends number}` ? TIndex : never;
					}[number]
			: TValue extends Record<PropertyKey, unknown>
				? keyof TValue & PathKey
				: never;

/**
 * The indexable properties of `TValue`, flattened. A union of objects has the
 * properties of every member merged, so a key that only some members carry is
 * still reachable instead of collapsing to `any`.
 */
export type PropertiesOf<TValue> = {
	[TKey in ExactKeysOf<TValue>]: TValue extends Record<TKey, infer TItem> ? TItem : never;
};

/**
 * Whether the project is built with `exactOptionalPropertyTypes`. Without it
 * the built-in `Required<T>` strips `| undefined` from an optional property,
 * which would narrow the input type of `v.optional` wrongly.
 */
type IsExactOptionalProps = Required<{ key?: undefined }>["key"] extends never ? false : true;

/** `Required<T>`, but keeping the `| undefined` the built-in one strips. */
type ExactRequired<TValue> =
	TValue extends Record<PropertyKey, unknown>
		? IsExactOptionalProps extends true
			? Required<TValue>
			: { [TKey in keyof Required<TValue>]: TValue[TKey] }
		: TValue;

/** The value `TPath` addresses within `TValue`. */
export type PathValue<TValue, TPath extends Path> = TPath extends readonly [
	infer TKey,
	...infer TRest extends Path,
]
	? TKey extends ExactKeysOf<ExactRequired<TValue>>
		? PathValue<PropertiesOf<ExactRequired<TValue>>[TKey], TRest>
		: unknown
	: TValue;

/**
 * Whether `TValue` is a dynamic array or holds one anywhere inside. A tuple is
 * not one itself, but counts when it contains one, so a path can still travel
 * through a tuple to reach an array below it.
 */
type IsOrHasArray<TValue> = true extends (
	IsAny<TValue> extends true
		? false
		: TValue extends readonly unknown[]
			? number extends TValue["length"]
				? true
				: IsOrHasArray<TValue[number]>
			: TValue extends Record<PropertyKey, unknown>
				? { [TKey in keyof TValue]: IsOrHasArray<TValue[TKey]> }[keyof TValue]
				: false
)
	? true
	: false;

/** Like {@link ExactKeysOf}, narrowed to the keys that lead to an array. */
type ExactKeysOfArrayPath<TValue> =
	IsAny<TValue> extends true
		? never
		: TValue extends readonly (infer TItem)[]
			? number extends TValue["length"]
				? IsOrHasArray<TItem> extends true
					? number
					: never
				: {
						[TKey in keyof TValue]: TKey extends `${infer TIndex extends number}`
							? IsOrHasArray<NonNullable<TValue[TKey]>> extends true
								? TIndex
								: never
							: never;
					}[number]
			: TValue extends Record<PropertyKey, unknown>
				? {
						[TKey in keyof TValue]: IsOrHasArray<NonNullable<TValue[TKey]>> extends true
							? TKey
							: never;
					}[keyof TValue] &
						PathKey
				: never;

/** Like {@link PropertiesOf}, keyed by the keys that lead to an array. */
type PropertiesOfArrayPath<TValue> = {
	[TKey in ExactKeysOfArrayPath<TValue>]: TValue extends Record<TKey, infer TItem> ? TItem : never;
};

type DeepFieldPath<TChild, TKey extends PathKey, TDepth extends 0[]> = TChild extends
	| readonly unknown[]
	| Record<PropertyKey, unknown>
	? readonly [TKey, ...FieldPath<TChild, [...TDepth, 0]>]
	: never;

/**
 * Every path that addresses a field of `TValue`, as a union of tuples — which
 * is what gives `path` its autocompletion and turns a typo into a type error.
 *
 * Exact for the first five levels of nesting; below that any path is accepted,
 * so a deeply nested field still works, only without the narrowing.
 */
export type FieldPath<TValue, TDepth extends 0[] = []> = TDepth["length"] extends 5
	? RequiredPath
	: TValue extends readonly unknown[] | Record<PropertyKey, unknown>
		? {
				[TKey in ExactKeysOf<TValue>]:
					| readonly [TKey]
					| DeepFieldPath<NonNullable<PropertiesOf<TValue>[TKey]>, TKey, TDepth>;
			}[ExactKeysOf<TValue>]
		: never;

type DeepArrayPath<TChild, TKey extends PathKey, TDepth extends 0[]> = TChild extends
	| readonly unknown[]
	| Record<PropertyKey, unknown>
	? readonly [TKey, ...ArrayPath<TChild, [...TDepth, 0]>]
	: never;

/** Like {@link FieldPath}, narrowed to the paths whose field is a dynamic array. */
export type ArrayPath<TValue, TDepth extends 0[] = []> = TDepth["length"] extends 5
	? RequiredPath
	: TValue extends readonly unknown[] | Record<PropertyKey, unknown>
		? {
				[TKey in ExactKeysOfArrayPath<TValue>]:
					| (NonNullable<PropertiesOfArrayPath<TValue>[TKey]> extends readonly unknown[]
							? number extends NonNullable<PropertiesOfArrayPath<TValue>[TKey]>["length"]
								? readonly [TKey]
								: never
							: never)
					| DeepArrayPath<NonNullable<PropertiesOfArrayPath<TValue>[TKey]>, TKey, TDepth>;
			}[ExactKeysOfArrayPath<TValue>]
		: never;

type DeepDirtyPath<TChild, TKey extends PathKey, TDepth extends 0[]> =
	TChild extends Record<PropertyKey, unknown>
		? readonly [TKey, ...DirtyPath<TChild, [...TDepth, 0]>]
		: never;

/**
 * Every path {@link getDirtyPaths} can report. An object field contributes its
 * own path and those of its children; an array or tuple contributes only its
 * own, because a dirty array is reported whole.
 */
export type DirtyPath<TValue, TDepth extends 0[] = []> = TDepth["length"] extends 5
	? RequiredPath
	: TValue extends Record<PropertyKey, unknown>
		? {
				[TKey in ExactKeysOf<TValue>]:
					| readonly [TKey]
					| DeepDirtyPath<NonNullable<PropertiesOf<TValue>[TKey]>, TKey, TDepth>;
			}[ExactKeysOf<TValue>]
		: never;

/** True when `TPath` is a path of `TValue`, used to keep inference honest. */
export type IsFieldPath<TValue, TPath extends Path> =
	IsNever<TPath & FieldPath<TValue>> extends true ? false : true;

/* -------------------------------------------------------------------------- */
/*                                   schemas                                   */
/* -------------------------------------------------------------------------- */

/** Any valibot schema, sync or async — what a nested field is described by. */
export type Schema = v.GenericSchema | v.GenericSchemaAsync;

/**
 * A schema a form can be built from: a valibot schema, sync or async, whose
 * input is an object — a form's fields are its properties.
 */
export type FormSchema =
	| v.GenericSchema<Record<string, unknown>>
	| v.GenericSchemaAsync<Record<string, unknown>>;

/** The type a schema accepts, e.g. what the form's fields hold. */
export type InferInput<TSchema extends FormSchema> = v.InferInput<TSchema>;

/** The type a schema produces, e.g. what a submit handler receives. */
export type InferOutput<TSchema extends FormSchema> = v.InferOutput<TSchema>;

/** The elements a field can be bound to. */
export type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** A field's errors, if it has any. There is never an empty list. */
export type FieldErrors = [string, ...string[]];

/* -------------------------------------------------------------------------- */
/*                                    form                                     */
/* -------------------------------------------------------------------------- */

/**
 * When a form validates. `initial` validates once up front, `submit` on the
 * first submit, and the rest on the matching field event.
 */
export type ValidationMode = "initial" | "touch" | "input" | "change" | "blur" | "submit";

/** How a form revalidates once a field has already reported an error. */
export type RevalidationMode = Exclude<ValidationMode, "initial">;

/**
 * Where a required field of a given type starts when no initial input says
 * otherwise. Optional and nullable fields are untouched by it, since they
 * accept `undefined` already; only a required field whose input is `undefined`
 * falls back to these.
 */
export interface EmptyInput {
	/**
	 * Where a string field starts. An empty string by default, so an untouched
	 * text input matches the DOM and validates with the message the schema gives
	 * it rather than a type error about `undefined`. Set it to `undefined` to
	 * opt out.
	 */
	readonly string?: string | undefined;
	/** Where a number field starts. `undefined` by default. */
	readonly number?: number | undefined;
	/** Where a boolean field starts. `undefined` by default. */
	readonly boolean?: boolean | undefined;
	/** Where a date field starts. `undefined` by default. */
	readonly date?: Date | undefined;
}

export interface FormConfig<TSchema extends FormSchema = FormSchema> {
	/** The schema the form input is validated against. */
	readonly schema: TSchema;
	/** What the fields start at. Anything left out starts empty. */
	readonly initialInput?: DeepPartial<v.InferInput<TSchema>> | undefined;
	/**
	 * Where a required field of a given type starts when `initialInput` does
	 * not say. Merged over the defaults, so `{ string: "" }` stays in effect
	 * unless it is named again.
	 */
	readonly emptyInput?: EmptyInput | undefined;
	/** When the form first validates. Defaults to `"submit"`. */
	readonly validate?: ValidationMode | undefined;
	/** When it validates again after a field reported an error. Defaults to `"input"`. */
	readonly revalidate?: RevalidationMode | undefined;
}

/** What a submit handler receives once the input has passed the schema. */
export type SubmitHandler<TSchema extends FormSchema> = (
	output: v.InferOutput<TSchema>,
) => MaybePromise<unknown>;

/** The same, for a handler that also wants the event that triggered it. */
export type SubmitEventHandler<TSchema extends FormSchema> = (
	output: v.InferOutput<TSchema>,
	event: SubmitLikeEvent,
) => MaybePromise<unknown>;

/** The part of a submit event a handler is given. */
export interface SubmitLikeEvent {
	preventDefault: () => void;
}

/* -------------------------------------------------------------------------- */
/*                              internal stores                                */
/* -------------------------------------------------------------------------- */

/** What every field store carries, whatever kind of field it describes. */
export interface InternalBaseStore {
	/** The kind of field store. */
	kind: "array" | "object" | "value";
	/** The field's name, which is its path as JSON — also its `name` attribute. */
	name: string;
	/** The path to the field. */
	path: Path;
	/** The schema of the field. */
	schema: Schema;
	/**
	 * Whether the schema is wrapped in something that accepts a missing value.
	 * A missing input is then kept as the nullish value rather than replaced by
	 * an empty one, which is what keeps a reset consistent with where the field
	 * started.
	 */
	isNullish: boolean;
	/**
	 * What a missing value becomes. `null` under a `nullable` wrapper, which
	 * accepts `null` but not `undefined`; `undefined` everywhere else.
	 */
	nullishValue: null | undefined;
	/**
	 * Whether the field is wrapped in an exact optional, which wants its key
	 * absent rather than present and `undefined`.
	 */
	isExactOptional: boolean;
	/**
	 * The elements the field started with. Array methods move the `elements`
	 * reference between field stores, and `reset` puts each field back on its
	 * own element with this — without it, focusing and clearing a file input
	 * would reach the wrong element after a reorder followed by a reset.
	 */
	initialElements: FieldElement[];
	/** The elements currently bound to the field. */
	elements: FieldElement[];
	/** The errors of the field. */
	errors: Signal<FieldErrors | null>;
	/** Whether the field has been focused or written to. */
	isTouched: Signal<boolean>;
	/**
	 * Whether the field's value has been changed. Unlike `isTouched` a focus
	 * alone does not set it, and unlike `isDirty` it stays set even when the
	 * value is changed back — only a reset clears it.
	 */
	isEdited: Signal<boolean>;
	/** Whether the field differs from what it started at. */
	isDirty: Signal<boolean>;
}

export interface InternalArrayStore extends InternalBaseStore {
	kind: "array";
	/** The item stores of the array, by index. */
	children: InternalFieldStore[];
	/** What a reset goes back to. It does not move when the field moves. */
	initialInput: Signal<true | null | undefined>;
	/** The baseline the dirty state is measured against. It moves with the field. */
	startInput: Signal<true | null | undefined>;
	/** Whether the array is `null`, `undefined`, or present in the children. */
	input: Signal<true | null | undefined>;
	/** The item ids a reset goes back to. */
	initialItems: Signal<string[]>;
	/** The item ids the dirty state is measured against. */
	startItems: Signal<string[]>;
	/** One id per item, in order. */
	items: Signal<string[]>;
}

export interface InternalObjectStore extends InternalBaseStore {
	kind: "object";
	/** The field stores of the object's properties, by key. */
	children: Record<string, InternalFieldStore>;
	initialInput: Signal<true | null | undefined>;
	startInput: Signal<true | null | undefined>;
	/** Whether the object is `null`, `undefined`, or present in the children. */
	input: Signal<true | null | undefined>;
}

export interface InternalValueStore extends InternalBaseStore {
	kind: "value";
	initialInput: Signal<unknown>;
	startInput: Signal<unknown>;
	input: Signal<unknown>;
}

export type InternalFieldStore = InternalArrayStore | InternalObjectStore | InternalValueStore;

/**
 * The state behind a form: the root of the field store tree, plus what belongs
 * to the form as a whole.
 */
export interface InternalFormStore<
	TSchema extends FormSchema = FormSchema,
> extends InternalObjectStore {
	/** The `<form>` element, once a `Form` component has mounted one. */
	element: Ref<HTMLFormElement>;
	/**
	 * Bumped after every change to the tree. A readable over a field and its
	 * descendants — `isDirty`, the input of an object — cannot list the signals
	 * it reads, because array items come and go; it derives from this instead.
	 */
	revision: Signal<number>;
	/** Orders validations so a slow one cannot overwrite a newer one's result. */
	validationId: number;
	/** Where a required field of a given type starts, defaults already merged in. */
	emptyInput: EmptyInput;
	validate: ValidationMode;
	revalidate: RevalidationMode;
	/** Runs the schema over the form input. */
	parse: (input: unknown) => Promise<v.SafeParseResult<TSchema>>;
	isSubmitting: Signal<boolean>;
	isSubmitted: Signal<boolean>;
	isValidating: Signal<boolean>;
}

/**
 * A form store, as far as the methods are concerned: the handle the internal
 * store hangs off. `FormStore` adds the readables on top.
 */
export interface BaseFormStore<TSchema extends FormSchema = FormSchema> {
	/** @internal */
	readonly [INTERNAL]: InternalFormStore<TSchema>;
}

/**
 * The props a field element needs to take part in the form. Spread them onto
 * an `Input`, `Select` or `Textarea` and add the value binding the element
 * calls for (`value` for text, `checked` for a checkbox).
 */
export interface FieldElementProps {
	/** Identifies the element as this field's, in the store and for grouped inputs. */
	readonly name: Readable<string>;
	/** Whether the field should take the focus, set while it has errors. */
	readonly autofocus: Readable<boolean>;
	/** Registers the element with the field. Written by spreading these props. */
	readonly this: Ref<HTMLElement>;
	readonly onFocus: () => void;
	readonly onInput: (event: { readonly currentTarget: FieldElement }) => void;
	readonly onChange: () => void;
	readonly onBlur: () => void;
}
