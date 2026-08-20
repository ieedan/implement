import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "@/lib/components/ui/context-menu";

export default function ContextMenuDemo() {
	return ContextMenu(
		{},
		ContextMenuTrigger(
			{
				class:
					"flex h-36 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm select-none",
			},
			"Right click here",
		),
		ContextMenuContent(
			{ class: "w-52" },
			ContextMenuItem({ onSelect: () => console.log("back") }, "Back"),
			ContextMenuItem({ disabled: true }, "Forward"),
			ContextMenuItem({ onSelect: () => console.log("reload") }, "Reload"),
			ContextMenuSeparator({}),
			ContextMenuSub(
				{},
				ContextMenuSubTrigger({}, "Share"),
				ContextMenuSubContent(
					{ class: "w-44" },
					ContextMenuItem({ onSelect: () => console.log("share-email") }, "Email"),
					ContextMenuItem({ onSelect: () => console.log("share-message") }, "Message"),
					ContextMenuItem({ onSelect: () => console.log("share-link") }, "Copy link"),
				),
			),
			ContextMenuSeparator({}),
			ContextMenuItem({ onSelect: () => console.log("save") }, "Save page as…"),
			ContextMenuItem({ onSelect: () => console.log("print") }, "Print…"),
			ContextMenuSeparator({}),
			ContextMenuItem({ onSelect: () => console.log("inspect") }, "Inspect"),
		),
	);
}
