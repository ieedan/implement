# implement for VS Code

Editor support for [implement](https://implementjs.dev). It fills in the shape of
a component call so you write the interesting part, not the punctuation.

Works in VS Code and Cursor, in TypeScript and JavaScript.

## What it does

Type `(` after a component and a preselected suggestion appears. Tab accepts it.

| You type                             | You get                           |
| ------------------------------------ | --------------------------------- |
| `Div(` at statement level            | `Div({}, ⎸)`                      |
| `Span(` nested inside another call   | `Span({}, ⎸),`                    |
| `Img(` — a void element, no children | `Img({⎸})`                        |
| `ChevronDown(` — a Lucide icon       | `ChevronDown({⎸})`                |
| `If(`                                | `If(⎸condition, )`                |
| `ForEach(`                           | `ForEach(⎸items, getKey, render)` |
| `Svg(`                               | `Svg(⎸source, {})`                |

Tab again to reach the props braces. `implement.snippets.cursor` flips that order
if you would rather land in the props.

The trailing comma is independent of props: any call nested in another call or an
array gets closed off, including a component that takes no arguments. A component
with nothing to fill in is offered only when there is a comma to add — otherwise
the snippet would type nothing.

### Your own components

Components imported from your project are read off their declarations, so the
suggestion matches the signature you actually wrote:

```ts
Logo(props: SvgProps = {})                    // Logo({⎸})
Link = (props, ...children) => ...            // Link({}, ⎸)
Toaster({ manager, ...props })                // Toaster({⎸})
Typeset(content: string, className?: string)  // trailing comma only
SiteHeader()                                  // trailing comma only
```

Relative specifiers resolve against the importing file; bare specifiers go
through `compilerOptions.paths`, following `extends`. Named re-exports are
followed. `node_modules` is never read.

### Constructs

`If` and `ForEach` are also offered while you type the **name**, because what you
want there is a whole shape rather than a first argument:

| You type  | You get                                       |
| --------- | --------------------------------------------- |
| `If`      | `If(⎸).Then()`                                |
| `ForEach` | `ForEach(⎸, (item) => ⎸, (item, index) => ⎸)` |

If the name is not imported yet, the import is added as part of accepting the
suggestion — extending an existing `@implementjs/core` import rather than adding
a second statement.

## Settings

All settings are language-overridable.

| Setting                                     | Default      |                                                                                                                                                                                           |
| ------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `implement.snippets.mode`                   | `completion` | `completion` offers a suggestion (Tab accepts). `auto` rewrites as you type the paren, with no keypress — experimental, it races auto-closing brackets and coarsens undo. `off` disables. |
| `implement.snippets.cursor`                 | `children`   | Where the cursor lands: `Div({}, ⎸)` or `Div({⎸}, )`.                                                                                                                                     |
| `implement.snippets.trailingComma`          | `true`       | Close a nested call with a comma.                                                                                                                                                         |
| `implement.snippets.requireImport`          | `false`      | Only match names already imported. When `false`, element names also match before the import exists, unless the name is declared in the file.                                              |
| `implement.snippets.resolveLocalComponents` | `true`       | Read declarations of components imported from your project.                                                                                                                               |
| `implement.snippets.constructs`             | `true`       | Offer `If` and `ForEach` as whole shapes while typing the name.                                                                                                                           |
| `implement.snippets.extraSources`           | `{}`         | Module specifiers whose capitalized exports follow a component convention, for barrels the resolver cannot see through: `{ "@/lib/ui": "propsChildren" }`.                                |

## How it decides

implement's components do not share a first argument, so this cannot be a rule
like "capitalized identifier, insert `{}`". `Svg(source, props?)` takes a string,
`If(condition, ...)` takes a condition, and every Lucide icon takes props with no
children at all — `ChevronDown({}, )` is a type error.

So `src/symbols.ts` holds an explicit table, keyed on **(module specifier,
exported name)** rather than on the local name, because the two entry points do
not expose the same set — the helpers live only on the root, so `If` reached
through `@implementjs/core/elements` is not the helper, it is nothing at all.

The local name is not enough for a second reason: an alias keeps the shape of
the name it was exported under, so `import { Div as Box }` still offers
`Box({}, )`.

Two packages get a package-wide rule instead of a list, because they build every
component through one factory and are uniform by construction: primitives via
`createComponent`, lucide via `createLucideIcon`.

The element list in `src/elements.ts` is generated from `@implementjs/core` by
`pnpm generate`, and `tests/elements.test.ts` fails when it drifts — a stale
table makes confidently wrong suggestions, which is worse than none.

## Known limits

- Imports are matched with regular expressions rather than parsed, so
  `import * as El from "..."` then `El.Div(` is not recognised, and neither is a
  component re-exported through `export * from "..."`. Name the barrel in
  `extraSources` for that case.
- Nesting is found with a small hand-written lexer. It handles comments, all
  three string forms, and `${}` inside templates, but it cannot tell a regex
  literal from division, so brackets inside a regex can produce a stray comma.
  Turn `trailingComma` off if that happens.
- A component assembled in a way the resolver does not recognise — returned from
  a factory other than `createComponent`, or built with `Object.assign` — reads
  as unknown, and gets the trailing comma but no props.

## Development

```bash
pnpm --filter implement-vscode build     # bundle to dist/extension.js
pnpm --filter implement-vscode test      # vitest
pnpm --filter implement-vscode check     # tsc --noEmit
pnpm --filter implement-vscode generate  # re-sync the element list from core
pnpm --filter implement-vscode package   # build implement-vscode.vsix
```

Install a local build:

```bash
cursor --install-extension packages/vscode/implement-vscode.vsix
```

`src/analyze.ts` holds the decision-making and imports nothing from `vscode`, so
it is tested directly. `src/extension.ts` is the only file that touches the
editor API.
