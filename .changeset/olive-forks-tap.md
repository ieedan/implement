---
"@implementjs/ui": patch
---

`command`'s input is 16px below the `md` breakpoint, the way `input` and
`textarea` already were. Safari on iOS zooms the page in on a focused field with
smaller text than that, and a command palette is a field you focus on purpose.
