# @implementjs/primitives

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
