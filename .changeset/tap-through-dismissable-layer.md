---
"@implementjs/primitives": patch
---

Dismiss a layer on the click that ends an outside tap, so the tap does not fall through to the page behind it

A tap outside a modal dismissed it on `pointerdown`, while the finger was still down. The click the browser dispatches on release then landed on whatever was under the tap — on a phone, straight onto the element the scrim had been covering. A mouse hid the bug, because its click goes to the common ancestor of `mousedown` and `mouseup`.

The scrim could not defend the gap either. Recipes hide it with `transition-discrete` and `data-[state=closed]:hidden`, and a browser keeps _painting_ an element whose `display` is transitioning to `none` while it has already stopped _hit-testing_ it, from the first frame of the transition — so at press+0ms the point under the finger already resolves to the element beneath the scrim.

`DismissableLayer` now defers a touch or pen press: instead of dispatching the interact-outside event from `pointerdown`, it registers a one-shot document `click` listener and dispatches from there, so the dismissal and the click are the same event and the click lands on the layer that is still up. A mouse press still dismisses on the press itself, and a press that never becomes a click — a scroll, a drag off the target — is dropped rather than left to fire on the next unrelated one.

This covers every layer built on `DismissableLayer`: `Dialog`, `AlertDialog`, `Drawer`, and the menus, popovers and selects above them.
