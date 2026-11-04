---
"@implementjs/primitives": patch
"@implementjs/ui": patch
---

Add `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, and `InputOTPSeparator` to the primitives, and a styled `input-otp` to the `@implementjs/ui` registry. One real input takes the typing, pasting, and autofill while the slots draw the code, with `pattern`, `onComplete`, and `REGEXP_ONLY_*` helpers.
