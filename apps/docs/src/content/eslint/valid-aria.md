---
title: valid-aria
description: A misspelled aria attribute, or a value the attribute does not permit — neither of which the type catches.
section: Rules
order: 16
---

The `aria-*` props are typed as `` `aria-${string}` ``, which means the type system accepts any key that starts with `aria-` and any string, number, or boolean value. That is the right type — the alternative is a union that goes stale — but it means nothing checks your spelling.

This rule does. It reports an `aria-*` key that is not in [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#state_prop_def), offering the nearest real attribute as a suggestion:

```ts
Div({ "aria-lable": "Close" });
//     ^ "aria-lable" is not an ARIA attribute. Did you mean "aria-label"?
```

It also checks values against what the attribute actually permits — booleans, tristates, enumerated tokens, integers, and numbers:

```ts
Div({ "aria-hidden": "yes" }); //     Expected true or false.
Div({ "aria-current": "pge" }); //    Expected page, step, location, date, time, true, false.
Div({ "aria-level": 1.5 }); //        Expected an integer.
```

Attributes whose value is an id, a list of ids, or free text are not checked — the ids they point at usually live in another file.

Only **literal** values are judged. A [readable](/docs/signals) is a legal prop value and what it will yield is a runtime question, so anything that is not a literal is skipped:

```ts
// not reported — nobody knows what this yields until it runs
Div({ "aria-current": derived([router.location], (l) => (l.path === href ? "page" : undefined)) });
```

Two more things it deliberately leaves alone: destructuring an `aria-*` prop reads one rather than sets one, and a Tailwind variant inside a `class` string is a value, not a key.

```ts
const { "aria-label": label } = props; // fine
Div({ class: "aria-invalid:border-destructive" }); // fine
```

Deprecated attributes get their own message rather than a spelling suggestion, since the fix is to delete them:

```ts
Div({ "aria-dropeffect": "copy" });
//     ^ deprecated in ARIA 1.1 and does nothing in any browser
```

## Options

```ts
"implementjs/valid-aria": ["error", { extraAttributes: ["aria-magic"] }]
```

`extraAttributes` adds names the rule should accept — for a draft ARIA attribute, or one your own code reads off the DOM.
