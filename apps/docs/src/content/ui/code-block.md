---
title: Code Block
description: Code, terminal output, logs, and diffs, with line numbers and a copy button.
section: Components
---

<div data-demo="code-block" data-demo-description="A bordered panel titled src/main.ts with a copy button, holding an eleven-line TypeScript counter, syntax highlighted and numbered."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/code-block
```

jsrepo pulls `button` along with it, for the copy button. Syntax highlighting is a separate item, so a block that only ever shows plain output does not ship a grammar:

```sh
npx jsrepo add @implementjs/ui/highlighted-code
```

That one installs `shiki`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/code-block.ts`. It imports `cn` from [`utils.ts`](/ui#merging-classes), which belongs at `src/lib/utils.ts`, and [`button`](/ui/button) from the same directory — copy those in beside it too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install tailwind-variants @implementjs/lucide
```

<div data-source="code-block"></div>

For [syntax highlighting](#syntax-highlighting), copy this one to `src/lib/components/ui/highlighted-code.ts`, and install `shiki`:

```sh
npm install shiki
```

<div data-source="highlighted-code"></div>

<div data-tabs-end></div>

Then add [the scroll fade](#scroll-fade) to your stylesheet.

## Usage

```ts
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@/lib/components/ui/code-block";

CodeBlock(
	CodeBlockHeader(
		CodeBlockTitle(TerminalIcon(), "Terminal"),
		CodeBlockActions(CodeBlockCopyButton({ value: "pnpm dev" })),
	),
	CodeBlockContent("pnpm dev"),
);
```

```text
CodeBlock
├── CodeBlockHeader
│   ├── CodeBlockTitle
│   └── CodeBlockActions
│       └── CodeBlockCopyButton
├── CodeBlockContent
│   └── CodeBlockLine
└── CodeBlockFooter
```

Every part but `CodeBlockContent` is optional. Put `CodeBlockActions` straight in the `CodeBlock`, with no header, and it floats over the top corner instead, showing on hover or focus — and always on a touch screen, where there is no hover to show it.

## Line numbers

`lineNumbers` numbers the lines, and `startLine` says what the first one is called — for an excerpt from the middle of a file. Code passed as text is split into lines for you. To mark lines of a diff, pass the lines yourself: a `CodeBlockLine` takes `added`, `removed`, or `highlighted`.

<div data-demo="code-block-diff" data-demo-description="A diff starting at line 12: a removed line tinted red with a minus in the gutter, an added line with a plus, and the return statement highlighted."></div>

```ts
CodeBlockContent(
	{ lineNumbers: true, startLine: 12 },
	CodeBlockLine("function Counter() {"),
	CodeBlockLine({ variant: "removed" }, "\tlet count = 0;"),
	CodeBlockLine({ variant: "added" }, "\tconst count = signal(0);"),
	CodeBlockLine("}"),
);
```

The numbers and the `+` and `−` are drawn by CSS, so selecting the code and copying it copies the code alone.

## Streaming

Pass a readable string as the only child, and the block follows it as it grows — a terminal while the command runs, or an answer as a model writes it. With `lineNumbers`, each new line becomes a `CodeBlockLine` as it arrives, and the ones already there are left alone.

<div data-demo="code-block-streaming" data-demo-description="A terminal block whose pnpm build output arrives one line at a time, numbered as it comes, with a button to run it again and one to copy what is there so far."></div>

```ts
const log = signal("");

CodeBlock(
	CodeBlockHeader(
		CodeBlockTitle(TerminalIcon(), "Terminal"),
		CodeBlockActions(CodeBlockCopyButton({ value: log })),
	),
	CodeBlockContent({ lineNumbers: true }, log),
);
```

`CodeBlockCopyButton` takes the same readable, so it copies what is there when it is pressed.

## Syntax highlighting

`highlightedCode` turns code into highlighted lines with [Shiki](https://shiki.style), one child per line, to put in `CodeBlockLine`s. It hands back a readable: the plain lines first — on the server, and until the grammar arrives — then the highlighted ones.

```ts
import { highlightedCode } from "@/lib/components/ui/highlighted-code";

const lines = highlightedCode(code, "ts");

CodeBlockContent(
	{ lineNumbers: true },
	ForEach(
		lines,
		(_, index) => index,
		(line) => CodeBlockLine(Dynamic(line)),
	),
);
```

Both arguments take a readable. Code that streams in is highlighted as it goes: a line is tokenized once it is complete, carrying the grammar's state on to the next, so only the line still being written is tokenized again on each change.

Each language loads the first time it is asked for. The list at the top of `highlighted-code.ts` ships with `bash`, `css`, `diff`, `html`, `javascript`, `json`, `jsx`, `markdown`, `python`, `sql`, `tsx`, `typescript`, and `yaml`, plus aliases like `ts`, `js`, `sh`, and `yml` — add to it what you need. A language that is not on it renders plain. `ansi` colors terminal output by its escape codes.

The tokens carry both themes' colors, `github-light` and `github-dark`, as custom properties, and the `dark:` variant picks one — so a highlighted block follows your color mode with no second pass.

For code that is not going to change, `highlightCode(code, language)` is the one-shot version: a promise of the lines, or `null` for a language that is not listed.

## Wrapping

`wrap` wraps long lines rather than scrolling sideways — for logs and prose-like output, where reading a line matters more than its shape.

## Inside a trace

`size: "sm"` tightens the padding and the type, for tool output under a [trace](/ui/trace) step. Pair it with the `destructive` variant for a step that failed:

```ts
TraceCollapsibleContent(
	CodeBlock(
		{ size: "sm", variant: "destructive" },
		CodeBlockContent({ wrap: true, class: "max-h-64" }, stderr),
	),
);
```

## Scroll fade

A block that scrolls fades its edges where there is more to scroll to, and only there — left and right as it scrolls sideways, top and bottom once it wraps. Add `scroll-fade-y` to a block you cap with `max-h-*` that does not wrap, and all four edges fade.

These are Tailwind utilities rather than classes the component carries, so paste them into your stylesheet beside the rest. In a browser without scroll-driven animations the edges stay sharp; without the utilities at all, nothing fades.

```css
/* A thin scrollbar, for panels that scroll but should not be framed by one —
   the code block's horizontal overflow. */
@utility scrollbar-thin {
	scrollbar-width: thin;
}

/* scroll-fade: a scroller fades its edges where there is more to scroll to,
   and only there. The code block uses the inline pair, and the block pair once
   it wraps. Ported from shadcn's `shadcn/tailwind.css`. */
@property --scroll-fade-t {
	syntax: "<length-percentage>";
	inherits: false;
	initial-value: 0px;
}
@property --scroll-fade-b {
	syntax: "<length-percentage>";
	inherits: false;
	initial-value: 0px;
}
@property --scroll-fade-s {
	syntax: "<length-percentage>";
	inherits: false;
	initial-value: 0px;
}
@property --scroll-fade-e {
	syntax: "<length-percentage>";
	inherits: false;
	initial-value: 0px;
}

@theme inline {
	@keyframes scroll-fade-reveal-t {
		from {
			--scroll-fade-t: 0px;
		}
		to {
			--scroll-fade-t: var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10)));
		}
	}
	@keyframes scroll-fade-reveal-b {
		from {
			--scroll-fade-b: var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10)));
		}
		to {
			--scroll-fade-b: 0px;
		}
	}
	@keyframes scroll-fade-reveal-s {
		from {
			--scroll-fade-s: 0px;
		}
		to {
			--scroll-fade-s: var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10)));
		}
	}
	@keyframes scroll-fade-reveal-e {
		from {
			--scroll-fade-e: var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10)));
		}
		to {
			--scroll-fade-e: 0px;
		}
	}
}

@utility scroll-fade-x {
	--scroll-fade-inline: linear-gradient(
		to right,
		transparent 0,
		#000 var(--scroll-fade-s, 0px),
		#000 calc(100% - var(--scroll-fade-e, 0px)),
		transparent 100%
	);
	&:where([dir="rtl"], [dir="rtl"] *) {
		--scroll-fade-inline: linear-gradient(
			to left,
			transparent 0,
			#000 var(--scroll-fade-s, 0px),
			#000 calc(100% - var(--scroll-fade-e, 0px)),
			transparent 100%
		);
	}
	mask-image: var(--scroll-fade-inline);
	mask-repeat: no-repeat;

	@supports (animation-timeline: scroll()) {
		animation:
			scroll-fade-reveal-s 1ms ease-in-out,
			scroll-fade-reveal-e 1ms ease-in-out;
		animation-timeline: scroll(self inline), scroll(self inline);
		animation-range:
			0 var(--scroll-fade-reveal, calc(var(--spacing) * 24)),
			calc(100% - var(--scroll-fade-reveal, calc(var(--spacing) * 24))) 100%;
		animation-fill-mode: both;
	}
}

/* With both, the two masks intersect: `scroll-fade-x scroll-fade-y` fades all
   four edges. */
@utility scroll-fade-y {
	--scroll-fade-block: linear-gradient(
		to bottom,
		transparent 0,
		#000 var(--scroll-fade-t, 0px),
		#000 calc(100% - var(--scroll-fade-b, 0px)),
		transparent 100%
	);
	mask-image: var(--scroll-fade-inline, linear-gradient(#000, #000)), var(--scroll-fade-block);
	mask-composite: intersect;
	mask-repeat: no-repeat;

	@supports (animation-timeline: scroll()) {
		animation:
			scroll-fade-reveal-s 1ms ease-in-out,
			scroll-fade-reveal-e 1ms ease-in-out,
			scroll-fade-reveal-t 1ms ease-in-out,
			scroll-fade-reveal-b 1ms ease-in-out;
		animation-timeline: scroll(self inline), scroll(self inline), scroll(self y), scroll(self y);
		animation-range:
			0 var(--scroll-fade-reveal, calc(var(--spacing) * 24)),
			calc(100% - var(--scroll-fade-reveal, calc(var(--spacing) * 24))) 100%,
			0 var(--scroll-fade-reveal, calc(var(--spacing) * 24)),
			calc(100% - var(--scroll-fade-reveal, calc(var(--spacing) * 24))) 100%;
		animation-fill-mode: both;
	}
}
```

## Accessibility

- The `Pre` is focusable, so a keyboard can scroll it, and the block draws a focus ring while it has focus.
- The copy button is labelled "Copy", then "Copied" — and the change is announced through a live region, since the icon swap alone says nothing to a screen reader.
- The code is always laid out left to right, even on a right-to-left page.

## API Reference

<div data-api="ui-code-block"></div>
