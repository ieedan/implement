import { Div, P, signal } from "@implementjs/core";
import {
	CalculatorIcon,
	CalendarIcon,
	CreditCardIcon,
	SettingsIcon,
	SmileIcon,
	UserIcon,
	type IconComponent,
} from "@implementjs/lucide";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandGroupHeading,
	CommandGroupItems,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandViewport,
} from "@/lib/components/ui/command";

export default function CommandDemo() {
	const lastSelected = signal<string | null>(null);

	const item = (value: string, icon: IconComponent) =>
		CommandItem(
			{ value, onSelect: () => lastSelected.set(value) },
			icon({ class: "text-muted-foreground", "aria-hidden": true }),
			value,
		);

	return Div(
		{ class: "flex w-full max-w-md flex-col items-center gap-3" },
		Command(
			{ label: "Command menu", class: "rounded-lg border shadow-md" },
			CommandInput({ placeholder: "Type a command or search..." }),
			CommandList(
				CommandViewport(
					CommandEmpty("No results found."),
					CommandGroup(
						{ value: "suggestions" },
						CommandGroupHeading("Suggestions"),
						CommandGroupItems(
							item("Calendar", CalendarIcon),
							item("Search Emoji", SmileIcon),
							item("Calculator", CalculatorIcon),
						),
					),
					CommandSeparator(),
					CommandGroup(
						{ value: "settings" },
						CommandGroupHeading("Settings"),
						CommandGroupItems(
							item("Profile", UserIcon),
							item("Billing", CreditCardIcon),
							item("Settings", SettingsIcon),
						),
					),
				),
			),
		),
		P(
			{ class: "text-sm text-muted-foreground" },
			lastSelected.bind((value) => (value == null ? "Nothing selected yet" : `Selected: ${value}`)),
		),
	);
}
