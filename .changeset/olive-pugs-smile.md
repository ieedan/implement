---
"@implementjs/ui": patch
---

Add `drawer`, the styled `Drawer`. Reads `direction` off the root, so the panel,
its handle, and the scrim only have to be told which edge to live on once, and
fills its axis when the root is given snap points.
