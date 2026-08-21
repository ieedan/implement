---
title: Styling
description: The classes on the html element, themes layered under the mode, and the transitions worth suppressing.
section: Guides
order: 20
---

The package puts classes on `<html>` and nothing else — the look is yours. With Tailwind, that is the `dark:` variant; with plain CSS, a `.dark` selector:

```css
:root {
	--background: white;
	--foreground: black;
}

.dark {
	--background: black;
	--foreground: white;
}
```

Tailwind resolves `dark:` from `prefers-color-scheme` by default, which ignores the visitor's choice. Point it at the class instead:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

`darkClassNames` and `lightClassNames` change which classes those are. Both are arrays, so a framework that wants `theme-dark` alongside `dark` can have both, and a light mode that needs its own marker class can add one:

```ts
createModeManager({
	darkClassNames: ["dark", "theme-dark"],
	lightClassNames: ["theme-light"],
});
```

`color-scheme` is set on `<html>` either way. It is what tells the browser to render scrollbars, form controls, and the space beyond the page in the matching shade, so those don't stay light while everything else goes dark.

## Themes

Dark and light are the mode. A theme is the palette underneath it, and the two are independent: `setTheme("mint")` writes `data-theme="mint"` on `<html>` and remembers it, in whichever mode the page happens to be in.

```css
[data-theme="mint"] {
	--primary: oklch(0.72 0.15 165);
}
```

`setTheme("")` removes the attribute. `defaultTheme` sets the one to start from.

## Browser chrome

`themeColors` keeps `<meta name="theme-color">` — the color mobile browsers paint their chrome with — in step with the mode:

```ts
createModeManager({ themeColors: { dark: "#0a0a0a", light: "#ffffff" } });
```

`ModeWatcher` renders the meta tag when the option is set, and the blocking script fills in the right color before the first paint.

## Transitions

A page that transitions its colors will animate every one of them at once when the mode flips, which reads as a smear rather than a change. The manager suppresses transitions for the duration of the swap and lifts the suppression on the next frame. `disableTransitions: false` keeps them if the smear is the point.
