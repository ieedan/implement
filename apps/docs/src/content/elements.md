---
title: Elements & Props
description: Typed element factories, reactive props, class values, styles, events, and two-way form bindings.
order: 2
---

Every HTML element has a factory named after its tag: `Div`, `Span`, `Button`, `Input`, `A`, `Table`, and so on — all 100+ of them, exported from the package root.

```ts
import { A, Button, Div, Input, P } from "@packages/implement";
```

A factory takes an optional props object first, then children:

```ts
Div({ class: "card" }, H2("Title"), P("Body text"));

// props are optional
Div("just text");
```

Void elements (`Input`, `Img`, `Br`, `Hr`, …) accept no children — the type system enforces it.

## Every prop is bindable

Props are typed per tag (`href` on `A`, `disabled` on `Button`, `placeholder` on `Input`, …) and every one of them accepts either a plain value or a `Readable` of that value. Pass a signal and the DOM updates when it changes; pass a plain value and it is set once.

```ts
const disabled = derived([title], (t) => t.trim() === "");

Button({ disabled, type: "submit" }, "Save");
Img({ src: url, alt: "avatar", loading: "lazy" });
```

`aria-*` and `data-*` attributes are typed and bindable too, and enumerated attributes (`type`, `rel`, `target`, `role`, `autocomplete`, …) autocomplete their keyword values:

```ts
Div({ role: "status", "aria-live": "polite", "data-state": state });
```

## Class

`class` (or `className`) takes a clsx-style value: strings, `{ name: condition }` objects, and arrays of either, nested arbitrarily. Falsy entries are skipped, and a `Readable` fits anywhere a value does — the class list re-resolves when any of them change.

```ts
Div({ class: "btn" });
Div({ class: ["btn", { active: isActive }, large && "btn-lg"] });
Div({ class: derived([kind], (k) => `alert alert-${k}`) });
```

## Style

`style` takes a string, a `Readable<string>`, or an object keyed by camelCase CSS property. Custom properties use their literal `--name`, and every value can be a `Readable`.

```ts
Div({ style: { color: "red", backgroundColor: bg, "--offset": offset } });
```

## Events

Event handlers use `on` + capitalized event name: `onClick`, `onInput`, `onKeydown`, `onSubmit`, … Handlers are typed per element — `event.target` and `event.currentTarget` are the element's own type, no casting needed.

```ts
Input({
	onInput(event) {
		console.log(event.target.value); // event.target is HTMLInputElement
	},
});
```

A handler prop can itself be a `Readable` of a function; the listener is swapped when it changes. For `window`/`document` listeners see [Window & Document](/docs/global-events).

## Two-way form bindings

A few props are two-way: pass a **writable** signal and the framework both applies the signal to the DOM and writes user input back into the signal.

| Element                  | Prop      | DOM event |
| ------------------------ | --------- | --------- |
| `Input`, `Textarea`      | `value`   | `input`   |
| `Select`                 | `value`   | `change`  |
| `Input` (checkbox/radio) | `checked` | `change`  |
| `Details`, `Dialog`      | `open`    | `toggle`  |

```ts
const title = signal("");
const done = signal(false);

Input({ value: title, placeholder: "Title" });
Input({ type: "checkbox", checked: done });
```

Passing a read-only `Readable` (or a plain value) makes the same props one-way. `Select` re-applies `value` after its options mount, so an initial value always finds its `Option`.

## Element references

The `this` prop binds the mounted DOM node into a `Ref` (a writable signal that starts as `null`):

```ts
import { Ref } from "@packages/implement";

const input = new Ref<HTMLInputElement>();

Div(Input({ this: input }), Button({ onClick: () => input.get()?.focus() }, "Focus"));
```

The ref is written right after the node is appended to its parent and set back to `null` on unmount. The node may not be connected to the document yet when it is written (ancestors append after children) — to measure or focus once everything is connected, use [`Implement.Lifecycle`](/docs/lifecycle).

## textContent

`textContent` sets the element's entire text as a prop, useful when the text is the only child and you want it bindable without a child position:

```ts
Span({ textContent: label });
```

## Other tags

`element(tag)` builds a factory for any tag name in `HTMLElementTagNameMap` — it is how the built-in factories are generated — and `component(tag, props, ...children)` is the underlying call they all delegate to:

```ts
import { component, element } from "@packages/implement";

const Custom = element("my-element" as keyof HTMLElementTagNameMap);
const search = component("input", { type: "search" });
```
