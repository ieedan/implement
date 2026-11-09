---
title: Phone Input
description: A phone number field with a searchable country picker.
section: Components
---

<div data-demo="phone-input" data-demo-description="A US phone input; the number formats as you type and its E.164 form is echoed beneath."></div>

## Installation

<div data-tab="CLI"></div>

```sh
npx jsrepo add @implementjs/ui/phone-input
```

It installs `@implementjs/lucide` and `country-flag-icons` at the same time, plus the [popover](/ui/popover) and [command](/ui/command) components it is built from.

<div data-tab="Manual"></div>

Copy the file below to `src/lib/components/ui/phone-input.ts`, along with [`popover.ts`](/ui/popover) and [`command.ts`](/ui/command) (and what they need). It imports [`cn`](/ui#merging-classes) from `@implementjs/cn`. Then, on top of `@implementjs/core` and `@implementjs/primitives`:

```sh
npm install @implementjs/lucide country-flag-icons
```

<div data-source="phone-input"></div>

<div data-tabs-end></div>

## Usage

```ts
import { signal } from "@implementjs/core";
import { PhoneInput, type CountryCode } from "@/lib/components/ui/phone-input";

const country = signal<CountryCode | null>("US");
const value = signal("");

PhoneInput({ country, value, placeholder: "Enter a phone number" });
```

`value` is the number in E.164 form. Typing a number that starts with `+` picks its country for you.

## Countries

Offer fewer countries, or in your own order, by passing `countries`:

```ts
import { getPhoneCountries } from "@/lib/components/ui/phone-input";

const all = getPhoneCountries();
const first = ["US", "CA", "GB"];
const countries = [
	...all.filter((c) => first.includes(c.code)),
	...all.filter((c) => !first.includes(c.code)),
];

PhoneInput({ countries });
```

## Invalid

Pass `aria-invalid` to the number field and it takes the destructive border:

```ts
PhoneInput({ inputProps: { "aria-invalid": true } });
```

## API Reference

Every prop the styling does not consume is forwarded to the [Phone Input primitive](/primitives/docs/phone-input), so the tables below are the whole surface.

<div data-api="ui-phone-input"></div>
