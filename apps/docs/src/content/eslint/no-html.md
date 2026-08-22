---
title: no-html
description: Html inserts its string as live nodes with no sanitization, so every use is a decision worth writing down.
section: Rules
order: 15
---

[`Html`](/docs/html) parses its string as-is and inserts the result as live nodes. There is no sanitization, so anything user-provided that reaches it is an XSS.

The rule reports **every** use of `Html` imported from `@implementjs/core`. That is the point: it is not trying to work out whether a particular string is safe — nothing here could — it is making each use a decision somebody wrote down.

```ts
import { Html } from "@implementjs/core";

// this repo's own markdown, compiled at build time; no visitor input reaches it
// oxlint-disable-next-line implementjs/no-html
Div({ class: "prose" }, Html(page.content));
```

Put the reason on the lines above and the directive immediately before the code — `oxlint-disable-next-line` applies to the line that follows the _comment_, so a reason wrapped onto a second line silently breaks it.

Aliasing on import does not get around the rule, and an `Html` of your own is not caught by it:

```ts
import { Html as Raw } from "@implementjs/core";
Div(Raw(markup)); // still reported

import { Html } from "./my-markdown"; // not core's, not reported
```

For SVG markup, [`Svg`](/docs/svg) is the better answer anyway — it caches parsed templates and gives the root typed, bindable props.
