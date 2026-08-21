---
title: Introduction
description: Styled components built on the primitives, copied into your project with jsrepo.
section: Start Here
order: 1
---

`@implementjs/ui` is the styled layer over [`@implementjs/primitives`](/primitives). The primitives own the behavior — open and close, roving focus, `data-*` hooks — and these components add the look: shadcn's design language, expressed in Tailwind classes on top of a small set of CSS variables.

They are not a dependency. Each component is one TypeScript file that [jsrepo](https://jsrepo.dev) copies into your project, and from that moment the file is yours: rename it, delete a variant, change a class. Nothing here is hidden behind a package version.

```ts
import { Button } from "@/lib/components/ui/button";

Button({ variant: "outline", size: "sm" }, "Save");
```

Every component on this site is the same file the registry ships, rendered live. The demos are editable — change one and it re-runs in place.

## What you need first

An implement app with [Tailwind CSS v4](https://tailwindcss.com). [`create-implement-app`](/create) writes one with the `--tailwind` addon; adding it to an existing app is `@tailwindcss/vite` plus an `@import "tailwindcss"` in your stylesheet.

> [!TIP]
> Starting a new app? `create-implement-app --ui` does everything on this page for you — the packages, the stylesheet below, and the `jsrepo.config.ts` — and opens on a page already using one of the components. See [the ui addon](/create/templates).

Then three packages:

```sh
npm install @implementjs/core @implementjs/primitives tailwind-merge
```

`tailwind-merge` is what [`cn`](#merging-classes) is built on, and every component in the registry routes its classes through it. Some components also want `tailwind-variants`, which is where `tv()` comes from — the variant tables in `button.ts`, `toggle.ts`, and `tabs.ts`:

```sh
npm install tailwind-variants
```

Components that draw an icon (a chevron on the accordion, a check in the checkbox, the close X on a dialog) also want the icon set:

```sh
npm install @implementjs/lucide
```

Each component page lists exactly which of these it touches.

## The CSS

This is the part that has to be right before anything renders correctly. The components never name a color directly — every class goes through a token, so `bg-primary` and `border-border` only mean something once the tokens exist.

Paste this into the stylesheet your app imports (`src/app.css` in the templates) — the `--ui` addon writes it for you:

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
	--background: #000;
	--foreground: #fff;
	--card: #000;
	--card-foreground: #fff;
	--popover: #000;
	--popover-foreground: #fff;
	--primary: #fff;
	--primary-foreground: #000;
	--secondary: #222;
	--secondary-foreground: #fff;
	--muted: #222;
	--muted-foreground: #a1a1a1;
	--accent: #222;
	--accent-foreground: #fff;
	--destructive: oklch(0.704 0.191 22.216);
	--border: #222;
	--input: #222;
	--ring: #fff;
}

@theme inline {
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-accent: var(--accent);
	--color-accent-foreground: var(--accent-foreground);
	--color-destructive: var(--destructive);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
}

@layer base {
	* {
		@apply border-border;
	}

	html {
		@apply antialiased;
	}

	body {
		@apply min-h-dvh bg-background text-foreground;
	}
}

html {
	color-scheme: dark;
}
```

Two blocks are doing different jobs. `:root` declares the raw values, and `@theme inline` turns each one into a Tailwind color so `bg-popover` and `ring-ring/50` compile. Skip the `@theme` block and the classes silently produce nothing.

The `@layer base` rule that applies `border-border` to `*` is not decoration either: the components write `border` without a color, on the assumption that the default border color is already the token.

### Changing the theme

Every value above is referenced exactly once, through `@theme inline`. Swapping the palette is editing `:root` — nothing in the component files names a color, so re-theming does not touch them.

The values shipped here are the dark palette these components were tuned against; `--input` and `--muted` are the same grey, and a few components (tabs, for one) lean on that. For a light theme, move the block to `.dark` and give `:root` light values:

```css
:root {
	--background: #fff;
	--foreground: #0a0a0a;
	/* ...the rest of the light values */
}

.dark {
	--background: #000;
	--foreground: #fff;
	/* ...the dark values from above */
}
```

`@custom-variant dark (&:is(.dark *))` is what makes the `dark:` classes in the component files follow that class, so keep it whichever way round you go. And drop the `color-scheme: dark` on `html` if the app is no longer dark-only.

### The sidebar's palette

[Sidebar](/ui/sidebar) is the one component with tokens of its own, so it can sit a shade off the page without every surface token being dragged with it. Add these only if you install it — its page has the block, along with the width variables.

### Animation keyframes

[Accordion](/ui/accordion) and [Collapsible](/ui/collapsible) animate to a height they only learn at runtime. The primitives measure the content and write it onto the element as `--ip-accordion-content-height` / `--ip-collapsible-content-height`; the keyframes that read it belong in your stylesheet, inside `@theme inline`:

```css
@theme inline {
	--animate-accordion-down: accordion-down 0.2s ease-out;
	--animate-accordion-up: accordion-up 0.2s ease-out;

	@keyframes accordion-down {
		from {
			height: 0;
		}
		to {
			height: var(--ip-accordion-content-height);
		}
	}

	@keyframes accordion-up {
		from {
			height: var(--ip-accordion-content-height);
		}
		to {
			height: 0;
		}
	}

	--animate-collapsible-down: collapsible-down 0.2s ease-out;
	--animate-collapsible-up: collapsible-up 0.2s ease-out;

	@keyframes collapsible-down {
		from {
			height: 0;
		}
		to {
			height: var(--ip-collapsible-content-height);
		}
	}

	@keyframes collapsible-up {
		from {
			height: var(--ip-collapsible-content-height);
		}
		to {
			height: 0;
		}
	}
}
```

Without them those two components still open and close correctly — they just snap instead of sliding. Every other component animates with plain Tailwind transitions and needs nothing extra.

## Merging classes

Every component takes a `class`, and every component merges it with `cn` — the one helper the registry shares, in `utils.ts` beside the component files:

```ts
Div({ ...props, "data-slot": "card", class: cn("rounded-xl border p-6", className) });
```

That merge is what makes the class you pass actually win. `class` is already clsx-shaped, so without it both utilities would survive and the one that painted would be whichever Tailwind emitted later — passing `p-2` to a component whose base is `p-6` would leave you with `p-6`. `cn` runs the resolved list through [tailwind-merge](https://github.com/dcastil/tailwind-merge), which drops the earlier half of each conflicting pair:

```ts
Card({ class: "p-2" }); // → rounded-xl border p-2
Button({ variant: "outline", class: "size-20" }); // wins over the size variant's `size-9`
```

Signals keep working through it. `class` normally re-walks the value it was given whenever a signal in it changes, which is what keeps a signal that appears — or stops appearing — mid-life subscribed. Merging eagerly would collapse that structure into one string and freeze the dependencies at whatever happened to be there the first time, so `cn` does the same bookkeeping instead: re-walk, then subscribe to exactly what the walk just read.

```ts
Button({ class: count.bind((c) => c > 2 && "size-16 rounded-full") });
```

The upshot is that a reactive class behaves the same whether it goes through `cn` or not — including a list whose signals change over time.

`utils.ts` is a `lib` item rather than a `ui` one, so it lands beside your own helpers — `src/lib/utils.ts` by default — instead of among the components. It arrives on its own with the first component you add, so it never needs asking for by name, and jsrepo writes each component's import to match wherever your config puts the two. It is a normal file once it lands: `cn` is yours to extend, and a project that already has one can point the components at it instead.

<div data-source="utils"></div>

## Installing components

<div data-tab="CLI"></div>

Register the registry once:

```sh
npx jsrepo init @implementjs/ui
```

That installs jsrepo and writes a `jsrepo.config.ts`, with `@implementjs/ui` recorded in its `registries`. After that, add components by name:

```sh
npx jsrepo add button
```

The bare name works because the registry is registered. `@implementjs/ui/button` is the fully qualified form — it is what every component page shows, since it also works before you have run `init`. Several at a time is fine, and `--registry` opens the whole catalogue to pick from:

```sh
npx jsrepo add dialog button
npx jsrepo add --registry @implementjs/ui
```

Where the files land is `paths` in your `jsrepo.config.ts`. Every component in this registry is typed `ui`, so one entry places all of them; [`cn`](#merging-classes) is a `lib`:

```ts
import { defineConfig } from "jsrepo";

export default defineConfig({
	paths: {
		ui: "src/lib/components/ui",
		lib: "src/lib",
	},
});
```

Those two are free to point anywhere — jsrepo rewrites each component's import of `cn` to match where you put them.

The type is the only thing the old `<category>/<name>` specifier is still good for. In jsrepo v3 it decides the destination directory and stays out of the command.

jsrepo resolves the dependencies between items itself. Asking for `select` brings `dropdown-menu` with it, because the select's group heading reuses its classes; asking for `dialog` brings `button`. The npm dependencies a component needs are installed at the same time.

Updating later is `npx jsrepo update`, which diffs the registry against your copy and lets you take or skip each change — your edits are not overwritten behind your back.

<div data-tab="Manual"></div>

Every component is one file with no build step, so a manual install is a copy and a paste. Each component page has its source under **Installation → Manual**: copy it to the path shown, then install whatever that page lists under dependencies.

Two things to get right:

- **`utils.ts` first.** Every component imports `cn`, so copy that file to `src/lib/utils.ts` before anything else — its source is under [Merging classes](#merging-classes). The components on this site import it as `@/lib/utils`; the CLI rewrites that to a relative path, so rewrite it yourself if your project has no `@/` alias.
- **Local imports.** A component that builds on another imports it as `./button` — keep the files in one directory and those resolve on their own.
- **The `@/` alias.** The demos on this site import `@/lib/components/ui/button`. That is the docs app's own alias for `src`; if your project does not have one, rewrite the specifier to a relative path.

<div data-tabs-end></div>

## Where to next

- [Button](/ui/button) — the variant table the rest of the registry borrows.
- [Accordion](/ui/accordion) — the shape every page follows: a live demo, how to install it, how to use it, and the API.
- [Primitives](/primitives) — the behavior layer underneath, and the full prop and `data-*` reference for each part.
- [Lucide](/lucide) — the icon set the components draw with.
