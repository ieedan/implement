import {
	Html,
	ImplementEffect,
	isReadable,
	signal,
	Span,
	type Child,
	type ComponentProps,
	type Readable,
} from "@implementjs/core";
import { CheckIcon, ChevronsUpDownIcon } from "@implementjs/lucide";
import {
	createComponent,
	getPhoneCountries,
	PhoneInput as PhoneInputPrimitive,
	PhoneInputContext,
	PhoneInputField,
	type CountryCode,
	type PhoneCountry,
	type PhoneInputFieldProps,
} from "@implementjs/primitives";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./command";
import { Popover, PopoverContent, PopoverPortal, PopoverTrigger } from "./popover";

export { getPhoneCountries } from "@implementjs/primitives";
export type { CountryCode, PhoneCountry } from "@implementjs/primitives";

export type PhoneInputProps = ComponentProps<typeof PhoneInputPrimitive> & {
	placeholder?: string;
	/** Props for the number field — an `aria-label`, `aria-invalid`, or an event handler. */
	inputProps?: PhoneInputFieldProps;
	/** The countries to offer, in the order to show them. Defaults to every country, by name. */
	countries?: PhoneCountry[];
};

let flagIcons: Promise<Record<string, string>> | null = null;

/** The flag SVGs are large, so they load the first time one is drawn. */
function loadFlags() {
	flagIcons ??= import("country-flag-icons/string/3x2").then((module) => ({ ...module }));
	return flagIcons;
}

function Flag(country: Readable<CountryCode | null> | CountryCode | null) {
	const svg = signal("");
	const code = isReadable(country) ? country : signal(country);
	return Span(
		{
			"data-slot": "phone-input-flag",
			class: "flex h-4 w-6 shrink-0 overflow-clip rounded-sm bg-foreground/20 [&>svg]:h-full! [&>svg]:w-full!",
		},
		ImplementEffect([code], (current) => {
			if (current === null) {
				svg.set("");
				return;
			}
			void loadFlags().then((icons) => {
				if (code.get() === current) svg.set(icons[current] ?? "");
			});
		}),
		// the SVGs come from the country-flag-icons package, never from user input
		// oxlint-disable-next-line implementjs/no-html
		Html(svg),
	);
}

function CountrySelect(countries: PhoneCountry[]) {
	return PhoneInputContext.Use((state) => {
		const open = signal(false);
		return Popover(
			{ open },
			PopoverTrigger(
				{
					variant: "outline",
					"aria-label": "Select country",
					disabled: state.disabled,
					class: "shrink-0 gap-1 rounded-r-none px-3",
				},
				Flag(state.country),
				ChevronsUpDownIcon({ class: "-mr-1 size-4 opacity-50", "aria-hidden": true }),
			),
			PopoverPortal(
				PopoverContent(
					{ class: "w-[300px] p-0" },
					Command(
						{ label: "Country" },
						CommandInput({ placeholder: "Search..." }),
						CommandList(
							CommandEmpty("No country found."),
							...countries.map((country) =>
								CommandItem(
									{
										value: country.name,
										keywords: [country.code, country.dialCode],
										onSelect: () => {
											state.setCountry(country.code);
											open.set(false);
											// after the popover hands focus back to its trigger
											setTimeout(() => state.focus(), 0);
										},
									},
									Flag(country.code),
									Span({ class: "flex-1 truncate" }, country.name),
									Span({ class: "text-muted-foreground" }, `+${country.dialCode}`),
									CheckIcon({
										class: state.country.bind((current) =>
											cn("size-4", current === country.code ? "opacity-100" : "opacity-0"),
										),
										"aria-hidden": true,
									}),
								),
							),
						),
					),
				),
			),
		);
	});
}

export const PhoneInput = createComponent(function PhoneInput(
	{ class: className, placeholder, inputProps, countries, ...props }: PhoneInputProps,
	...children: Child[]
) {
	const list = countries ?? getPhoneCountries();
	return PhoneInputPrimitive(
		{ ...props, "data-slot": "phone-input", class: cn("flex items-center", className) },
		CountrySelect(list),
		PhoneInputField({
			placeholder,
			...inputProps,
			"data-slot": "phone-input-field",
			class: cn(
				"relative -ml-px flex h-9 w-full min-w-0 rounded-l-none rounded-r-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
				"placeholder:text-muted-foreground",
				"selection:bg-primary selection:text-primary-foreground",
				"focus-visible:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"dark:bg-input/30",
				inputProps?.class,
			),
		}),
		...children,
	);
});
