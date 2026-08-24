# @implementjs/ui

## 0.0.3

### Patch Changes

- [#53](https://github.com/ieedan/implement/pull/53) [`a8ff85d`](https://github.com/ieedan/implement/commit/a8ff85d2dfa297ce0f567c67d738b8c7d15c523d) Thanks [@ieedan](https://github.com/ieedan)! - Add `drawer`, the styled `Drawer`. Reads `direction` off the root, so the panel,
  its handle, and the scrim only have to be told which edge to live on once, and
  fills its axis when the root is given snap points.

- [#53](https://github.com/ieedan/implement/pull/53) [`00239de`](https://github.com/ieedan/implement/commit/00239de0e84fe27b2f8737e977d973b4d24c454e) Thanks [@ieedan](https://github.com/ieedan)! - Add `responsive-dialog`: one modal that is a centered dialog where there is room
  for one and a drawer where a thumb is what is reaching for it. Both shapes share
  an `open` signal, so crossing the breakpoint does not lose it.

  `sidebar`'s off-canvas mobile panel is now a `drawer` rather than a `sheet`, so it
  can be swiped shut, and its breakpoint is `mediaQuery` instead of a hand-rolled
  `matchMedia` listener. `drawer`'s grab bar now sits on the edge the panel drags
  out of, rather than the edge it is anchored to, and a `drawer` with a field in it
  opens above the on-screen keyboard instead of under it.

  `command`'s input is 16px below the `md` breakpoint, the way `input` and
  `textarea` already were. Safari on iOS zooms the page in on a focused field with
  smaller text than that, and a command palette is a field you focus on purpose.

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
