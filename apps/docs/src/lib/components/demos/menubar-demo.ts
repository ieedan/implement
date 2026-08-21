import { signal } from "@implementjs/core";
import {
	Menubar,
	MenubarCheckboxItem,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarRadioGroup,
	MenubarRadioItem,
	MenubarSeparator,
	MenubarTrigger,
} from "@/lib/components/ui/menubar";

export default function MenubarDemo() {
	const wordWrap = signal(true);
	const theme = signal<string | null>("system");

	return Menubar(MenubarMenu(
			{ value: "file" },
			MenubarTrigger("File"),
			MenubarContent(
				{ class: "w-48" },
				MenubarItem({ onSelect: () => console.log("new") }, "New file"),
				MenubarItem({ onSelect: () => console.log("open") }, "Open…"),
				MenubarSeparator(),
				MenubarItem({ onSelect: () => console.log("save") }, "Save"),
				MenubarItem({ disabled: true }, "Save all"),
			),
		),
		MenubarMenu(
			{ value: "edit" },
			MenubarTrigger("Edit"),
			MenubarContent(
				{ class: "w-48" },
				MenubarItem({ onSelect: () => console.log("undo") }, "Undo"),
				MenubarItem({ onSelect: () => console.log("redo") }, "Redo"),
				MenubarSeparator(),
				MenubarItem({ onSelect: () => console.log("find") }, "Find…"),
			),
		),
		MenubarMenu(
			{ value: "view" },
			MenubarTrigger("View"),
			MenubarContent(
				{ class: "w-48" },
				MenubarCheckboxItem({ checked: wordWrap, closeOnSelect: false }, "Word wrap"),
				MenubarSeparator(),
				MenubarRadioGroup(
					{ value: theme },
					MenubarRadioItem({ value: "light" }, "Light"),
					MenubarRadioItem({ value: "dark" }, "Dark"),
					MenubarRadioItem({ value: "system" }, "System"),
				),
			),
		),
	);
}
