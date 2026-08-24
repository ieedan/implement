---
"@implementjs/primitives": patch
---

Opening a select now highlights the item that is already selected instead of
whichever item comes first, and scrolls it into view. A select rendered with a
value showed nothing marking that value in the list, and the arrow keys started
from the top rather than from the current selection. Nothing selected — or a
selection that is disabled — still lands on the first item, and moving the
pointer over an item highlights it without scrolling.
