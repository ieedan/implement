[![npm version](https://img.shields.io/npm/v/@implementjs/primitives.svg)](https://www.npmjs.com/package/@implementjs/primitives) [![npm downloads](https://img.shields.io/npm/dm/@implementjs/primitives.svg)](https://www.npmjs.com/package/@implementjs/primitives)

# @implementjs/primitives

Unstyled, accessible building blocks for [implement](https://implementjs.dev). They own the
behavior, the keyboard interaction and the ARIA wiring; you own every class name.

```sh
npm install @implementjs/primitives
```

```ts
import { A, Div } from "@implementjs/core";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@implementjs/primitives";

function Links() {
	return Collapsible(
		{},
		CollapsibleTrigger("What's next?"),
		CollapsibleContent(Div(A({ href: "/docs" }, "Docs"), A({ href: "/kit" }, "kit"))),
	);
}
```

Accordion, dialog, dropdown menu, select, tabs, tooltip, toggle group and the rest of the
usual set are all here, each as a root plus the parts it composes from.

Full documentation: [implementjs.dev/primitives](https://implementjs.dev/primitives)
