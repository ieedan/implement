[![npm version](https://img.shields.io/npm/v/@implementjs/lucide.svg)](https://www.npmjs.com/package/@implementjs/lucide) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/lucide.svg)](https://www.npmjs.com/package/@implementjs/lucide)

# @implementjs/lucide

The full [Lucide](https://lucide.dev) icon set as [implement](https://implementjs.dev)
components. Every icon is a pure export, so bundlers keep only the ones you import.

```sh
npm install @implementjs/lucide
```

```ts
import { Button } from "@implementjs/core";
import { ArrowRight } from "@implementjs/lucide";

Button({ class: "flex items-center gap-2" }, "Continue", ArrowRight({ class: "size-4" }));
```

An icon takes the same props as core's `Svg` helper, and merges the `class` you pass with
the `lucide lucide-<name>` classes it sets itself. Every icon is also exported under an
`Icon` suffix (`ArrowRightIcon`), for when a bare name would collide with something of
your own.

Full documentation: [implementjs.dev/lucide](https://implementjs.dev/lucide)
