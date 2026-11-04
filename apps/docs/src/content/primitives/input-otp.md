---
title: Input OTP
description: Enter a one-time code, one character to a slot.
section: Components
---

<div data-demo="input-otp"></div>

An input OTP draws a code as a row of slots, but the typing happens in one real `input` laid invisibly over them. That keeps everything a browser does for free — paste, autofill from an SMS, mobile keyboards, selection, form submission — while the slots are only a picture of what is in it.

```ts
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@implementjs/primitives";

InputOTP(
	{ maxLength: 6 },
	InputOTPGroup(...[0, 1, 2].map((index) => InputOTPSlot({ index }))),
	InputOTPSeparator("-"),
	InputOTPGroup(...[3, 4, 5].map((index) => InputOTPSlot({ index }))),
);
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div`s; the real input takes `id`, `name`, `required`, `disabled`, `inputMode`, and `inputProps`. Slots take a zero-based `index`, and you lay out as many as `maxLength`.

## Value

`value` defaults to `""`. Pass a string to seed it, or a [signal](/docs/signals) to control it from outside:

```ts
const code = signal("");

InputOTP({ value: code, maxLength: 6, onComplete: (code) => verify(code) } /* slots */);
```

`onValueChange` reports the code after each change, and `onComplete` runs once the last slot has been filled — a natural place to submit.

## Restricting characters

`pattern` is what the whole value must match, as a `RegExp` or its source. A keystroke or paste that would break it is refused and the code stays as it was. Three ready-made patterns are exported:

```ts
import { InputOTP, REGEXP_ONLY_DIGITS } from "@implementjs/primitives";

InputOTP({ maxLength: 6, pattern: REGEXP_ONLY_DIGITS } /* slots */);
```

`REGEXP_ONLY_DIGITS`, `REGEXP_ONLY_CHARS`, and `REGEXP_ONLY_DIGITS_AND_CHARS`. Without a pattern anything goes. `inputMode` defaults to `"numeric"`; pass `"text"` for codes with letters.

## Forms

Pass `name` and the code submits with its form like any input. The input has `autocomplete="one-time-code"`, so a phone can offer the code it just received.

## Keyboard

The slot the next character lands in is the active one, and the input keeps its selection there: clicking or arrowing never strands the cursor in the middle of the code. Typing fills slots left to right, Backspace removes the last character, and once the code is full, typing replaces the last slot.

## Accessibility

The real input is the one control, so a screen reader meets a text field holding the code. Slots are `aria-hidden`. The default `aria-label` is `"One-time code"`; pass your own through `inputProps`, or give the input an `id` and point a label at it.

## Styling

The root sets `data-input-otp-root` (and `data-focused`, `data-disabled`). A slot sets `data-input-otp-slot` with `data-index`, `data-active`, `data-filled`, and `data-disabled`. Inside it sit a `data-input-otp-char` and a `data-input-otp-caret` whose `data-state` is `"visible"` only while the slot is active and empty — style that to draw your own caret.

## API Reference

<div data-api="input-otp"></div>
