---
title: Sidebar
description: A collapsible application sidebar, with an off-canvas sheet on mobile.
section: Components
---

<div data-demo="sidebar" data-demo-description="An app shell inside the demo box: a workspace sidebar with icon rows and badges, a header with a toggle, and a rail on its edge; collapsing it leaves a strip of icons with tooltips."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/sidebar
```

jsrepo pulls `button`, [`input`](/ui/input), [`separator`](/ui/separator), `sheet`, [`skeleton`](/ui/skeleton) and [`tooltip`](/ui/tooltip) along with it, and installs `@implementjs/lucide` and `tailwind-variants`.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/sidebar.ts`. It imports `button`, [`input`](/ui/input), [`separator`](/ui/separator), `sheet`, [`skeleton`](/ui/skeleton) and [`tooltip`](/ui/tooltip) from the same directory, so install those too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide tailwind-variants
```

<div data-source="sidebar"></div>

<div data-tabs-end></div>

## Usage

The largest component here, and the only one with real state. `SidebarProvider` owns whether the sidebar is open and hands it to every part through [context](/docs/context), so the trigger, the rail, and the inset stay in step without being wired to each other.

```ts
import {
	Sidebar,
	SidebarContent,
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/lib/components/ui/sidebar";

SidebarProvider(
	Sidebar({ collapsible: "icon" }, SidebarContent(/* groups and menus */)),
	SidebarInset(Header(SidebarTrigger()), Main(/* the page */)),
);
```

⌘B (Ctrl+B) toggles it. Pass `keyboardShortcut: false` to leave the chord alone.

## The CSS it needs

On top of the tokens in the [introduction](/ui), the sidebar has its own palette so it can sit a shade off the page without dragging every surface token with it:

```css
:root {
	--sidebar: #0a0a0a;
	--sidebar-foreground: #fff;
	--sidebar-primary: #fff;
	--sidebar-primary-foreground: #000;
	--sidebar-accent: #222;
	--sidebar-accent-foreground: #fff;
	--sidebar-border: #222;
	--sidebar-ring: #fff;
}

@theme inline {
	--color-sidebar: var(--sidebar);
	--color-sidebar-foreground: var(--sidebar-foreground);
	--color-sidebar-primary: var(--sidebar-primary);
	--color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
	--color-sidebar-accent: var(--sidebar-accent);
	--color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
	--color-sidebar-border: var(--sidebar-border);
	--color-sidebar-ring: var(--sidebar-ring);
}
```

The widths are variables too — `--sidebar-width`, `--sidebar-width-icon`, `--sidebar-width-mobile` — but every use of them carries a fallback, so the sidebar has a size before you have set any. Override them in `:root`, or per-layout from a class:

```ts
SidebarProvider({ class: "[--sidebar-width:20rem]" } /* ... */);
```

## Collapsing

`collapsible` decides what "closed" means:

- `offcanvas` — slides fully out of view. The default.
- `icon` — shrinks to a rail of icons. Labels, badges, actions, and submenus hide themselves.
- `none` — never collapses, and skips the state machinery entirely.

In `icon` mode a row is just a glyph, so give it a `tooltip`. It only appears while collapsed — an expanded sidebar already shows the label, and repeating it would be noise:

```ts
SidebarMenuButton({ tooltip: "Inbox" }, InboxIcon({ "aria-hidden": true }), Span("Inbox"));
```

## Rows that navigate

`SidebarMenuButton` is a button; `SidebarMenuLink` is an anchor with identical styling. They are separate components because the tooltip primitive's trigger is itself a button, so one component cannot be both — the same split as `CommandItem` and `CommandLinkItem`.

`tooltip` therefore belongs to the button form. A link row in an icon rail wants its label some other way — an `aria-label`, or `title`.

```ts
SidebarMenuItem(
	SidebarMenuLink(
		{ href: "/inbox", isActive: true },
		InboxIcon({ "aria-hidden": true }),
		Span("Inbox"),
	),
);
```

## Mobile

Below 768px the sidebar becomes a [sheet](/ui/dialog) — an off-canvas panel with the dialog's focus trap and dismissal — and `SidebarTrigger` opens that instead. The switch is a `matchMedia` listener in the provider, so it follows a resize, and a sheet left open on a phone closes itself when the layout goes back to a docked sidebar.

Server rendering has no viewport to measure, so the desktop tree is the one that prerenders and the client corrects on mount.

## Persisting the open state

There is no cookie and no `localStorage` here, on purpose: a static build cannot read either before it paints, so built-in persistence would only buy a flash of the wrong state. Instead `open` takes a signal, which makes persistence yours to place:

```ts
const open = signal(localStorage.getItem("sidebar") !== "closed");
open.subscribe((value) => localStorage.setItem("sidebar", value ? "open" : "closed"));

SidebarProvider({ open } /* ... */);
```

## Variants

`sidebar` sits flush against the edge. `floating` lifts it into a rounded card with its own border. `inset` keeps the sidebar flush and floats _the page_ beside it — `SidebarInset` picks that up on its own.

## API Reference

<div data-api="ui-sidebar"></div>
