import {
	Button,
	Div,
	If,
	Ref,
	Span,
	UIFramework,
	signal,
	type Child,
	type Mountable,
	type Readable,
} from "@packages/ui_v2";
import { cx } from "../../lib/cx";
import { Icon, type IconName } from "./icon";

export type MenuItem = {
	id: string;
	label: string;
	icon?: IconName;
	iconClass?: string;
	/** Custom leading content (e.g. an avatar). Takes precedence over `icon`. */
	leading?: Child;
	/** Marks the item with a trailing check. Pass a Readable for reactive menus. */
	selected?: boolean | Readable<boolean>;
	danger?: boolean;
	/** Keep the menu open after selecting (for multi-select menus). */
	keepOpen?: boolean;
	onSelect: () => void;
};

export type MenuOptions = {
	/** Renders the element that toggles the menu on click. */
	trigger: (toggle: () => void) => Child;
	items: MenuItem[];
	align?: "left" | "right";
	/** Width class for the panel. */
	widthClass?: string;
};

function MenuRow(item: MenuItem, close: () => void): Mountable {
	const leading =
		item.leading ?? (item.icon ? Icon(item.icon, cx("h-4 w-4", item.iconClass)) : null);

	return Button(
		{
			type: "button",
			class: cx(
				"flex w-full select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-100 hover:bg-zinc-800 focus:outline-none",
				item.danger ? "text-red-400 hover:text-red-300" : "text-zinc-200",
			),
			onClick(event) {
				event.stopPropagation();
				item.onSelect();
				if (!item.keepOpen) close();
			},
		},
		...(leading ? [leading] : []),
		Span({ class: "min-w-0 flex-1 truncate text-left" }, item.label),
		If(item.selected ?? false).Then(Icon("check", "ml-auto h-3.5 w-3.5 text-indigo-400")),
	);
}

/**
 * Dropdown menu. Owns its open state; closes on outside click, Escape, or
 * selection. Outside-click uses `this` + `contains()`, so inside clicks do
 * not have to stop propagation.
 */
export function Menu(options: MenuOptions): Mountable {
	const open = signal(false);
	const root = new Ref<HTMLDivElement>();
	const close = () => open.set(false);
	const toggle = () => open.toggle();

	return Div(
		{
			this: root,
			class: "relative inline-flex",
		},
		options.trigger(toggle),
		If(open).Then(
			Div(
				{
					class: cx(
						"absolute top-full z-50 mt-1 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl shadow-black/40",
						options.align === "right" ? "right-0" : "left-0",
						options.widthClass ?? "min-w-44",
					),
				},
				...options.items.map((item) => MenuRow(item, close)),
			),
			UIFramework.Document({
				onMousedown: (event) => {
					const node = root.get();
					if (node && event.target instanceof Node && node.contains(event.target)) return;
					close();
				},
				onKeydownCapture: (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						close();
					}
				},
			}),
		),
	);
}
