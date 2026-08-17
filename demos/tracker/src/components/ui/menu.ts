import {
	Button,
	Component,
	Div,
	If,
	Signal,
	Span,
	UIFramework,
	type Mountable,
	type Readable,
} from "@packages/ui";
import { cx } from "../../lib/cx";
import { Icon, type IconName } from "./icon";

export type MenuItem = {
	id: string;
	label: string;
	icon?: IconName;
	iconClass?: string;
	/** Custom leading content (e.g. an avatar). Takes precedence over `icon`. */
	leading?: Mountable;
	/** Marks the item with a trailing check. Pass a Readable for reactive menus. */
	selected?: boolean | Readable<boolean>;
	danger?: boolean;
	/** Keep the menu open after selecting (for multi-select menus). */
	keepOpen?: boolean;
	onSelect: () => void;
};

export type MenuOptions = {
	/**
	 * The element that toggles the menu. A click handler is attached to it.
	 * Typed `Component<any>` because Component is invariant in its tag — there
	 * is no usable "any component" supertype.
	 */
	// oxlint-disable-next-line no-explicit-any
	trigger: Component<any>;
	items: MenuItem[];
	align?: "left" | "right";
	/** Width class for the panel. */
	widthClass?: string;
};

function MenuRow(item: MenuItem, close: () => void) {
	const selected = item.selected ?? false;
	const checkNode = If(selected).Then(Icon("check", "ml-auto h-3.5 w-3.5 text-indigo-400"));

	const leading =
		item.leading ?? (item.icon ? Icon(item.icon, cx("h-4 w-4", item.iconClass)) : null);

	return Button(
		...(leading ? [leading] : []),
		Span().content(item.label).className("min-w-0 flex-1 truncate text-left"),
		checkNode,
	)
		.type("button")
		.className(
			cx(
				"flex w-full select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-100 hover:bg-zinc-800 focus:outline-none",
				item.danger ? "text-red-400 hover:text-red-300" : "text-zinc-200",
			),
		)
		.on("click", (e) => {
			e.stopPropagation();
			item.onSelect();
			if (!item.keepOpen) close();
		});
}

/**
 * Dropdown menu. Owns its open state; closes on outside click, Escape, or
 * selection. The document listeners live in the `If(open)` branch, so they
 * attach while the menu is open and detach when it closes or unmounts.
 */
export function Menu(options: MenuOptions) {
	const open = new Signal(false);
	let containerEl: HTMLElement | null = null;

	function close() {
		open.set(false);
	}

	options.trigger.on("click", (e) => {
		e.stopPropagation();
		open.set(!open.get());
	});

	const panel = Div(...options.items.map((item) => MenuRow(item, close))).className(
		cx(
			"absolute top-full z-50 mt-1 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-1 shadow-xl shadow-black/40",
			options.align === "right" ? "right-0" : "left-0",
			options.widthClass ?? "min-w-44",
		),
	);

	return Div(
		options.trigger,
		If(open).Then(
			panel,
			UIFramework.Document()
				.on("mousedown", (e) => {
					if (!containerEl || !containerEl.contains(e.target as Node)) close();
				})
				.on(
					"keydown",
					(e) => {
						if (e.key === "Escape") {
							e.stopPropagation();
							close();
						}
					},
					{ capture: true },
				),
		),
	)
		.className("relative inline-flex")
		.ref((el) => {
			containerEl = el;
		})
		.afterUnmount(() => close());
}
