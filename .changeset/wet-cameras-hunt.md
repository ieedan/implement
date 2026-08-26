---
"@implementjs/core": patch
---

Bind element `on*Capture` props to the capture phase.

`ImplementDocument` and `ImplementWindow` have always understood a trailing
`Capture` on an event prop, stripping it and passing `{ capture: true }` to
`addEventListener`. Elements carried their own copy of that resolver which never
got the same treatment: it only dropped the `on` prefix and lower-cased the
rest, so `onKeydownCapture` on a `Div` listened for a `keydowncapture` event
that no browser ever fires. Nothing surfaced the mistake — the listener attached
and simply never ran.

Elements and SVG roots now resolve event props through the same code the global
targets do, so `onClickCapture`, `onKeydownCapture` and the rest listen in the
capture phase and detach with the flag they were attached with. Their prop types
gained the `Capture` flavor to match; it had only ever existed on the
`document` and `window` helpers, so the element form did not typecheck either.
