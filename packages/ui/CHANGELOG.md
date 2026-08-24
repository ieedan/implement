# @implementjs/ui

## 0.0.2

### Patch Changes

- [#56](https://github.com/ieedan/implement/pull/56) [`c5b81c9`](https://github.com/ieedan/implement/commit/c5b81c9b5ddb0569b3517924d3ff2694c7170a56) Thanks [@ieedan](https://github.com/ieedan)! - The registry's `Button` takes a `loading` prop and an `onClickPromise` handler.

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

## 0.0.1

### Patch Changes

- [#36](https://github.com/ieedan/implement/pull/36) [`534eafe`](https://github.com/ieedan/implement/commit/534eafe77a841d3bb42d3056fccd314ab8347fc9) Thanks [@ieedan](https://github.com/ieedan)! - The registry is published to [jsrepo.com](https://www.jsrepo.com), so `jsrepo add @implementjs/ui/button` resolves for a project that has never seen this repository. The manifest carries its version and a `bugs` link, `access` is stated rather than defaulted, and `apps/docs/README.md` goes up with it as the registry's page.
