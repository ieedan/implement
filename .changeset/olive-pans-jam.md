---
"@implementjs/primitives": patch
---

Scroll locking now actually holds the page still on iOS. `overflow: hidden` on
the body does nothing there, and the touch fallback meant to cover it only
cancelled a move whose target was the document element — which is never what is
under a finger on page content, so every modal's backdrop scrolled the page
behind it. A move is now cancelled unless something between the finger and the
body still has room to scroll, so a list inside the modal keeps scrolling and
stops at its own edge instead of chaining to the page.

It no longer sniffs for iOS to decide whether to bother: the `navigator.platform`
test that did is deprecated and already lies about the iPad, and on a device
where `overflow: hidden` was enough there is nothing left for the listener to
cancel.
