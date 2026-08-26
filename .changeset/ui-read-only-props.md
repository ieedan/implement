---
"@implementjs/ui": patch
---

Read-only props on the styled components take any readable, the way the
primitives under them now do.

`@implementjs/primitives@0.0.11` widened every prop it only ever reads from
`Signal<T> | T` to `Readable<T> | T`, so a `derived` or a `.bind()` off loaded
data is assignable where before only a signal you owned was. Nearly every
component here takes its props straight off the primitive through
`ComponentProps<typeof …>` and picked that up on its own — but two places did
not, because they were written by hand.

`Meter` and `Progress` wrapped `value`, `min`, and `max` in `signal()` before
reading them. That passes a writable through but buries anything else _inside_
a signal rather than letting it be the signal, so a bound value was read once
and then never updated again. They now keep whatever readable came in and only
reach for `signal()` when handed a plain number.

`SidebarMenuButton` declared `disabled` as `Signal<boolean> | boolean`, since
with `tooltip` set the row is the tooltip trigger and that primitive used to
ask for a signal. It no longer does, so the row does not either — a menu item
disabled by the workspace setting the page loaded is now something you can
write:

```ts
const canInvite = derived([workspace], (value) => value.role === "admin");

SidebarMenuButton(
	{ disabled: canInvite.bind((allowed) => !allowed), tooltip: "Members" },
	"Members",
);
```

Nothing renders differently, and no prop that was accepted before is turned
away — the types only got wider. Two-way props (`open`, `checked`, `pressed`,
and `value` where the component writes back) still ask for a `Signal`, since a
derived value has nowhere to write to.
