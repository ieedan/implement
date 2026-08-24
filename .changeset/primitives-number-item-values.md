---
"@implementjs/primitives": patch
---

Accept a number as well as a string for the `value` of a select item, a menu
checkbox item, and a menu radio item.

Ids are often numbers, and the only way to bind one was to stringify it going
in and parse it coming back out. Both `value` props — the item's and the root's
— now take `string | number`, exported as `ItemValue`:

```ts
const size = signal<number | null>(14);

DropdownMenuRadioGroup(
	{ value: size },
	DropdownMenuRadioItem({ value: 12 }, "12px"),
	DropdownMenuRadioItem({ value: 14 }, "14px"),
);
```

A number stays a number: `size.get()` is `14`, not `"14"`, including when the
keyboard is what selected the item and the value made the round trip through
the DOM. `Select` carries them the same way, in single and multiple alike, and
`SelectValue` falls back to printing the number when nothing labels the item.

The DOM only speaks strings, so `data-value` is unchanged — the number written
out. Values are matched by identity, so `1` and `"1"` are two different items;
pick one shape per select or group. Existing string values, and the signals
already bound to them, are untouched.
