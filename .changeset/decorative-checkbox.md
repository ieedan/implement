---
"@implementjs/primitives": patch
---

Add `decorative` to `Checkbox`, for drawing the box inside something that is
already the control.

It renders a `Span` rather than a `Button`, drops `role`, `aria-checked`, and
`aria-required`, and sets `aria-hidden`, so nothing tabs to it and assistive
tech reads the control around it. `data-state` and the click toggle stay, so a
decorative box looks and behaves like every other one. Submitting stays with
the real control: `name` renders no hidden input, and `disabled` is not
forwarded.

The case is a menu row. A `menuitemcheckbox` already carries a checked state,
so a checkbox nested in one gave the row two of them — which is why the labels
menu in the docs redrew the box by hand instead of using the component. It now
uses the component, and the state comes from a two-way bind onto the checkbox
group's array rather than a second copy.
