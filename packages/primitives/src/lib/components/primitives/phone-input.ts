import {
	context,
	Div,
	ImplementEffect,
	Input,
	ref,
	signal,
	type Child,
	type ComponentProps,
	type ElementProps,
	type Readable,
	type Ref,
	type Signal,
} from "@implementjs/core";
import {
	AsYouType,
	getCountries,
	getCountryCallingCode,
	parsePhoneNumberFromString,
	type CountryCode,
} from "libphonenumber-js/min";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";

export type { CountryCode };

export type PhoneCountry = {
	/** The ISO 3166-1 alpha-2 code, like `"US"`. */
	code: CountryCode;
	/** The country's name in the requested language. */
	name: string;
	/** The calling code without the plus, like `"1"`. */
	dialCode: string;
};

/**
 * Every country a phone number can belong to, sorted by name.
 *
 * @param locale The language for the names. Defaults to English.
 */
export function getPhoneCountries(locale = "en"): PhoneCountry[] {
	const names = new Intl.DisplayNames([locale], { type: "region" });
	return getCountries()
		.map((code) => ({
			code,
			name: names.of(code) ?? code,
			dialCode: getCountryCallingCode(code),
		}))
		.toSorted((a, b) => a.name.localeCompare(b.name, locale));
}

export type PhoneInputRootProps = ComponentProps<typeof Div> & {
	/** The selected country. Pass a signal to control it from outside. */
	country?: Signal<CountryCode | null> | CountryCode | null;
	/** Runs whenever the country changes, whether picked or detected from a typed `+`. */
	onCountryChange?: ChangeHandler<CountryCode | null>;
	/** The number in E.164 form, like `"+15551234567"`. Pass a signal to control it from outside. */
	value?: Signal<string> | string;
	/** Runs whenever the number changes. */
	onValueChange?: ChangeHandler<string>;
	/** Whether the number is complete and valid for its country. Pass a signal to observe it. */
	valid?: Signal<boolean>;
	disabled?: Readable<boolean> | boolean;
	readOnly?: boolean;
	/** Submits the E.164 number with a form under this name. */
	name?: string;
};

const PhoneInputCtx = context<PhoneInputState>("PhoneInputCtx");

/** The state behind a phone input, for building your own country picker. */
export class PhoneInputState {
	country: Signal<CountryCode | null>;
	value: Signal<string>;
	valid: Signal<boolean>;
	disabled: Readable<boolean>;
	readonly input: Ref<HTMLInputElement> = ref<HTMLInputElement>();
	/** The last `country` and `value` the field itself produced, so it can tell outside writes apart. */
	private emitted: { country: CountryCode | null; value: string };

	constructor(
		country: Signal<CountryCode | null> | CountryCode | null,
		value: Signal<string> | string,
		valid: Signal<boolean> | undefined,
		disabled: Readable<boolean> | boolean,
		readonly readOnly: boolean,
	) {
		this.country = signal(country);
		this.value = signal(value);
		this.valid = valid ?? signal(true);
		this.disabled = toReadable(disabled);
		this.emitted = { country: this.country.get(), value: this.value.get() };
	}

	/** What the field shows for the current country and number. */
	display(): string {
		const value = this.value.get();
		const country = this.country.get();
		if (value === "") return "";
		if (country === null) return new AsYouType().input(value);
		const prefix = `+${getCountryCallingCode(country)}`;
		const national = value.startsWith(prefix) ? value.slice(prefix.length) : value.slice(1);
		return new AsYouType(country).input(national);
	}

	/** Takes what was typed: formats it, and reads the number and country out of it. */
	onInput(el: HTMLInputElement) {
		const raw = el.value;
		const country = this.country.get();
		const international = raw.trimStart().startsWith("+");
		const formatter = international || country === null ? new AsYouType() : new AsYouType(country);
		const formatted = formatter.input(raw);
		const detected = international ? (formatter.getCountry() ?? null) : country;
		const value = international || country !== null ? (formatter.getNumberValue() ?? "") : "";

		// keep the caret after the same number of digits it was after before
		const caret = el.selectionStart ?? raw.length;
		const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
		const atEnd = caret >= raw.length;

		if (el.value !== formatted) el.value = formatted;
		if (!atEnd) {
			let seen = 0;
			let position = 0;
			while (position < formatted.length && seen < digitsBefore) {
				if (/\d/.test(formatted[position]!)) seen++;
				position++;
			}
			el.setSelectionRange(position, position);
		}

		this.emitted = { country: detected, value };
		this.country.set(detected);
		this.value.set(value);
		this.valid.set(this.isValid(value));
	}

	/** Picks a country, keeping the digits already typed. */
	setCountry(next: CountryCode | null) {
		const previous = this.country.get();
		if (previous === next) return;
		const value = this.value.get();
		let national = "";
		if (value !== "") {
			const prefix = previous === null ? "" : `+${getCountryCallingCode(previous)}`;
			national = value.startsWith(prefix) ? value.slice(prefix.length) : value.slice(1);
		}
		const nextValue =
			next !== null && national !== "" ? `+${getCountryCallingCode(next)}${national}` : "";
		this.country.set(next);
		this.value.set(nextValue);
		this.refresh();
	}

	/** Redraws the field after the country or number moved from outside. */
	refresh() {
		const el = this.input.get();
		const value = this.value.get();
		const country = this.country.get();
		const outside = this.emitted.value !== value || this.emitted.country !== country;
		if (!outside) return;
		this.emitted = { country, value };
		const display = this.display();
		if (el && el.value !== display) el.value = display;
		this.valid.set(this.isValid(value));
	}

	/** An empty field counts as valid; a number must be complete for its country. */
	private isValid(value: string): boolean {
		return value === "" || (parsePhoneNumberFromString(value)?.isValid() ?? false);
	}

	focus() {
		this.input.get()?.focus();
	}
}

export const PhoneInput = createComponent(function PhoneInput(
	{
		country = null,
		onCountryChange,
		value = "",
		onValueChange,
		valid,
		disabled = false,
		readOnly = false,
		name,
		...restProps
	}: PhoneInputRootProps,
	...children: Child[]
) {
	const state = new PhoneInputState(country, value, valid, disabled, readOnly);

	return PhoneInputCtx.Provide(state).To(
		...changeEffect(state.country, onCountryChange),
		...changeEffect(state.value, onValueChange),
		ImplementEffect([state.country, state.value], () => state.refresh(), { immediate: false }),
		Div(
			mergeProps(
				{
					"data-phone-input-root": "",
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-valid": state.valid.bind((valid) => (valid ? undefined : "false")),
				},
				restProps,
			),
			...children,
			name === undefined
				? null
				: Input({ type: "hidden", name, value: state.value, disabled: state.disabled }),
		),
	);
});

export type PhoneInputFieldProps = ElementProps<"input">;

/** The text field. It formats as you type and sets the root's number and country. */
export const PhoneInputField = createComponent(function PhoneInputField({
	id = getId(),
	...restProps
}: PhoneInputFieldProps) {
	return PhoneInputCtx.Use((state) =>
		Input(
			mergeProps(
				{
					id,
					this: state.input,
					type: "tel" as const,
					autocomplete: "tel" as const,
					disabled: state.disabled,
					readOnly: state.readOnly,
					value: state.display(),
					"data-phone-input-field": "",
					onInput: (e: Event) => {
						if (e.currentTarget instanceof HTMLInputElement) state.onInput(e.currentTarget);
					},
				},
				restProps,
			),
		),
	);
});

/** The state of the nearest phone input, for parts you write yourself. */
export const PhoneInputContext = PhoneInputCtx;
