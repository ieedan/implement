import { derived, isReadable, signal, type Readable } from "@implementjs/core";
import { INTERNAL, type FormStore } from "./form";
import {
	insert,
	move,
	remove,
	replace,
	swap,
	type InsertConfig,
	type MoveConfig,
	type RemoveConfig,
	type ReplaceConfig,
	type SwapConfig,
} from "./methods";
import { getAtPath, isDirtyInput, pathName, type Path } from "./path";
import {
	errorsAt,
	hasErrorsUnder,
	hasFlag,
	itemsSignal,
	markArrayField,
	type InternalFormStore,
} from "./store";
import type { InferInput } from "./standard-schema";
import type { ArrayPath, FieldErrors, FormSchema, ItemValue, PathValue } from "./types";

export interface UseFieldArrayConfig<
	TSchema extends FormSchema,
	TPath extends ArrayPath<InferInput<TSchema>>,
> {
	/** Where the array lives, e.g. `["todos"]`. */
	readonly path: TPath | Readable<TPath>;
}

/** The item type of the array a path addresses. */
type ItemOf<TSchema extends FormSchema, TPath extends Path> = ItemValue<
	PathValue<InferInput<TSchema>, TPath>
>;

type ItemMethodConfig<TConfig> = Omit<TConfig, "path">;

export interface FieldArrayStore<
	TSchema extends FormSchema = FormSchema,
	TPath extends ArrayPath<InferInput<TSchema>> = ArrayPath<InferInput<TSchema>>,
> {
	readonly path: Readable<Path>;
	readonly name: Readable<string>;
	/**
	 * One id per item, in order. The ids stay with their item across inserts,
	 * moves and removals, which is what makes them the key to render rows by.
	 */
	readonly items: Readable<string[]>;
	readonly errors: Readable<FieldErrors | null>;
	readonly error: Readable<string | null>;
	readonly isTouched: Readable<boolean>;
	readonly isEdited: Readable<boolean>;
	readonly isDirty: Readable<boolean>;
	readonly isValid: Readable<boolean>;
	/**
	 * The path of a field inside the item at `index`. Pass the index readable a
	 * `ForEach` row hands you and the path follows the item as the list changes.
	 *
	 * ```ts
	 * ForEach(todos.items, (id) => id.get(), (_, index) =>
	 * 	Field({ of: form, path: todos.itemPath(index, "label") }, (field) => …),
	 * )
	 * ```
	 */
	readonly itemPath: <const TRest extends Path = readonly []>(
		index: number | Readable<number>,
		...rest: TRest
	) => Readable<readonly [...TPath, number, ...TRest]>;
	readonly insert: (config?: ItemMethodConfig<InsertConfig<TSchema, TPath>>) => void;
	readonly remove: (config: ItemMethodConfig<RemoveConfig<TPath>>) => void;
	readonly move: (config: ItemMethodConfig<MoveConfig<TPath>>) => void;
	readonly swap: (config: ItemMethodConfig<SwapConfig<TPath>>) => void;
	readonly replace: (config: ItemMethodConfig<ReplaceConfig<TSchema, TPath>>) => void;
}

/**
 * Connects an array field to whatever renders it: its item ids, its state, and
 * the methods that add, remove and reorder items.
 *
 * ```ts
 * const todos = useFieldArray(form, { path: ["todos"] });
 * Button({ onClick: () => todos.insert({ initialInput: { label: "" } }) }, "Add");
 * ```
 */
export function useFieldArray<
	TSchema extends FormSchema,
	const TPath extends ArrayPath<InferInput<TSchema>>,
>(
	form: FormStore<TSchema>,
	config: UseFieldArrayConfig<TSchema, TPath>,
): FieldArrayStore<TSchema, TPath> {
	const store: InternalFormStore = form[INTERNAL];
	const path = (
		isReadable<Path>(config.path) ? config.path : signal(config.path as Path)
	) as Readable<Path>;
	markArrayField(store, path.get());

	const errors = derived([store.errors, path], (map, value) => errorsAt(map, value));

	// `bind` follows the readable the selector returns, so the items of the
	// array the path currently points at are what this reports
	const items = path.bind((value) => itemsSignal(store, value));

	/** The methods take the path the store points at right now. */
	const at = <TConfig>(itemConfig: TConfig): TConfig & { path: Path } => ({
		...itemConfig,
		path: path.get(),
	});

	return {
		path,
		name: derived([path], (value) => pathName(value)),
		items,
		errors,
		error: derived([errors], (value) => value?.[0] ?? null),
		isTouched: derived([store.touched, path], (touched, value) => hasFlag(touched, value)),
		isEdited: derived([store.edited, path], (edited, value) => hasFlag(edited, value)),
		isDirty: derived([store.input, store.startInput, path], (input, start, value) =>
			isDirtyInput(getAtPath(start, value), getAtPath(input, value)),
		),
		isValid: derived([store.errors, path], (map, value) => !hasErrorsUnder(map, value)),
		itemPath: (index, ...rest) =>
			derived(
				[path, isReadable<number>(index) ? index : signal(index)],
				(value, current) => [...value, current, ...rest] as never,
			),
		insert: (itemConfig = {}) => insert(form, at(itemConfig) as never),
		remove: (itemConfig) => remove(form, at(itemConfig) as never),
		move: (itemConfig) => move(form, at(itemConfig) as never),
		swap: (itemConfig) => swap(form, at(itemConfig) as never),
		replace: (itemConfig) => replace(form, at(itemConfig) as never),
	} as FieldArrayStore<TSchema, TPath>;
}

export type { ItemOf };
