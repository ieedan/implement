# @implementjs/primitives

## 0.0.7

### Patch Changes

- [#53](https://github.com/ieedan/implement/pull/53) [`fc01a0d`](https://github.com/ieedan/implement/commit/fc01a0df10cffb240648a7f4c0429ff84707d54b) Thanks [@ieedan](https://github.com/ieedan)! - `Drawer` measures the on-screen keyboard and publishes it as
  `--ip-drawer-keyboard-inset` on the panel. A fixed panel is placed against the
  layout viewport, which a keyboard does not shrink, so the keyboard covers the
  bottom of the panel. Spend the variable on space at the end of the panel and
  its content lays out in the room that is left — leaving the panel itself where
  it was, so the browser never scrolls the page to chase the focused field.

- [#53](https://github.com/ieedan/implement/pull/53) [`86a4025`](https://github.com/ieedan/implement/commit/86a4025d51aabad2d36f2656c22edc5d3df5f3c9) Thanks [@ieedan](https://github.com/ieedan)! - Scroll locking now actually holds the page still on iOS. `overflow: hidden` on
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

- [#58](https://github.com/ieedan/implement/pull/58) [`1d40de9`](https://github.com/ieedan/implement/commit/1d40de9a3057c7656a5e994f955455f4035a1483) Thanks [@ieedan](https://github.com/ieedan)! - feat: add `on*Change` callbacks for every bound value across the primitives

- [#60](https://github.com/ieedan/implement/pull/60) [`8a7ebd0`](https://github.com/ieedan/implement/commit/8a7ebd031148850dc339c7f7009bfa2825c5b941) Thanks [@ieedan](https://github.com/ieedan)! - Accept a number as well as a string for the `value` of a select item, a menu
  checkbox item, and a menu radio item.

  Ids are often numbers, and the only way to bind one was to stringify it going
  in and parse it coming back out. Both `value` props — the item's and the root's
  — now take `string | number`, exported as `ItemValue`:

  ```ts
  const size = signal<number | null>(14);

  DropdownMenuRadioGroup(
  	{ value: size },
  	DropdownMenuRadioItem({ value: 12 }, "12px"),
  	DropdownMenuRadioItem({ value: 14 }, "14px"),
  );
  ```

  A number stays a number: `size.get()` is `14`, not `"14"`, including when the
  keyboard is what selected the item and the value made the round trip through
  the DOM. `Select` carries them the same way, in single and multiple alike, and
  `SelectValue` falls back to printing the number when nothing labels the item.

  `onValueChange` follows: it is handed the number the same way, so a select or
  group bound to numbers reports numbers.

  The DOM only speaks strings, so `data-value` is unchanged — the number written
  out. Values are matched by identity, so `1` and `"1"` are two different items;
  pick one shape per select or group. Existing string values, and the signals
  already bound to them, are untouched.

- [#53](https://github.com/ieedan/implement/pull/53) [`d3ca099`](https://github.com/ieedan/implement/commit/d3ca099c27b1719b64bb72daf7856692e369e38f) Thanks [@ieedan](https://github.com/ieedan)! - `Drawer` no longer reflows its panel while the keyboard is handed between two
  fields. Moving focus from one field to the next starts the keyboard dismissing
  and then brings it straight back, and `--ip-drawer-keyboard-inset` tracked that
  dip frame by frame — so the spacer shrank, the panel shrank, and every field in
  it slid down and back. A growing keyboard is still published at once, since
  until the panel makes room the keyboard is on top of it; a shrinking one has to
  stay shrunk for 250ms before the panel believes it.

- [#53](https://github.com/ieedan/implement/pull/53) [`a8ff85d`](https://github.com/ieedan/implement/commit/a8ff85d2dfa297ce0f567c67d738b8c7d15c523d) Thanks [@ieedan](https://github.com/ieedan)! - Add `Drawer`, a port of [Vaul](https://vaul.emilkowal.ski): a panel that slides in
  from any of the four edges and can be dragged back out. It is built on the same
  modal base as `Dialog`, so it keeps the focus trap, Escape, outside dismissal,
  scroll lock, and nesting, and adds the gesture on top — snap points with an
  overlay that fades between them, a velocity-aware release, a rubber band past the
  open position, and a scroll guard so a panel with a list in it scrolls before it
  drags.

  `dismissible: false` stops every close the drawer owns, the drag included, which
  the shared modal base now understands: a modal may refuse to be dismissed, and one
  nested inside a modal that is closing still goes with it.

- Updated dependencies [[`00239de`](https://github.com/ieedan/implement/commit/00239de0e84fe27b2f8737e977d973b4d24c454e)]:
  - @implementjs/core@0.0.6

## 0.0.6

### Patch Changes

- [`4c9c7ea`](https://github.com/ieedan/implement/commit/4c9c7eab6a50398de4c1af26629aced332430952) Thanks [@ieedan](https://github.com/ieedan)! - feat: add render prop for custom element rendering in primitives
- Updated dependencies [[`f60114f`](https://github.com/ieedan/implement/commit/f60114f329cd73c5922a60c8337566afa97d3f21)]:
  - @implementjs/core@0.0.5

## 0.0.5

### Patch Changes

- [`c2c1c4a`](https://github.com/ieedan/implement/commit/c2c1c4a362432bf5ee00832551e1dcdaa8f7a4c0) Thanks [@ieedan](https://github.com/ieedan)! - Add `DropdownMenuCheckboxGroup`, `ContextMenuCheckboxGroup`, and
  `MenubarCheckboxGroup`, which hold a set of checkbox items as one array of
  values instead of a boolean each.

  A menu that toggles several related things — which panels are visible, which
  columns a table shows — held one signal per item, and the set of what was
  checked had to be assembled from them. The group owns the array, and each
  item inside it is named by a new `value` prop:

  ```ts
  const visible = signal(["status-bar", "activity-bar"]);

  DropdownMenuCheckboxGroup(
  	{ value: visible },
  	DropdownMenuGroupHeading("Panels"),
  	DropdownMenuCheckboxItem({ value: "status-bar", closeOnSelect: false }, "Status bar"),
  	DropdownMenuCheckboxItem({ value: "activity-bar", closeOnSelect: false }, "Activity bar"),
  );
  ```

  Selecting an item adds or removes its value, and the group's array is what is
  checked — inside a group the item's own `checked` prop no longer applies. A
  checkbox item outside a group, or one without a `value`, keeps its own boolean
  and behaves exactly as before. The group is a `role="group"` like
  `DropdownMenuGroup`, so a `GroupHeading` inside names it, and it sets
  `data-dropdown-menu-checkbox-group` (`data-context-menu-…`,
  `data-menubar-…`).

## 0.0.4

### Patch Changes

- Updated dependencies [[`14ce276`](https://github.com/ieedan/implement/commit/14ce276cf1a03340930ae030410551d23efa724e)]:
  - @implementjs/core@0.0.4

## 0.0.3

### Patch Changes

- [`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15) Thanks [@ieedan](https://github.com/ieedan)! - Generate ids without `nanoid`, so the bundle runs in a browser.

  `nanoid@6` resolves to its Node build when it is bundled — that build reaches for
  `Buffer.allocUnsafe`, so the first primitive to call `getId()` threw
  `ReferenceError: Buffer is not defined` on the client. `getId()` now draws its
  four characters from `crypto.getRandomValues` over the same 64 character
  alphabet, which every target already has, and the package has no runtime
  dependency beyond `@implementjs/core`.

- Updated dependencies [[`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15)]:
  - @implementjs/core@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [[`aee1296`](https://github.com/ieedan/implement/commit/aee129639e5d4f04d3285c017c42fa3649fab48b)]:
  - @implementjs/core@0.0.2

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup
- Updated dependencies [[`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed), [`6629993`](https://github.com/ieedan/implement/commit/662999342363fb2bbdf37966bb0530c1d084f375), [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66)]:
  - @implementjs/core@0.0.1
