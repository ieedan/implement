[![npm version](https://img.shields.io/npm/v/@implementjs/cn.svg)](https://www.npmjs.com/package/@implementjs/cn) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/cn.svg)](https://www.npmjs.com/package/@implementjs/cn)

# @implementjs/cn

Merge tailwind classes so the last one wins. It is the `cn` every
[`@implementjs/ui`](https://implementjs.dev/ui) component passes its classes through, and it
understands everything an implement `class` does — strings, objects, arrays, and signals.

```sh
npm install @implementjs/cn
```

```ts
import { cn } from "@implementjs/cn";

Div({ class: cn("rounded-xl border p-6", className) });
cn("p-6", "p-2"); // → "p-2"
```

A plain string comes back unless a signal was passed in. Then the result is a readable that
re-merges whenever any signal in the list changes, so `cn("p-6", count.bind((c) => c > 2 && "p-2"))`
stays in step with `count`.

## Your own tailwind-merge config

A theme with utilities of its own, like an `elevation-2` from a Tailwind `@utility`, needs
tailwind-merge told which of them conflict — it has never heard of them. `createCn` takes the same config as
[`extendTailwindMerge`](https://github.com/dcastil/tailwind-merge/blob/v3.6.0/docs/configuration.md#extending-the-tailwind-merge-config):

```ts
import { createCn } from "@implementjs/cn";

export const cn = createCn({
	extend: { classGroups: { elevation: [{ elevation: ["1", "2", "3"] }] } },
});
```

Full documentation: [implementjs.dev/ui](https://implementjs.dev/ui#merging-classes)
