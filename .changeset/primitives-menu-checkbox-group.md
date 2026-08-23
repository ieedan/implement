---
"@implementjs/primitives": patch
---

Add `DropdownMenuCheckboxGroup`, `ContextMenuCheckboxGroup`, and
`MenubarCheckboxGroup`, which hold a set of checkbox items as one array of
values instead of a boolean each.

A menu that toggles several related things — which panels are visible, which
columns a table shows — held one signal per item, and the set of what was
checked had to be assembled from them. The group owns the array, and each
item inside it is named by a new `value` prop:

```ts
const visible = signal(["status-bar", "activity-bar"]);

DropdownMenuCheckboxGroup(
	{ value: visible },
	DropdownMenuGroupHeading("Panels"),
	DropdownMenuCheckboxItem({ value: "status-bar", closeOnSelect: false }, "Status bar"),
	DropdownMenuCheckboxItem({ value: "activity-bar", closeOnSelect: false }, "Activity bar"),
);
```

Selecting an item adds or removes its value, and the group's array is what is
checked — inside a group the item's own `checked` prop no longer applies. A
checkbox item outside a group, or one without a `value`, keeps its own boolean
and behaves exactly as before. The group is a `role="group"` like
`DropdownMenuGroup`, so a `GroupHeading` inside names it, and it sets
`data-dropdown-menu-checkbox-group` (`data-context-menu-…`,
`data-menubar-…`).
