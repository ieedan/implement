---
"@implementjs/core": patch
---

Add `Dynamic`, a control-flow node that mounts whatever child a readable holds
and swaps it when the value changes.

`If` tests conditions and `Switch` matches values against branches written out
ahead of time, so a node that comes _out_ of a signal had nowhere to go: a
readable child is the text-node shape, and passing one where a node was meant
rendered the function's source. Swapping what renders meant an `Outlet` driven
from a subscription, or a `Key` around a thunk that re-read the signal itself.

```ts
const icon = derived([priority], (p) => PRIORITIES[p].icon());
SelectTrigger(Dynamic(icon));

// or without the intermediate readable
SelectTrigger(Dynamic([priority], (p) => PRIORITIES[p].icon()));
```

The value is compared by identity, so a getter that builds a fresh node per
call swaps on every change of its sources and one that returns a node it
already holds leaves what is mounted alone; remounting the same value is still
`Key`'s job. `null` and `undefined` render nothing, so a
`Readable<Mountable | null>` needs no `If` around its empty case. Children
mount at the node's position in the tree, so context resolves through it,
errors reach the nearest boundary, and server rendering and hydration go
through the same path as any other child.

`Child` is unchanged: a bare `Div(currentView)` is still text, and `Dynamic` is
how you say you meant the node.
