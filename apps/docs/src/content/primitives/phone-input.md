---
title: Phone Input
description: A phone number field that formats as you type and knows its country.
section: Components
---

<div data-demo="phone-input"></div>

A phone input formats a number as it is typed and keeps two things in sync: the **country** and the **number** in E.164 form (`+15551234567`), the one shape a server can store and compare. Parsing and formatting come from [libphonenumber-js](https://gitlab.com/catamphetamine/libphonenumber-js), which ships with the primitives.

The primitive owns the field only. The country picker is yours to build — see [Building a country picker](#building-a-country-picker) — and [the styled version](/ui/phone-input) brings one.

```ts
import { PhoneInput, PhoneInputField } from "@implementjs/primitives";

PhoneInput({ country: "US", name: "phone" }, PhoneInputField({ placeholder: "(555) 123-4567" }));
```

Each part accepts optional props and children — pass a props object when you need attributes, or pass children directly. See [createComponent](/primitives/docs/create-component). Extra props are forwarded onto the underlying `Div` or `Input`.

## Country and value

Both take a string to seed them or a [signal](/docs/signals) to control and observe them:

```ts
const country = signal<CountryCode | null>("US");
const value = signal("");

PhoneInput({ country, value, onValueChange: (e164) => save(e164) }, PhoneInputField());
```

With a country set, the field shows the number in national form — `(213) 373-4253` — and `value` holds `+12133734253`. Write to `value` from outside and the field redraws to match.

## Detecting the country

Type a number starting with `+` and the country is read from it: `+44 7400 123456` sets `country` to `"GB"`. With no country selected and no leading `+`, there is no way to know what the digits mean, so `value` stays empty.

## Validity

`valid` receives `true` when the number is complete and valid for its country, and `false` while it is not. An empty field counts as valid, so pair it with `required` or your own check when a number is mandatory. The root also sets `data-valid="false"` while it is not.

## Forms

Pass `name` to the root and the E.164 number submits with its form in a hidden input. The visible field is `type="tel"` with `autocomplete="tel"`.

## Building a country picker

`getPhoneCountries(locale)` lists every country as `{ code, name, dialCode }`, sorted by name. `PhoneInputContext.Use` hands you the state of the nearest root: set `country` with `state.setCountry(code)`, which keeps the digits already typed and moves them to the new country's calling code.

```ts
import { getPhoneCountries, PhoneInputContext } from "@implementjs/primitives";

PhoneInputContext.Use((state) =>
	Select(
		{ onChange: (e) => state.setCountry(e.currentTarget.value) },
		...getPhoneCountries().map((c) => Option({ value: c.code }, c.name)),
	),
);
```

`state.country`, `state.value`, `state.valid`, and `state.disabled` are readable, and `state.focus()` returns focus to the field — useful after a picker closes.

## API Reference

<div data-api="phone-input"></div>
