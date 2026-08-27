---
"@implementjs/kit": patch
---

Say `LayoutLoadEvent` when a `layout.server.ts` is still typed with `LoadEvent`.

A route's `$types` used to export one load event, and it was right everywhere.
It exports two now — so a page load can see its parent's data — and `LoadEvent`
is the page's: it carries what every load above the page returned, this
directory's own layout load included. A `layout.server.ts` annotated with it is
inside its own type, which `tsc` reports as

```
src/routes/app/layout.server.ts(13,36): error TS2502: '{ locals }' is referenced directly or indirectly in its own type annotation.
```

pointed at the destructured parameter, naming neither `LoadEvent` nor the
`LayoutLoadEvent` that fixes it. A load written before the split kept compiling
right up to the upgrade, and then failed with the one message that says nothing
about why.

Two things say it now:

- The dev server, the build, and `implement-kit sync` warn when a
  `layout.server.ts` imports `LoadEvent` from its `$types`, naming the file and
  the type it wants. The scan already knew the file was there; now it reads what
  it asked for.
- A route's generated `LoadEvent` carries a `@deprecated` tag naming
  `LayoutLoadEvent` where nothing in the directory could want it — a
  `layout.server.ts` and no `page.server.ts` beside it. The import is struck
  through in the editor, at the line the compiler never points at. A directory
  with a `page.server.ts` keeps its `LoadEvent` unmarked, because there it is
  exactly right.

Both load events are documented in `$types` either way, so which file takes
which is answerable from the hover.
