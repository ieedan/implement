---
"@implementjs/primitives": patch
"@implementjs/ui": patch
---

Add `PhoneInput` and `PhoneInputField` to the primitives, and a styled `phone-input` to the `@implementjs/ui` registry. The field formats as you type, reports the number in E.164 form, and detects the country from a typed `+`; the styled version adds a searchable country picker with flags. Also exports `getPhoneCountries` and `PhoneInputContext` for building your own picker.
