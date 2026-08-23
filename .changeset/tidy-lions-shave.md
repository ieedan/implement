---
"@implementjs/ui": patch
---

Add `responsive-dialog`: one modal that is a centered dialog where there is room
for one and a drawer where a thumb is what is reaching for it. Both shapes share
an `open` signal, so crossing the breakpoint does not lose it.

`sidebar`'s off-canvas mobile panel is now a `drawer` rather than a `sheet`, so it
can be swiped shut, and its breakpoint is `mediaQuery` instead of a hand-rolled
`matchMedia` listener. `drawer`'s grab bar now sits on the edge the panel drags
out of, rather than the edge it is anchored to.
