---
"@implementjs/core": patch
---

Fix a swapped branch landing at the end of its container instead of where it was
declared. `If`, `Switch`, `Dynamic`, `Key`, `Await`, `ImplementBoundary`, and
`Outlet` mounted a new branch by appending it and then moving the first DOM node
of each child back into place — so a child that contributes more than one
top-level node (an anchor comment and an element, say) left the rest behind. They
now mount against their end marker on a re-mount, the way `ForEach` already did.
