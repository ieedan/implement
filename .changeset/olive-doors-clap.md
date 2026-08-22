---
"@implementjs/core": patch
---

Clear a list with one range deletion instead of one removal per row. `ForEach` emptying ten thousand rows made ten thousand `removeChild` calls; the rows are contiguous, so one range deletion takes them all. Partial removals are unaffected.
