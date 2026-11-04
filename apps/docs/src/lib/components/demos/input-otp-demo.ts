import { Div, signal, Span } from "@implementjs/core";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
	REGEXP_ONLY_DIGITS,
} from "@/lib/components/ui/input-otp";

export default function InputOTPDemo() {
	const value = signal("");

	return Div(
		{ class: "flex flex-col items-center gap-2" },
		InputOTP(
			{
				value,
				maxLength: 6,
				pattern: REGEXP_ONLY_DIGITS,
				inputProps: { "aria-label": "Verification code" },
			},
			InputOTPGroup(...[0, 1, 2].map((index) => InputOTPSlot({ index }))),
			InputOTPSeparator(),
			InputOTPGroup(...[3, 4, 5].map((index) => InputOTPSlot({ index }))),
		),
		Span(
			{ class: "text-sm text-muted-foreground" },
			value.bind((v) => (v === "" ? "Enter your one-time code." : `You entered: ${v}`)),
		),
	);
}
