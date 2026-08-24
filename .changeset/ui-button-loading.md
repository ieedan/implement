---
"@implementjs/ui": patch
---

The registry's `Button` takes a `loading` prop and an `onClickPromise` handler.

`loading` renders the [spinner](https://implementjs.dev/ui/spinner) inside the
button and stops it accepting clicks. It takes a signal, so the state can live
wherever the work does:

```ts
const saving = signal(false);

Button({ loading: saving }, "Save");
```

Most loading states last exactly as long as one async click, though, and
`onClickPromise` is that case written once — the button loads until the promise
the handler returns settles:

```ts
Button({ onClickPromise: () => save(draft) }, "Save");
```

The promise is not swallowed: a rejection reaches your own `catch`, or the
console, exactly as it would have without the button in the way. A handler
returning something other than a promise never enters the loading state, and
`onClick` still runs first when both are passed.

A loading button is disabled, and carries `data-loading` and `aria-busy`. An
icon size has no room beside its icon, so there the spinner takes the icon's
place; every other size keeps its label and puts the spinner before it. `Button`
now imports `spinner.ts`, which the CLI adds alongside it.
