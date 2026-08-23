import { signal } from "@implementjs/core";
import {
	DropdownMenu,
	DropdownMenuCheckboxGroup,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuGroupHeading,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/lib/components/ui/dropdown-menu";

export default function DropdownMenuDemo() {
	const showStatusBar = signal(true);
	const position = signal<string | null>("bottom");
	const visible = signal(["activity-bar"]);

	return DropdownMenu(
		DropdownMenuTrigger("Open menu"),
		DropdownMenuContent(
			{ class: "w-56" },
			DropdownMenuGroup(
				DropdownMenuGroupHeading("My Account"),
				DropdownMenuItem({ onSelect: () => console.log("profile") }, "Profile"),
				DropdownMenuItem({ onSelect: () => console.log("billing") }, "Billing"),
				DropdownMenuItem({ disabled: true }, "Settings"),
			),
			DropdownMenuSub(
				DropdownMenuSubTrigger("Invite people"),
				DropdownMenuSubContent(
					DropdownMenuItem({ onSelect: () => console.log("email") }, "Email"),
					DropdownMenuItem({ onSelect: () => console.log("message") }, "Message"),
					DropdownMenuSeparator(),
					DropdownMenuItem({ onSelect: () => console.log("invite-link") }, "Copy invite link"),
				),
			),
			DropdownMenuSeparator(),
			DropdownMenuCheckboxItem({ checked: showStatusBar, closeOnSelect: false }, "Status bar"),
			DropdownMenuSeparator(),
			DropdownMenuCheckboxGroup(
				{ value: visible },
				DropdownMenuGroupHeading("Panels"),
				DropdownMenuCheckboxItem({ value: "activity-bar", closeOnSelect: false }, "Activity bar"),
				DropdownMenuCheckboxItem({ value: "terminal", closeOnSelect: false }, "Terminal"),
			),
			DropdownMenuSeparator(),
			DropdownMenuRadioGroup(
				{ value: position },
				DropdownMenuGroupHeading("Panel position"),
				DropdownMenuRadioItem({ value: "top" }, "Top"),
				DropdownMenuRadioItem({ value: "bottom" }, "Bottom"),
				DropdownMenuRadioItem({ value: "right" }, "Right"),
			),
		),
	);
}
