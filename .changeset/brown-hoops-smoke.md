---
"@implementjs/primitives": patch
---

`Drawer` measures the on-screen keyboard and publishes it as
`--ip-drawer-keyboard-inset` on the panel. A fixed panel is placed against the
layout viewport, which a keyboard does not shrink, so the keyboard covers the
bottom of the panel. Spend the variable on space at the end of the panel and
its content lays out in the room that is left — leaving the panel itself where
it was, so the browser never scrolls the page to chase the focused field.
