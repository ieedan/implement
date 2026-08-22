---
title: no-signal-condition
description: A signal tested for truth is an object, so the branch never changes.
section: Rules
order: 12
---

A signal is an object, and every object is truthy. So a signal in a condition always takes the same branch — forever, silently, with no type error to warn you:

```ts
const open = signal(false);

// always "Close": `open` is an object, so the test is always true
const label = open ? "Close" : "Open";
```

The rule reports a signal tested for truth in any position where that goes wrong — a ternary, an `if`, a `while`, a `!`, and the left side of `&&` or `||`. The fix is to test the _value_, which is what [`bind`](/docs/bindings) is for:

```ts
const label = open.bind((o) => (o ? "Close" : "Open"));
```

Or, if you genuinely wanted a one-off non-reactive check, say so with `open.get()`.

It reports only when it can prove the value is a signal, from a factory call at the declaration (`signal`, `derived`, `ImplementSet`, `ImplementMap`, or a `.bind()` off another signal) or from a type annotation (`Signal`, `Readable`, `Writable`, `Derived`). A signal it cannot recognise is left alone.

> [!NOTE]
> `??` is not reported. A signal is never nullish, so `sig ?? fallback` is a different mistake — and one this rule does not claim to catch.
