---
"@implementjs/core": patch
---

Read a bind path as `undefined` when a value along the way is missing, instead
of throwing.

`getAtPath` treated a `null` or `undefined` link as a programming error and
threw `Cannot read "title" from undefined`. A binding is a live view, though,
and what it reads through is routinely absent for a while. A page that does
`const issue = data.bind("issue")` and then `issue.bind("title")` crashes on
mount, because the route's data store starts at `{}` and the load has not
landed yet. The same happens on any optional field, and there is no way to
write around it: the bind has to be created before the value exists, and the
crash comes from the read itself.

Reads now stop at the gap the way optional chaining does, so a chained bind
holds `undefined` until its source arrives and then updates in place. This also
matches what the types already say, since path types walk through `NonNullable`
links. Writing through a missing parent still throws, because there is no
parent object to update.
