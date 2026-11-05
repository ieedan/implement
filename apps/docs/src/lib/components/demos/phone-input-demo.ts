import { Div, signal, Span } from "@implementjs/core";
import { PhoneInput, type CountryCode } from "@/lib/components/ui/phone-input";

export default function PhoneInputDemo() {
	const value = signal("");
	const country = signal<CountryCode | null>("US");

	return Div(
		{ class: "flex w-full max-w-sm flex-col gap-2" },
		PhoneInput({ value, country, placeholder: "Enter a phone number" }),
		Span(
			{ class: "text-sm text-muted-foreground" },
			value.bind((v) => (v === "" ? "Enter a phone number." : `E.164: ${v}`)),
		),
	);
}
