---
"@implementjs/primitives": patch
---

`Drawer` measures the on-screen keyboard and publishes it as
`--ip-drawer-keyboard-inset` on the panel. A fixed panel is placed against the
layout viewport, which a keyboard does not shrink, so a bottom drawer holding a
field opened underneath it and the browser scrolled the page to chase the focus.
Spend the variable on `bottom` and `max-height` and the panel opens above the
keyboard, where it never has to be scrolled at all.
