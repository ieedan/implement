---
title: Field arrays
description: Lists of fields that can be added to, reordered and removed from.
section: Guides
order: 30
---

An array in the schema is a field array: a list whose items are fields in their own right.

<div data-demo="field-array" data-demo-description="A shopping list of text inputs. Each row can be moved up or removed, an Add item button appends an empty row, and Save prints the list. Emptying a row shows its error, and moving that row carries the error with it."></div>

```ts
const ShoppingListSchema = v.object({
	items: v.array(
		v.object({ label: v.pipe(v.string(), v.minLength(1, "Every item needs a name")) }),
	),
});

const items = useFieldArray(form, { path: ["items"] });
```

`useFieldArray` accepts only paths that lead to an array, so `path: ["items"]` autocompletes and `path: ["email"]` does not compile.

## Rendering the rows

`items.items` is a readable list of ids — one per item, in order. Render by id with [`ForEach`](/docs/foreach) so a row keeps its DOM node when the list changes:

```ts
ForEach(
	items.items,
	(id) => id,
	(_id, index) =>
		Field({ of: form, path: items.itemPath(index, "label") }, (field) =>
			Input({ ...field.props, value: field.input }),
		),
);
```

`itemPath(index, ...rest)` builds the path of a field inside the item at `index` — `["items", 2, "label"]` — and because `index` is a readable, so is the path. That is the point: when a row moves, its path follows it, and the same input goes on editing the same item.

The ids are the reason rows survive reordering. They stay with their item across inserts, moves and removals, so `ForEach` moves the existing node rather than rebuilding it — the caret stays where it was.

## Adding, removing, reordering

The array store carries the methods, each of which also exists as a standalone function taking a `path`:

```ts
items.insert({ initialInput: { label: "" } }); // append
items.insert({ at: 0, initialInput: { label: "" } }); // insert
items.remove({ at: 2 });
items.move({ from: 3, to: 0 });
items.swap({ at: 0, and: 1 });
items.replace({ at: 1, initialInput: { label: "Tea" } });
```

```ts
import { insert, remove } from "@implementjs/formish";

insert(form, { path: ["items"], initialInput: { label: "" } });
remove(form, { path: ["items"], at: 2 });
```

Each of them moves the items' state along with the items: a row's errors, its touched and edited state, and the ids of any array nested inside it. Remove the second of three rows and the third row's error is still the third row's error, now on the second.

## The list itself

The array field has state of its own, rolled up from its items:

```ts
items.errors; // errors reported about the list, e.g. a minLength around the array
items.isDirty; // an item was added, removed, moved, or one of them changed
items.isTouched;
items.isValid; // nothing in the list has errors
```

A `v.minLength(1, "Add at least one item")` around the array reports on the list, so render `items.error` next to the list rather than inside a row.

An array field with no items yet validates as an empty list, not as a missing one — so an empty list is what your schema sees, and a `minLength` on it is what reports the problem.

## The FieldArray component

`FieldArray` is `useFieldArray` with the markup kept alongside it, the same way `Field` is:

```ts
FieldArray({ of: form, path: ["items"] }, (items) =>
	Div(
		ForEach(
			items.items,
			(id) => id,
			(_id, index) =>
				Field({ of: form, path: items.itemPath(index, "label") }, (field) =>
					Input({ ...field.props, value: field.input }),
				),
		),
		Button({ onClick: () => items.insert({ initialInput: { label: "" } }) }, "Add"),
	),
);
```

## Nested arrays

Arrays nest as deep as the schema does. Address the inner one through the outer one's item path:

```ts
const tags = useFieldArray(form, { path: items.itemPath(index, "tags") });
```

Or, when the index is known, spell it out: `path: ["items", 0, "tags"]`.
