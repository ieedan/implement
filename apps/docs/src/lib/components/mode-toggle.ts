import { ImplementLifecycle, signal, Span, type Mountable } from "@implementjs/core";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@implementjs/lucide";
import { isMode } from "@implementjs/mode-watcher";
import { mode } from "@/lib/mode";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/** The check that marks the mode currently chosen. */
function CheckMark() {
	return CheckIcon({
		"aria-hidden": true,
		class: "ml-auto size-4 hidden group-data-[state=checked]/menu-item:block",
	});
}

/**
 * The site's light/dark switcher. Reads and writes the shared
 * [mode manager](@/lib/mode); `ModeWatcher` in the root layout is what turns
 * a choice into a class on `<html>`.
 */
export function ModeToggle(): Mountable {
	// the menu wants a signal it can write; the manager owns the value, so the
	// two are kept in step (`set` ignores no-op writes, so this settles at once)
	const preference = signal<string | null>(mode.userPrefersMode.get());
	preference.onChange((value) => {
		if (isMode(value)) mode.setMode(value);
	});

	return ImplementLifecycle(
		{ onMount: () => mode.userPrefersMode.subscribe((value) => preference.set(value)) },
		DropdownMenu(
			DropdownMenuTrigger(
				{ variant: "ghost", size: "icon-sm", "aria-label": "Change theme" },
				// which icon shows follows the class ModeWatcher puts on <html>, so
				// it is right on the first paint rather than after hydration
				SunIcon({ class: "dark:hidden", "aria-hidden": true }),
				MoonIcon({ class: "hidden dark:block", "aria-hidden": true }),
			),
			DropdownMenuContent(
				{ align: "end", class: "min-w-36" },
				// every row already leads with its own icon, so the radio dot reads as
				// clutter: it is hidden along with the gutter it sat in, and the choice is
				// marked by a check at the end of the row instead
				DropdownMenuRadioGroup(
					{ value: preference },
					DropdownMenuRadioItem(
						{ value: "light", class: "pl-2! [&>[data-slot=menu-item-indicator]]:hidden" },
						SunIcon({ class: "size-4", "aria-hidden": true }),
						Span("Light"),
						CheckMark(),
					),
					DropdownMenuRadioItem(
						{ value: "dark", class: "pl-2! [&>[data-slot=menu-item-indicator]]:hidden" },
						MoonIcon({ class: "size-4", "aria-hidden": true }),
						Span("Dark"),
						CheckMark(),
					),
					DropdownMenuRadioItem(
						{ value: "system", class: "pl-2! [&>[data-slot=menu-item-indicator]]:hidden" },
						MonitorIcon({ class: "size-4", "aria-hidden": true }),
						Span("System"),
						CheckMark(),
					),
				),
			),
		),
	);
}
