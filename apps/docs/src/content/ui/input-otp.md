---
title: Input OTP
description: A one-time code field with a slot per character.
section: Components
---

<div data-demo="input-otp" data-demo-description="A six-digit code split in two groups, accepting digits only, with what you have typed echoed beneath it."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/input-otp
```

It installs `@implementjs/lucide` at the same time.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/input-otp.ts`. It imports `cn`, so copy [`utils.ts`](/ui#merging-classes) to `src/lib/utils.ts` too. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide
```

<div data-source="input-otp"></div>

<div data-tabs-end></div>

## Usage

Lay out a slot for every character, in as many groups as you like. The caret blinks with Tailwind's built-in `animate-pulse`, so there are no keyframes to add.

```ts
import { signal } from "@implementjs/core";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
	REGEXP_ONLY_DIGITS,
} from "@/lib/components/ui/input-otp";

const value = signal("");

InputOTP(
	{ value, maxLength: 6, pattern: REGEXP_ONLY_DIGITS, onComplete: (code) => verify(code) },
	InputOTPGroup(...[0, 1, 2].map((index) => InputOTPSlot({ index }))),
	InputOTPSeparator(),
	InputOTPGroup(...[3, 4, 5].map((index) => InputOTPSlot({ index }))),
);
```

## Invalid

Pass `aria-invalid` to the real input and the slots take the destructive border:

```ts
InputOTP({ inputProps: { "aria-invalid": true } } /* slots */);
```

## API Reference

Every prop the styling does not consume is forwarded to the [Input OTP primitive](/primitives/docs/input-otp), so the tables below are the whole surface.

<div data-api="ui-input-otp"></div>
