import {
	context,
	derived,
	Div,
	ImplementLifecycle,
	ref,
	signal,
	type Bindable,
	type Child,
	type Ref,
	type Signal,
} from "@implementjs/core";
import {
	positionFloatingElement,
	type Align,
	type Side,
	type VirtualAnchor,
} from "../helpers/floating-ui";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";
import {
	getId,
	getReadableValue,
	noop,
	type ItemValue,
	type ItemValuesSignal,
	type ItemValueSignal,
	type MaybeReadable,
} from "../../utils";
import { mergeProps } from "../../merge-props";
import { ScrollLock } from "../helpers/scroll-lock";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

/**
 * The shared machinery behind DropdownMenu, ContextMenu, and Menubar. The
 * three flavors differ only in how they open and anchor; the content, items,
 * groups, and keyboard model here are identical, with data attributes named
 * after the flavor (`data-dropdown-menu-item`, `data-context-menu-item`, …).
 */
export type MenuVariant = "dropdown-menu" | "context-menu" | "menubar";

type Point = { x: number; y: number };

/** Whether a point lies inside a polygon, by ray casting. */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const a = polygon[i]!;
		const b = polygon[j]!;
		const crosses =
			a.y > point.y !== b.y > point.y &&
			point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
		if (crosses) inside = !inside;
	}
	return inside;
}

/** How long a pointer may travel through a submenu's grace area before it expires. */
const GRACE_AREA_DURATION = 300;

export type MenuRootOptions = {
	open?: Signal<boolean> | boolean;
	/** When true, the page behind cannot scroll while the menu is open. Defaults to true. */
	preventScroll?: boolean;
};

export const MenuCtx = context<MenuState>("MenuCtx");

export class MenuState {
	open: Signal<boolean>;
	/** The element that opened the menu; focus returns to it on close. */
	trigger = ref<HTMLElement>();
	content = signal<MenuContentState | null>(null);
	autoUpdateDispose: (() => void) | null = null;
	/** Keyboard opens focus the first item; pointer opens focus the content. */
	openedByKeyboard = false;
	/** Flavor hook for extra content-level keys, e.g. menubar arrow switching. */
	onContentNavigationKeydown: (e: KeyboardEvent) => void = noop;
	/** Submenus anywhere under this menu, so hovering a sibling item closes them. */
	subs: MenuSubState[] = [];

	constructor(
		readonly variant: MenuVariant,
		readonly opts: MenuRootOptions,
	) {
		this.open = signal(opts.open ?? false);
	}

	attr(part: string) {
		return `data-${this.variant}-${part}`;
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get contentEl() {
		return derived([this.content], (c) => (c === null ? null : c.opts.ref.get()));
	}

	/** The open content's id, for the trigger's aria-controls. */
	get contentId() {
		return derived([this.open, this.content], (open, c) =>
			open && c !== null ? getReadableValue(c.opts.id) : undefined,
		);
	}

	/** What the content positions against. The context menu overrides this with the pointer location. */
	anchor(): HTMLElement | VirtualAnchor | null {
		return this.trigger.get();
	}

	registerContent(content: MenuContentState) {
		this.content.set(content);
	}

	openMenu(byKeyboard: boolean) {
		this.openedByKeyboard = byKeyboard;
		if (this.open.get()) {
			// an already-open context menu repositions on the next right click
			this.position();
			return;
		}
		this.open.set(true);
	}

	toggleOpen(byKeyboard: boolean) {
		if (this.open.get()) {
			this.close(false);
		} else {
			this.openMenu(byKeyboard);
		}
	}

	/** Runs when `open` flips true, from any path: position the content and move focus in. */
	onOpened() {
		this.position();
		if (this.openedByKeyboard) {
			this.getItems()[0]?.focus();
		} else {
			this.content.get()?.opts.ref.get()?.focus();
		}
	}

	position() {
		const anchor = this.anchor();
		const content = this.content.get();
		const contentEl = content?.opts.ref.get();
		if (!anchor || !content || !contentEl) return;

		this.autoUpdateDispose?.();
		this.autoUpdateDispose = positionFloatingElement(anchor, contentEl, {
			componentName: this.variant,
			side: content.opts.side,
			align: content.opts.align,
			offset: content.opts.offset,
			strategy: "absolute",
			autoUpdate: true,
		});
	}

	close(refocusTrigger: boolean) {
		if (!this.open.get()) return;
		this.open.set(false);
		this.openedByKeyboard = false;
		if (refocusTrigger) this.trigger.get()?.focus();
	}

	registerSub(sub: MenuSubState) {
		this.subs.push(sub);
	}

	/**
	 * Whether the pointer is inside an open submenu's grace area — on its way
	 * from the trigger to the panel. Items it crosses in transit must not
	 * steal focus or close the submenu. Leaving an area clears it, so the
	 * next move over a sibling behaves normally.
	 */
	isPointerInGraceArea(e: PointerEvent): boolean {
		const point = { x: e.clientX, y: e.clientY };
		let inside = false;
		for (const sub of this.subs) {
			if (sub.graceArea === null) continue;
			if (pointInPolygon(point, sub.graceArea)) {
				inside = true;
			} else {
				sub.clearGraceArea();
			}
		}
		return inside;
	}

	/** Close open submenus that don't own `target`, e.g. when a sibling item is hovered. */
	closeSubmenusFor(target: HTMLElement) {
		for (const sub of this.subs) {
			if (!sub.open.get()) continue;
			const triggerEl = sub.trigger.get();
			const contentEl = sub.content.get()?.opts.ref.get();
			if (triggerEl === target || contentEl?.contains(target)) continue;
			sub.close(false);
		}
	}

	/** The selector matching this variant's content boundaries, root and sub alike. */
	private get boundarySelector() {
		return `[${this.attr("content")}], [${this.attr("sub-content")}]`;
	}

	/**
	 * The navigable items directly inside this menu's content. Items nested in
	 * a sub-content belong to that submenu's scope and are excluded here.
	 */
	getItems(): HTMLElement[] {
		const contentEl = this.content.get()?.opts.ref.get();
		if (!contentEl) return [];
		return Array.from(
			contentEl.querySelectorAll<HTMLElement>(`[${this.attr("item")}]:not([data-disabled])`),
		).filter((item) => item.closest(this.boundarySelector) === contentEl);
	}

	onContentKeydown(e: KeyboardEvent) {
		// keys the menu consumes stop here: an ancestor that navigates with the
		// same keys (a Command list, say) must not move alongside the menu
		switch (e.key) {
			case "ArrowDown":
			case "ArrowUp":
				this.handleArrowKey(e);
				e.stopPropagation();
				break;
			case "Home":
			case "End":
				e.preventDefault();
				e.stopPropagation();
				this.getItems()
					.at(e.key === "Home" ? 0 : -1)
					?.focus();
				break;
			case "Tab":
				// menus are not part of the page's tab order; Tab dismisses
				this.close(false);
				break;
			default:
				if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
					this.handleTypeahead(e.key);
					e.stopPropagation();
				} else {
					this.onContentNavigationKeydown(e);
				}
				return;
		}
	}

	private handleArrowKey(e: KeyboardEvent) {
		e.preventDefault();
		const items = this.getItems();
		if (items.length === 0) return;

		const direction = e.key === "ArrowDown" ? 1 : -1;
		const activeElement = this.content.get()?.opts.ref.get()?.ownerDocument.activeElement;
		const currentIndex = items.findIndex((item) => item === activeElement);

		if (currentIndex === -1) {
			items.at(direction === 1 ? 0 : -1)?.focus();
			return;
		}

		const loop = this.content.get()?.opts.loop ?? true;
		let nextIndex = currentIndex + direction;
		if (nextIndex < 0) nextIndex = loop ? items.length - 1 : 0;
		if (nextIndex >= items.length) nextIndex = loop ? 0 : items.length - 1;
		items[nextIndex]?.focus();
	}

	private handleTypeahead(key: string) {
		const items = this.getItems();
		const activeElement = this.content.get()?.opts.ref.get()?.ownerDocument.activeElement;
		const currentIndex = items.findIndex((item) => item === activeElement);

		// search after the focused item first, wrapping around
		for (let i = 1; i <= items.length; i++) {
			const item = items[(currentIndex + i) % items.length];
			const label = item?.getAttribute("data-label") ?? item?.textContent ?? "";
			if (label.trim().toLowerCase().startsWith(key.toLowerCase())) {
				item?.focus();
				return;
			}
		}
	}

	dispose() {
		this.autoUpdateDispose?.();
		this.autoUpdateDispose = null;
	}
}

/**
 * Shared root wrapper: the dismissable layer, context, and open/close
 * plumbing. Flavors construct the state and hand it here.
 */
export function MenuRoot(state: MenuState, ...children: Child[]) {
	state.open.subscribe((open) => {
		if (open) {
			// subscribers registered later include the content's data-state binding;
			// wait for them so the content is visible before it is measured and focused
			queueMicrotask(() => {
				if (state.open.get()) state.onOpened();
			});
		} else {
			state.dispose();
		}
	});

	return DismissableLayer(
		{
			open: state.open,
			close: (e) => state.close(e instanceof EscapeEvent),
			anchors:
				state.variant === "context-menu"
					? // right clicks in the trigger area re-open, so the area itself dismisses
						signal([] as (HTMLElement | null | undefined)[])
					: state.trigger.bind((t): (HTMLElement | null | undefined)[] => [t]),
			content: state.contentEl,
			escapeKeydownBehavior: state.content.bind((c) =>
				c === null ? "close" : c.opts.escapeKeydownBehavior,
			),
			onEscape: state.content.bind((c) => (c === null ? noop : c.opts.onEscape)),
			onInteractOutside: state.content.bind((c) => (c === null ? noop : c.opts.onInteractOutside)),
			onInteractOutsideBehavior: state.content.bind((c) =>
				c === null ? "close" : c.opts.onInteractOutsideBehavior,
			),
		},
		ScrollLock({ open: state.open, enabled: state.opts.preventScroll !== false }),
		MenuCtx.Provide(state).To(
			ImplementLifecycle(
				{
					onUnmount: () => state.dispose(),
				},
				...children,
			),
		),
	);
}

type MenuContentOptions = {
	side: Side;
	align: Align;
	offset: number;
	/** Whether arrow keys wrap from the last item back to the first. */
	loop: boolean;
	onInteractOutside: (e: InteractOutsideEvent) => void;
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	onEscape: (e: EscapeEvent) => void;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
};

export type MenuContentProps = RenderableProps<typeof Div> & Partial<MenuContentOptions>;

export class MenuContentState {
	constructor(
		readonly rootState: MenuState,
		readonly opts: MenuContentOptions & { id: Bindable<string>; ref: Ref<HTMLDivElement> },
	) {
		rootState.registerContent(this);
	}
}

export const MenuContent = createComponent(function MenuContent(
	{
		id = getId(),
		side = "bottom",
		align = "start",
		offset = 0,
		loop = true,
		onInteractOutside = noop,
		onInteractOutsideBehavior = "close",
		onEscape = noop,
		escapeKeydownBehavior = "close",
		render = Div,
		...restProps
	}: MenuContentProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		const contentRef = ref<HTMLDivElement>();
		void new MenuContentState(state, {
			id,
			ref: contentRef,
			side,
			align,
			offset,
			loop,
			onInteractOutside,
			onInteractOutsideBehavior,
			onEscape,
			escapeKeydownBehavior,
		});
		return render(
			mergeProps(
				{
					id,
					this: contentRef,
					role: "menu",
					tabIndex: -1,
					"aria-orientation": "vertical",
					[state.attr("content")]: "",
					"data-state": state.state,
					onKeydown: (e: KeyboardEvent) => state.onContentKeydown(e),
				},
				restProps,
			),
			...children,
		);
	});
});

type MenuItemOptions = {
	/** Runs when the item is activated with a click, Enter, or Space. */
	onSelect?: () => void;
	disabled?: Signal<boolean> | boolean;
	closeOnSelect?: boolean;
};

export type MenuItemProps = RenderableProps<typeof Div> & MenuItemOptions;

/**
 * The behavior every selectable menu item shares: focus follows the pointer,
 * `data-highlighted` follows focus, and Enter/Space/click activate.
 */
function menuItemProps(
	state: MenuState,
	opts: Required<Pick<MenuItemOptions, "closeOnSelect">> & {
		id: Bindable<string>;
		disabled: Signal<boolean>;
		select: () => void;
	},
) {
	const highlighted = signal(false);

	const select = () => {
		if (opts.disabled.get()) return;
		opts.select();
		if (opts.closeOnSelect) state.close(true);
	};

	return {
		id: opts.id,
		role: "menuitem",
		tabIndex: -1,
		[state.attr("item")]: "",
		"aria-disabled": opts.disabled,
		"data-disabled": opts.disabled.bind((disabled) => (disabled ? "" : undefined)),
		"data-highlighted": highlighted.bind((h) => (h ? "" : undefined)),
		onPointermove: (e: PointerEvent) => {
			if (e.pointerType !== "mouse" || opts.disabled.get()) return;
			if (!(e.currentTarget instanceof HTMLElement)) return;
			// crossed in transit toward an open submenu: leave everything be
			if (state.isPointerInGraceArea(e)) return;
			e.currentTarget.focus();
			state.closeSubmenusFor(e.currentTarget);
		},
		onPointerleave: (e: PointerEvent) => {
			if (e.pointerType !== "mouse") return;
			if (!(e.currentTarget instanceof HTMLElement)) return;
			// hand focus back to the menu the item belongs to, sub or root
			e.currentTarget
				.closest<HTMLElement>(`[${state.attr("content")}], [${state.attr("sub-content")}]`)
				?.focus();
		},
		onFocus: (e: FocusEvent) => {
			if (opts.disabled.get()) return;
			highlighted.set(true);
			if (e.currentTarget instanceof HTMLElement) state.closeSubmenusFor(e.currentTarget);
		},
		onBlur: () => highlighted.set(false),
		onClick: () => select(),
		onKeydown: (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				// the selection belongs to this item, not to any ancestor widget
				e.stopPropagation();
				select();
			}
		},
	};
}

export const MenuItem = createComponent(function MenuItem(
	{
		id = getId(),
		onSelect = noop,
		disabled = false,
		closeOnSelect = true,
		render = Div,
		...restProps
	}: MenuItemProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		return render(
			mergeProps(
				menuItemProps(state, {
					id,
					disabled: signal(disabled),
					closeOnSelect,
					select: onSelect,
				}),
				restProps,
			),
			...children,
		);
	});
});

class MenuGroupState {
	headingId = signal<string | null>(null);
}

const MenuGroupCtx = context<MenuGroupState>("MenuGroupCtx");

export type MenuGroupProps = RenderableProps<typeof Div>;

export const MenuGroup = createComponent(function MenuGroup(
	{ id = getId(), render = Div, ...restProps }: MenuGroupProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		const group = new MenuGroupState();
		return MenuGroupCtx.Provide(group).To(
			render(
				mergeProps(
					{
						id,
						role: "group",
						[state.attr("group")]: "",
						"aria-labelledby": group.headingId.bind((headingId) => headingId ?? undefined),
					},
					restProps,
				),
				...children,
			),
		);
	});
});

export type MenuGroupHeadingProps = RenderableProps<typeof Div>;

export const MenuGroupHeading = createComponent(function MenuGroupHeading(
	{ id = getId(), render = Div, ...restProps }: MenuGroupHeadingProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		return MenuGroupCtx.Use((group) => {
			group.headingId.set(getReadableValue(id));
			return render(
				mergeProps({ id, role: "presentation", [state.attr("group-heading")]: "" }, restProps),
				...children,
			);
		});
	});
});

export type MenuCheckboxGroupProps = RenderableProps<typeof Div> & {
	/** The values of the checked items. Pass a signal to control them from outside. */
	value?: ItemValuesSignal | ItemValue[];
};

class MenuCheckboxGroupState extends MenuGroupState {
	value: Signal<ItemValue[]>;
	constructor(value: MenuCheckboxGroupProps["value"]) {
		super();
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ItemValuesSignal names each concrete signal shape; the group holds the widest one.
		this.value = signal(value ?? ([] as ItemValue[])) as Signal<ItemValue[]>;
	}

	toggle(item: ItemValue) {
		this.value.update((values) =>
			values.includes(item) ? values.filter((value) => value !== item) : [...values, item],
		);
	}
}

const MenuCheckboxGroupCtx = context<MenuCheckboxGroupState>("MenuCheckboxGroupCtx");

export const MenuCheckboxGroup = createComponent(function MenuCheckboxGroup(
	{ id = getId(), value, render = Div, ...restProps }: MenuCheckboxGroupProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		const group = new MenuCheckboxGroupState(value);
		return MenuGroupCtx.Provide(group).To(
			MenuCheckboxGroupCtx.Provide(group).To(
				render(
					mergeProps(
						{
							id,
							role: "group",
							[state.attr("checkbox-group")]: "",
							"aria-labelledby": group.headingId.bind((headingId) => headingId ?? undefined),
						},
						restProps,
					),
					...children,
				),
			),
		);
	});
});

export type MenuCheckboxItemProps = MenuItemProps & {
	checked?: Signal<boolean> | boolean;
	/** Identifies the item inside a MenuCheckboxGroup. Must be unique within the group. */
	value?: ItemValue;
};

export const MenuCheckboxItem = createComponent(function MenuCheckboxItem(
	{
		id = getId(),
		checked = false,
		value,
		onSelect = noop,
		disabled = false,
		closeOnSelect = true,
		render = Div,
		...restProps
	}: MenuCheckboxItemProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		return MenuCheckboxGroupCtx.UseOr((group) => {
			// inside a group the array owns the checked state, and a value is what
			// names the item in it; anywhere else the item owns its own boolean
			const membership = group !== null && value !== undefined ? { group, value } : null;
			const checkedSignal = signal(checked);
			const isChecked =
				membership === null
					? checkedSignal
					: membership.group.value.bind((values) => values.includes(membership.value));

			return render(
				mergeProps(
					menuItemProps(state, {
						id,
						disabled: signal(disabled),
						closeOnSelect,
						select: () => {
							if (membership === null) {
								checkedSignal.toggle();
							} else {
								membership.group.toggle(membership.value);
							}
							onSelect();
						},
					}),
					{
						role: "menuitemcheckbox",
						[state.attr("checkbox-item")]: "",
						"data-value": value,
						"aria-checked": isChecked,
						"data-state": isChecked.bind((checked) => (checked ? "checked" : "unchecked")),
					},
					restProps,
				),
				...children,
			);
		}, null);
	});
});

export type MenuRadioGroupProps = RenderableProps<typeof Div> & {
	value?: ItemValueSignal | ItemValue | null;
};

class MenuRadioGroupState extends MenuGroupState {
	value: Signal<ItemValue | null>;
	constructor(value: MenuRadioGroupProps["value"]) {
		super();
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ItemValueSignal names each concrete signal shape; the group holds the widest one.
		this.value = signal(value ?? (null as ItemValue | null)) as Signal<ItemValue | null>;
	}
}

const MenuRadioGroupCtx = context<MenuRadioGroupState>("MenuRadioGroupCtx");

export const MenuRadioGroup = createComponent(function MenuRadioGroup(
	{ id = getId(), value, render = Div, ...restProps }: MenuRadioGroupProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		const group = new MenuRadioGroupState(value);
		return MenuGroupCtx.Provide(group).To(
			MenuRadioGroupCtx.Provide(group).To(
				render(
					mergeProps(
						{
							id,
							role: "group",
							[state.attr("radio-group")]: "",
							"aria-labelledby": group.headingId.bind((headingId) => headingId ?? undefined),
						},
						restProps,
					),
					...children,
				),
			),
		);
	});
});

export type MenuRadioItemProps = RenderableProps<typeof Div> & {
	/** Identifies the item. Must be unique within the radio group. */
	value: ItemValue;
	onSelect?: () => void;
	disabled?: Signal<boolean> | boolean;
	closeOnSelect?: boolean;
};

export const MenuRadioItem = createComponent(function MenuRadioItem(
	{
		id = getId(),
		value,
		onSelect = noop,
		disabled = false,
		closeOnSelect = true,
		render = Div,
		...restProps
	}: MenuRadioItemProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		return MenuRadioGroupCtx.Use((group) => {
			const checked = group.value.bind((current) => current === value);
			return render(
				mergeProps(
					menuItemProps(state, {
						id,
						disabled: signal(disabled),
						closeOnSelect,
						select: () => {
							group.value.set(value);
							onSelect();
						},
					}),
					{
						role: "menuitemradio",
						[state.attr("radio-item")]: "",
						"data-value": value,
						"aria-checked": checked,
						"data-state": checked.bind((checked) => (checked ? "checked" : "unchecked")),
					},
					restProps,
				),
				...children,
			);
		});
	});
});

export type MenuSeparatorProps = RenderableProps<typeof Div>;

export const MenuSeparator = createComponent(function MenuSeparator(
	{ id = getId(), render = Div, ...restProps }: MenuSeparatorProps,
	...children: Child[]
) {
	return MenuCtx.Use((state) => {
		return render(
			mergeProps(
				{
					id,
					role: "separator",
					"aria-orientation": "horizontal",
					[state.attr("separator")]: "",
				},
				restProps,
			),
			...children,
		);
	});
});

/**
 * A nested menu. Anchors to its trigger item inside the parent content and
 * reuses the whole MenuState machinery — positioning, scoped keyboard
 * navigation, focus — while living inside the root's dismissable layer.
 */
export class MenuSubState extends MenuState {
	/** While set, the pointer is traveling from the trigger toward the panel. */
	graceArea: Point[] | null = null;
	private graceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		readonly root: MenuState,
		opts: MenuRootOptions,
	) {
		super(root.variant, opts);
	}

	/** Hover opens stay put; only keyboard opens move focus into the panel. */
	override onOpened() {
		this.position();
		if (this.openedByKeyboard) this.getItems()[0]?.focus();
	}

	/**
	 * The safe triangle: a polygon from where the pointer left the trigger to
	 * the panel's corners. A straight-line move to the panel stays inside it,
	 * so sibling items crossed on the way don't close the submenu.
	 */
	setGraceArea(exitX: number, exitY: number) {
		const contentEl = this.content.get()?.opts.ref.get();
		if (!contentEl) return;
		const rect = contentEl.getBoundingClientRect();
		if (rect.width === 0) return;

		// widen the exit point a little so a slightly diagonal start still counts
		const pad = 5;
		const panelIsRightOfExit = exitX < rect.left + rect.width / 2;
		const exit = { x: panelIsRightOfExit ? exitX - pad : exitX + pad, y: exitY };
		const nearX = panelIsRightOfExit ? rect.left : rect.right;
		const farX = panelIsRightOfExit ? rect.right : rect.left;
		this.graceArea = [
			{ x: exit.x, y: exit.y - pad },
			{ x: nearX, y: rect.top },
			{ x: farX, y: rect.top },
			{ x: farX, y: rect.bottom },
			{ x: nearX, y: rect.bottom },
			{ x: exit.x, y: exit.y + pad },
		];

		if (this.graceTimer !== null) clearTimeout(this.graceTimer);
		this.graceTimer = setTimeout(() => this.clearGraceArea(), GRACE_AREA_DURATION);
	}

	clearGraceArea() {
		this.graceArea = null;
		if (this.graceTimer === null) return;
		clearTimeout(this.graceTimer);
		this.graceTimer = null;
	}

	override dispose() {
		super.dispose();
		this.clearGraceArea();
	}
}

const MenuSubCtx = context<MenuSubState>("MenuSubCtx");

export type MenuSubProps = MenuRootOptions;

export const MenuSub = createComponent(function MenuSub(props: MenuSubProps, ...children: Child[]) {
	return MenuCtx.Use((root) => {
		const sub = new MenuSubState(root, props);
		root.registerSub(sub);

		// the whole tree closes together
		root.open.subscribe((open) => {
			if (!open) sub.close(false);
		});
		sub.open.subscribe((open) => {
			if (open) {
				queueMicrotask(() => {
					if (sub.open.get()) sub.onOpened();
				});
			} else {
				sub.dispose();
			}
		});

		return MenuSubCtx.Provide(sub).To(
			ImplementLifecycle({ onUnmount: () => sub.dispose() }, ...children),
		);
	});
});

export type MenuSubTriggerProps = RenderableProps<typeof Div> & {
	disabled?: Signal<boolean> | boolean;
	/** How long the pointer must rest on the trigger before the submenu opens, in milliseconds. */
	openDelay?: number;
};

export const MenuSubTrigger = createComponent(function MenuSubTrigger(
	{
		id = getId(),
		disabled = false,
		openDelay = 100,
		render = Div,
		...restProps
	}: MenuSubTriggerProps,
	...children: Child[]
) {
	return MenuCtx.Use((root) => {
		return MenuSubCtx.Use((sub) => {
			const disabledSignal = signal(disabled);
			let hoverTimer: ReturnType<typeof setTimeout> | null = null;

			const clearHoverTimer = () => {
				if (hoverTimer === null) return;
				clearTimeout(hoverTimer);
				hoverTimer = null;
			};

			return ImplementLifecycle(
				{ onUnmount: clearHoverTimer },
				render(
					mergeProps(
						menuItemProps(root, {
							id,
							disabled: disabledSignal,
							// a sub trigger is not a leaf: activating it opens, never closes
							closeOnSelect: false,
							select: () => sub.openMenu(true),
						}),
						{
							this: sub.trigger,
							"aria-haspopup": "menu",
							"aria-expanded": sub.open,
							"aria-controls": sub.contentId,
							[root.attr("sub-trigger")]: "",
							"data-state": sub.state,
							onPointermove: (e: PointerEvent) => {
								if (e.pointerType !== "mouse" || disabledSignal.get()) return;
								if (sub.open.get() || hoverTimer !== null) return;
								hoverTimer = setTimeout(() => {
									hoverTimer = null;
									sub.openMenu(false);
								}, openDelay);
							},
							onPointerleave: (e: PointerEvent) => {
								if (e.pointerType !== "mouse") return;
								clearHoverTimer();
								// give the pointer a safe path from the trigger to the panel
								if (sub.open.get()) sub.setGraceArea(e.clientX, e.clientY);
							},
							onKeydown: (e: KeyboardEvent) => {
								if (e.key !== "ArrowRight" || disabledSignal.get()) return;
								e.preventDefault();
								// ours, not the parent's navigation (or the menubar's switching)
								e.stopPropagation();
								if (sub.open.get()) {
									sub.getItems()[0]?.focus();
								} else {
									sub.openMenu(true);
								}
							},
						},
						restProps,
					),
					...children,
				),
			);
		});
	});
});

export type MenuSubContentProps = MenuContentProps;

export const MenuSubContent = createComponent(function MenuSubContent(
	{
		id = getId(),
		side = "right",
		align = "start",
		offset = 0,
		loop = true,
		onInteractOutside = noop,
		onInteractOutsideBehavior = "close",
		onEscape = noop,
		escapeKeydownBehavior = "close",
		render = Div,
		...restProps
	}: MenuSubContentProps,
	...children: Child[]
) {
	return MenuCtx.Use((root) => {
		return MenuSubCtx.Use((sub) => {
			const contentRef = ref<HTMLDivElement>();
			void new MenuContentState(sub, {
				id,
				ref: contentRef,
				side,
				align,
				offset,
				loop,
				onInteractOutside,
				onInteractOutsideBehavior,
				onEscape,
				escapeKeydownBehavior,
			});
			return render(
				mergeProps(
					{
						id,
						this: contentRef,
						role: "menu",
						tabIndex: -1,
						"aria-orientation": "vertical",
						[root.attr("sub-content")]: "",
						"data-state": sub.state,
						onPointerenter: (e: PointerEvent) => {
							if (e.pointerType !== "mouse") return;
							// the pointer arrived; the grace area has done its job
							sub.clearGraceArea();
						},
						onKeydown: (e: KeyboardEvent) => {
							if (e.key === "ArrowLeft") {
								e.preventDefault();
								e.stopPropagation();
								sub.close(true);
								return;
							}
							// Escape must reach the dismissable layer's document listener
							if (e.key === "Escape") return;
							if (e.key === "Tab") {
								root.close(false);
								return;
							}
							e.stopPropagation();
							sub.onContentKeydown(e);
						},
					},
					restProps,
				),
				...children,
			);
		});
	});
});

/** The trigger attributes every flavor's button-like trigger shares. */
export function menuTriggerProps(state: MenuState, opts: { disabled: Signal<boolean> }) {
	return {
		this: state.trigger,
		"aria-haspopup": "menu",
		"aria-expanded": state.open,
		"aria-controls": state.contentId,
		[state.attr("trigger")]: "",
		"data-state": state.state,
		"data-disabled": opts.disabled.bind((disabled) => (disabled ? "" : undefined)),
		disabled: opts.disabled,
	};
}
