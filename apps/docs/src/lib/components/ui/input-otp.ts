import { type Child, type ComponentProps } from "@implementjs/core";
import { MinusIcon } from "@implementjs/lucide";
import {
	InputOTP as InputOTPPrimitive,
	InputOTPGroup as InputOTPGroupPrimitive,
	InputOTPSlot as InputOTPSlotPrimitive,
	InputOTPSeparator as InputOTPSeparatorPrimitive,
} from "@implementjs/primitives";
import { createComponent } from "@implementjs/primitives";
import { cn } from "@implementjs/cn";

export {
	REGEXP_ONLY_DIGITS,
	REGEXP_ONLY_CHARS,
	REGEXP_ONLY_DIGITS_AND_CHARS,
} from "@implementjs/primitives";

export type InputOTPProps = ComponentProps<typeof InputOTPPrimitive>;
export type InputOTPGroupProps = ComponentProps<typeof InputOTPGroupPrimitive>;
export type InputOTPSlotProps = ComponentProps<typeof InputOTPSlotPrimitive>;
export type InputOTPSeparatorProps = ComponentProps<typeof InputOTPSeparatorPrimitive>;

export const InputOTP = createComponent(function InputOTP(
	{ class: className, ...props }: InputOTPProps,
	...children: Child[]
) {
	return InputOTPPrimitive(
		{
			...props,
			"data-slot": "input-otp",
			class: cn("group/otp flex items-center gap-2 data-[disabled]:opacity-50", className),
		},
		...children,
	);
});

export const InputOTPGroup = createComponent(function InputOTPGroup(
	{ class: className, ...props }: InputOTPGroupProps,
	...children: Child[]
) {
	return InputOTPGroupPrimitive(
		{ ...props, "data-slot": "input-otp-group", class: cn("flex items-center", className) },
		...children,
	);
});

export const InputOTPSlot = createComponent(function InputOTPSlot(
	{ class: className, ...props }: InputOTPSlotProps,
	...children: Child[]
) {
	return InputOTPSlotPrimitive(
		{
			...props,
			"data-slot": "input-otp-slot",
			class: cn(
				"relative flex size-9 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md",
				"data-[active]:z-10 data-[active]:border-ring data-[active]:ring-[3px] data-[active]:ring-ring/50",
				"group-has-[input[aria-invalid=true]]/otp:border-destructive group-has-[input[aria-invalid=true]]/otp:data-[active]:ring-destructive/20",
				"[&>[data-input-otp-caret]]:pointer-events-none [&>[data-input-otp-caret]]:absolute [&>[data-input-otp-caret]]:h-4 [&>[data-input-otp-caret]]:w-px [&>[data-input-otp-caret]]:animate-pulse [&>[data-input-otp-caret]]:bg-foreground [&>[data-input-otp-caret][data-state=hidden]]:hidden",
				"dark:bg-input/30",
				className,
			),
		},
		...children,
	);
});

export const InputOTPSeparator = createComponent(function InputOTPSeparator(
	{ class: className, ...props }: InputOTPSeparatorProps,
	...children: Child[]
) {
	return InputOTPSeparatorPrimitive(
		{ ...props, "data-slot": "input-otp-separator", class: cn(className) },
		...(children.length > 0 ? children : [MinusIcon({ "aria-hidden": true, class: "size-4" })]),
	);
});
