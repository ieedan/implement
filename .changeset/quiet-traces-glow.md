---
"@implementjs/ui": patch
---

Add `trace` and `code-block`, ported from shadcn/ui's October 2026 release, and
`highlighted-code` for syntax highlighting them.

`Trace` is one row for everything an agent shows while it works — a thought, a
search, a command, a file it edited, a step of its plan. A `TraceLine` takes a
`status` (`running`, `error`, or `pending`), and since it takes a readable a
step can move along as the work does. Wrap a line in a `TraceCollapsible` to
expand it into its output.

`CodeBlock` shows code, terminal output, logs, and diffs, with a header, line
numbers, `added` / `removed` / `highlighted` lines, wrapping, and a copy
button. Pass a readable string as its content and it follows the string as it
grows, numbering each line as it arrives:

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

`highlightedCode(code, language)` highlights with Shiki and hands back a
readable of lines — plain on the server and until the grammar loads, then
highlighted. It is its own registry item, so a block that only shows plain
output does not install `shiki`.

Both components lean on a few Tailwind utilities — `shimmer` for a running
step, `scroll-fade-x` / `scroll-fade-y` for a block's edges — which their
pages give you to paste into your stylesheet.
