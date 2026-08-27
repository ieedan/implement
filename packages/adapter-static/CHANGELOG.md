# @implementjs/adapter-static

## 0.0.15

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.15

## 0.0.14

### Patch Changes

- Updated dependencies [[`a966956`](https://github.com/ieedan/implement/commit/a966956b4ea83998980e725adde89d78ee98d6a4), [`b2c045b`](https://github.com/ieedan/implement/commit/b2c045be858f13f1a059fd9316f3e915445fb10e), [`d8941a0`](https://github.com/ieedan/implement/commit/d8941a07d33300fbd9cddd63ac915d184ea5ef72), [`e9e3451`](https://github.com/ieedan/implement/commit/e9e3451627bf62f9407b3793b0a598d7738a4b2a)]:
  - @implementjs/kit@0.0.14

## 0.0.13

### Patch Changes

- Updated dependencies [[`ad05ed6`](https://github.com/ieedan/implement/commit/ad05ed61f02f76235fd696d7227eab15e3443ea6), [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5), [`b0a4d26`](https://github.com/ieedan/implement/commit/b0a4d264717f2c86b638fe8341b78ffebd93d1eb), [`cb2dffb`](https://github.com/ieedan/implement/commit/cb2dffb0053a570bf39992b81a290dcc5970596c), [`1db158e`](https://github.com/ieedan/implement/commit/1db158e951f0bf07d63681a153f7e1d972905ac4), [`a8d5286`](https://github.com/ieedan/implement/commit/a8d528668fb5ac32d63d9e36fad3a81a632e04c5)]:
  - @implementjs/kit@0.0.13

## 0.0.12

### Patch Changes

- Updated dependencies [[`090e305`](https://github.com/ieedan/implement/commit/090e305ad38d9c299ea20b99ff2a77bba0754cd3)]:
  - @implementjs/kit@0.0.12

## 0.0.11

### Patch Changes

- Updated dependencies [[`dc8afec`](https://github.com/ieedan/implement/commit/dc8afec501579ce02c509d21252a94da9935211d)]:
  - @implementjs/kit@0.0.11

## 0.0.10

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.10

## 0.0.9

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.9

## 0.0.8

### Patch Changes

- Updated dependencies [[`2702c55`](https://github.com/ieedan/implement/commit/2702c55c546c2a82a3517ff997aad4628e203b70), [`05d9b20`](https://github.com/ieedan/implement/commit/05d9b20ead7c52f3eba9fdbaff03363a7b81f8b3)]:
  - @implementjs/kit@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [[`e9bf3b1`](https://github.com/ieedan/implement/commit/e9bf3b1e2919f8518248ad3804f310f8a15a2878), [`b51e829`](https://github.com/ieedan/implement/commit/b51e8295af17c8d72287b71e6e312c50bcc12c4f)]:
  - @implementjs/kit@0.0.7

## 0.0.6

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [[`c4cdbfd`](https://github.com/ieedan/implement/commit/c4cdbfd9590eda1e8df1ae1c3c241c98cd6b8b15), [`3752116`](https://github.com/ieedan/implement/commit/3752116f9afa8da206ea2c40bd27db7b0935cba1), [`4c3c44e`](https://github.com/ieedan/implement/commit/4c3c44ea5ce6ac7a084a7c15a3330dd3f287f692)]:
  - @implementjs/kit@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [[`96c8eb9`](https://github.com/ieedan/implement/commit/96c8eb97aa3a1c5fe234f1c5ab068411476f5cdb)]:
  - @implementjs/kit@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies []:
  - @implementjs/kit@0.0.2

## 0.0.1

### Patch Changes

- [`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed) Thanks [@ieedan](https://github.com/ieedan)! - initial setup

- [#32](https://github.com/ieedan/implement/pull/32) [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66) Thanks [@ieedan](https://github.com/ieedan)! - Publish the node-authoring API and extract the router.

  `@implementjs/core` gains `Outlet`, a swappable mount region whose children are mounted
  through core — so context lookups, error boundaries, hydration and server rendering all
  work inside one — and `location`, the current `RouterLocation` as a `Readable`. Core also
  restores the scroll position of the entry a reload landed on off the first location
  subscription, so a hand-written router gets that for free.

  `Router` moves to the new `@implementjs/router`, written against that public API and
  nothing else. `@implementjs/core/router` is gone; navigation stays in core (`location`,
  `navigateTo`, `searchParam`, the navigation guards and the resolver).

  kit generates `import { Router } from "@implementjs/router"` and takes it as a dependency,
  and scaffolded kit apps list it too — generated code resolves from the app, not from kit.

- Updated dependencies [[`9197aff`](https://github.com/ieedan/implement/commit/9197affc69dd063a4f7c4ed0399f6395d2ba93ed), [`b5c6c3e`](https://github.com/ieedan/implement/commit/b5c6c3e9983ca1d04db41377266a81691a477e66)]:
  - @implementjs/kit@0.0.1
