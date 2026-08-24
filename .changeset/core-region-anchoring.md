---
"@implementjs/core": patch
---

Mount a branch's children inside the region its end marker bounds, so a child
that owns more than one node is torn down with the branch.

`If` appended its branch children to the parent and then moved each child's
first DOM node back in front of its end marker. A child standing on a single
node came out right; a `ForEach` did not. Its rows went in as siblings of
whatever else the parent held, and only the first of them was pulled inside the
branch — the rest stayed past the marker, where the next swap neither moved nor
removed them. Toggling a menu left its dots sitting beside the other branch's
content, looking like both branches were mounted at once. Worse, the marker now
stood between the `ForEach`'s first row and its own marker, so clearing the list
took the branch's marker with it in the range deletion and the next swap threw.

Branch children are now mounted against the end marker, the way `ForEach`
already mounts its rows, so every node they own lands inside the region and
leaves with it. The same fix applies to `Switch`, `Key`, `Dynamic`, `Await`,
`ImplementBoundary`, `Portal` and `Outlet`, which all swap children the same
way, and `Html` now attaches its delimiters through the same path so a block
inside one of them is not split from its markup.
