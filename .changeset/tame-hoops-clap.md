---
"@implementjs/primitives": patch
---

`Drawer` no longer reflows its panel while the keyboard is handed between two
fields. Moving focus from one field to the next starts the keyboard dismissing
and then brings it straight back, and `--ip-drawer-keyboard-inset` tracked that
dip frame by frame — so the spacer shrank, the panel shrank, and every field in
it slid down and back. A growing keyboard is still published at once, since
until the panel makes room the keyboard is on top of it; a shrinking one has to
stay shrunk for 250ms before the panel believes it.
