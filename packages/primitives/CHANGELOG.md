# @implementjs/primitives

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
