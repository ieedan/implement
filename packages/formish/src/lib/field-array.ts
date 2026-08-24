import { derived, isReadable, signal, type Readable } from "@implementjs/core";
import { fieldReadable, toPathReadable } from "./field";
import { INTERNAL } from "./internal";
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
import { getFieldBool, pathName } from "./store";
import type { FormStore } from "./form";
import type {
	ArrayPath,
	FieldErrors,
	FormSchema,
	InferInput,
	InternalFormStore,
	MaybeReadable,
	Path,
} from "./types";

export interface UseFieldArrayConfig<
	TSchema extends FormSchema,
	TPath extends ArrayPath<InferInput<TSchema>>,
> {
	/** Where the array lives, e.g. `["todos"]`. */
	readonly path: MaybeReadable<TPath>;
}

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
	const path = toPathReadable(config.path);
	const errors = fieldReadable(store, path, (field) => field?.errors.get() ?? null);

	/** The methods take the path the store points at right now. */
	const at = <TConfig>(itemConfig: TConfig): TConfig & { path: Path } => ({
		...itemConfig,
		path: path.get(),
	});

	return {
		path,
		name: derived([path], (current) => pathName(current)),
		items: fieldReadable(store, path, (field) =>
			field?.kind === "array" ? field.items.get() : [],
		),
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
		itemPath: (index, ...rest) =>
			derived(
				[path, isReadable<number>(index) ? index : signal(index)],
				(current, item) => [...current, item, ...rest] as never,
			),
		insert: (itemConfig = {}) => insert(form, at(itemConfig) as never),
		remove: (itemConfig) => remove(form, at(itemConfig) as never),
		move: (itemConfig) => move(form, at(itemConfig) as never),
		swap: (itemConfig) => swap(form, at(itemConfig) as never),
		replace: (itemConfig) => replace(form, at(itemConfig) as never),
	};
}
