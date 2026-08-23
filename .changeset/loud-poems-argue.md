---
"@implementjs/primitives": patch
---

`Drawer`'s `dismissible: false` now stops every close the drawer owns — Escape,
the scrim, and `DrawerClose`, not just the drag — matching what it documents. A
drawer nested inside one that closes still goes with it, so a panel cannot be
left on the page with nothing above it.
