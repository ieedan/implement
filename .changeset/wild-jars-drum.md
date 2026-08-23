---
"@implementjs/primitives": patch
---

Add `Drawer`, a port of [Vaul](https://vaul.emilkowal.ski): a panel that slides in
from any of the four edges and can be dragged back out. It is built on the same
modal base as `Dialog`, so it keeps the focus trap, Escape, outside dismissal,
scroll lock, and nesting, and adds the gesture on top — snap points with an
overlay that fades between them, a velocity-aware release, a rubber band past the
open position, and a scroll guard so a panel with a list in it scrolls before it
drags.

`dismissible: false` stops every close the drawer owns, the drag included, which
the shared modal base now understands: a modal may refuse to be dismissed, and one
nested inside a modal that is closing still goes with it.
