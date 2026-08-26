---
"@implementjs/primitives": patch
---

The focus trap skips what the page does not draw, and read-only props take any
readable.

`tabbable` matched a selector and nothing else, so a `display: none` file input
behind an attachment button, or a field inside a closed menu, counted as a Tab
stop. `trapFocus` then cancelled the keystroke _before_ asking that element to
take focus, and it never did — Tab did nothing at all, in a dialog whose whole
job is to hold focus. Candidates are now filtered by whether the layout draws
them (`getClientRects()`, which unlike `offsetParent` does not call a
`position: fixed` element hidden), with `inert` and `hidden` asked separately,
and the keystroke is only cancelled once focus has actually moved. A candidate
that still turns focus down leaves the browser's own Tab to run rather than
leaving the keyboard with nowhere to go.

Every prop the components only read — `disabled` across the menus, triggers,
items, groups and calendars, `readonly` on the calendars, `value`/`min`/`max`
on `Meter` and `Progress`, `ratio` on `AspectRatio` — now takes
`Readable<T> | T` instead of `Signal<T> | T`. `Signal` is the writable type, so
nothing out of `derived` or `.bind()` was assignable, and the error said so
badly: the narrowing knocked the call out of the props overload and TypeScript
reported the next one's complaint about an unrelated prop. Disabling a trigger
from loaded data — the workspace setting says this menu is not available — is
the case that could not be written, and now can. Two-way props (`open`,
`checked`, `pressed`, `value` where the component writes back) still ask for a
`Signal`, since a derived value has nowhere to write to.
