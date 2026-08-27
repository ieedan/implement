---
"@implementjs/core": patch
"@implementjs/primitives": patch
---

A `DropdownMenu` keeps working after its subtree is unmounted and mounted again.

Handing one set of children to an `If` whose branches wrap them in different
roots — a `ResponsiveDialog` picking a `Dialog` or a `Drawer` off a media query
is the shape this came from — unmounts those children and mounts them again.
Every `DropdownMenu` among them was dead afterwards: the trigger's click opened
the menu and the same click closed it again before it finished bubbling, and
that instance never recovered.

The menu registers its content with the root state on every mount, and a
signal only notifies when its value changes. Change detection compared the two
registrations field by field, and at the moment of the swap they matched: same
options, same handlers, and two `ref()`s that were both empty — the one the
unmount had just cleared, and the one the new node had not attached to yet. So
the replacement was read as "no change" and dropped, leaving the root pointed
at the discarded instance and its ref empty for good. With no content element
to compare against, the dismissable layer counted every interaction as one
outside the menu, including the focus move into the menu's own content.

Change detection in `@implementjs/core` now compares anything holding state of
its own — a readable, a collection, a promise — by identity wherever it sits in
the value, not only when it _is_ the value. Values still compare structurally:
setting a signal to an equal object, or to a `Date` for the same instant, stays
a no-op.

Two dismissable-layer registrations that a remount could strand are fixed
alongside it. A layer unmounted while open now withdraws itself from the layer
above, which previously went on forwarding Escape to a layer that was gone and
so stopped closing itself; and a layer built around an already-open signal
registers where it stands, so a subtree swapped with its menu open still
dismisses the menu first.
