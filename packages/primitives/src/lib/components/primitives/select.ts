import {
	Button,
	context,
	derived,
	Div,
	Implement,
	isReadable,
	ref,
	Ref,
	signal,
	Span,
	type Bindable,
	type Child,
	type ComponentProps,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { getId, getReadableValue, noop, type MaybeReadable } from "../../utils";
import { mergeProps } from "../../merge-props";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";
import { positionFloatingElement, type Align, type Side } from "../helpers/floating-ui";
import { ScrollLock } from "../helpers/scroll-lock";
import { createComponent } from "../../create-component";

/** One option in {@link SelectProps.items}. */
export type SelectItemData = {
	value: string;
	label: string;
	disabled?: boolean;
};

/** A selected option as shown by {@link SelectValue}. */
export type SelectSelectedItem = {
	value: string;
	label: string;
};

export type SelectProps<T extends "single" | "multiple" = "single"> = (T extends "multiple"
	? { type: "multiple"; value?: Signal<string[]> }
	: { type?: "single"; value?: Signal<string | null> }) & {
	open?: Signal<boolean>;
	closeOnSelect?: boolean;
	/** When true, the page behind cannot scroll while the list is open. Defaults to false. */
	preventScroll?: boolean;
	/**
	 * Value/label pairs used by {@link SelectValue}. When omitted, labels come
	 * from each item's `label` prop or its text content.
	 */
	items?: MaybeReadable<SelectItemData[]>;
};

function labelForValue(
	value: string,
	items: readonly SelectItemData[],
	labels: ReadonlyMap<string, string>,
): string {
	const fromItems = items.find((item) => item.value === value)?.label;
	if (fromItems !== undefined) return fromItems;
	return labels.get(value) ?? value;
}

/** Immediate label from a sole string child, so SelectValue does not wait for mount. */
function textChild(children: Child[]): string | undefined {
	if (children.length === 1 && typeof children[0] === "string") {
		const text = children[0].trim();
		if (text !== "") return text;
	}
	return undefined;
}

const SelectCtx = context<SelectState>("SelectCtx");

abstract class SelectState {
	open: Signal<boolean>;
	items: Readable<SelectItemData[]>;
	itemLabels = Implement.Map<string, string>();
	trigger = ref<HTMLButtonElement>();
	content = signal<SelectContentState | null>(null);
	autoUpdateDispose: (() => void) | null = null;
	constructor(readonly opts: SelectProps<any>) {
		this.open = signal(this.opts.open ?? false);
		this.items = isReadable<SelectItemData[]>(this.opts.items)
			? this.opts.items
			: signal(this.opts.items ?? []);
	}

	abstract value(): Signal<string | null> | Signal<string[]>;

	registerItemLabel(value: string, label: string) {
		this.itemLabels.set(value, label);
	}

	registerContent(content: SelectContentState) {
		this.content.set(content);
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get contentEl() {
		return derived([this.content], (c) => (c === null ? null : c.opts.ref.get()));
	}

	abstract toggle(value: string): void;

	abstract isSelected(value: string): Readable<boolean>;

	toggleOpen() {
		if (this.open.get()) {
			this.close();
			return;
		}
		this.open.set(true);

		const triggerEl = this.trigger.get();
		const content = this.content.get();
		const contentEl = content?.opts.ref.get();
		if (!triggerEl || !contentEl || !content) return;

		this.autoUpdateDispose?.();
		this.autoUpdateDispose = positionFloatingElement(triggerEl, contentEl, {
			componentName: "select",
			side: content.opts.side,
			align: content.opts.align,
			offset: content.opts.offset,
			strategy: "absolute",
			autoUpdate: true,
		});

		const activeItems = this.getActiveItems();

		activeItems.forEach((item) => item.removeAttribute("data-highlighted"));

		activeItems[0]?.setAttribute("data-highlighted", "");
	}

	private getActiveItems(): HTMLElement[] {
		return Array.from(
			this.content
				.get()
				?.opts.ref.get()
				?.querySelectorAll("[data-select-item]:not([data-disabled])") ?? [],
		);
	}

	onKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case "ArrowDown":
			case "ArrowUp":
				this.handleArrowKey(e);
				break;
			case "Enter":
				this.handleEnterKey(e);
				break;
			default:
				this.handleTypeahead(e);
				return;
		}
	}

	handleTypeahead(e: KeyboardEvent) {
		if (!this.open.get()) {
			const match = this.items
				.get()
				.find((item) => !item.disabled && item.label.toLowerCase().startsWith(e.key.toLowerCase()));
			if (match) this.toggle(match.value);
			return;
		}

		const items = this.getActiveItems();
		let start = false;
		for (const item of items) {
			const label = item.getAttribute("data-label") ?? item.innerText;
			if (item.getAttribute("data-highlighted") !== null) {
				start = true;
				continue;
			}

			if (!start) continue;

			if (label.toLowerCase().startsWith(e.key.toLowerCase())) {
				this.setActiveItem(item.getAttribute("data-value") ?? "");
				break;
			}
		}
	}

	handleEnterKey(e: KeyboardEvent) {
		if (!this.open.get()) return;
		e.preventDefault();
		const activeItems = this.getActiveItems();
		const currentIndex = activeItems.findIndex(
			(item) => item.getAttribute("data-highlighted") !== null,
		);
		if (currentIndex === -1) return;
		const value = activeItems[currentIndex]?.getAttribute("data-value");
		if (value) this.toggle(value);
	}

	handleArrowKey(e: KeyboardEvent) {
		e.preventDefault();

		const direction = e.key === "ArrowDown" ? 1 : -1;

		const activeItems = this.getActiveItems();
		let currentIndex = activeItems.findIndex(
			(item) => item.getAttribute("data-highlighted") !== null,
		);
		if (currentIndex === -1) currentIndex = 0;

		const nextIndex = (currentIndex + direction + activeItems.length) % activeItems.length;

		this.setActiveItem(activeItems[nextIndex]?.getAttribute("data-value") ?? "");
	}

	setActiveItem(value: string) {
		const activeItems = this.getActiveItems();
		activeItems.forEach((item) => item.removeAttribute("data-highlighted"));
		activeItems
			.find((item) => item.getAttribute("data-value") === value)
			?.setAttribute("data-highlighted", "");
	}

	close() {
		this.open.set(false);
		this.autoUpdateDispose?.();
		this.autoUpdateDispose = null;
	}

	dispose() {
		this.autoUpdateDispose?.();
		this.autoUpdateDispose = null;
	}
}

class SelectStateSingle extends SelectState {
	#value: Signal<string | null>;
	constructor(readonly opts: SelectProps) {
		super(opts);
		this.#value = signal(this.opts.value ?? (null as string | null));
	}

	override toggle(value: string) {
		const currentValue = this.#value.get();
		if (currentValue === value) {
			if (this.opts.closeOnSelect) this.close();
			return;
		}
		this.#value.set(value);
		if (this.opts.closeOnSelect) this.close();
	}

	override isSelected(value: string) {
		return this.#value.bind((v) => v === value);
	}

	override value() {
		return this.#value;
	}
}

class SelectStateMultiple extends SelectState {
	#value: Signal<string[]>;
	constructor(readonly opts: SelectProps<"multiple">) {
		super(opts);
		this.#value = signal(this.opts.value ?? ([] as string[]));
	}

	override toggle(value: string) {
		const index = this.#value.get().indexOf(value);
		if (index === -1) {
			this.#value.push(value);
			if (this.opts.closeOnSelect) this.close();
		} else {
			this.#value.splice(index, 1);
		}
	}

	override isSelected(value: string) {
		return this.#value.bind((v) => v.includes(value));
	}

	override value() {
		return this.#value;
	}
}

export const Select = createComponent(function Select(
	props: SelectProps<"single" | "multiple">,
	...children: Child[]
) {
	props.closeOnSelect = props.closeOnSelect ?? props.type !== "multiple";
	const state =
		props.type === "multiple" ? new SelectStateMultiple(props) : new SelectStateSingle(props);
	return DismissableLayer(
		{
			open: state.open,
			close: () => state.close(),
			anchors: state.trigger.bind((t): (HTMLElement | null | undefined)[] => [t]),
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
		ScrollLock({ open: state.open, enabled: state.opts.preventScroll === true }),
		SelectCtx.Provide(state).To(
			Implement.Lifecycle(
				{
					onUnmount: () => state.dispose(),
				},
				...children,
			),
		),
	);
});

export type SelectTriggerProps = ComponentProps<typeof Button>;

export const SelectTrigger = createComponent(function SelectTrigger(
	{ id = getId(), ...restProps }: SelectTriggerProps,
	...children: Child[]
) {
	return SelectCtx.Use((state) => {
		return Button(
			mergeProps(
				{
					id,
					this: state.trigger,
					type: "button",
					"data-select-trigger": "",
					"data-state": state.state,
					"aria-haspopup": "listbox",
					"aria-expanded": state.open,
					onClick: () => state.toggleOpen(),
					onKeydown: (e: KeyboardEvent) => state.onKeydown(e),
					// onBlur: () => state.close()
				},
				restProps,
			),
			...children,
		);
	});
});

export type SelectValueRenderProps =
	| {
			type: "single";
			value: Signal<string | null>;
			selected: Readable<SelectSelectedItem | null>;
	  }
	| {
			type: "multiple";
			value: Signal<string[]>;
			selected: Readable<SelectSelectedItem[]>;
	  };

export type SelectValueProps = ComponentProps<typeof Span> & {
	placeholder?: string;
	render?: (props: SelectValueRenderProps) => Child;
};

export const SelectValue = createComponent(function SelectValue({
	render,
	placeholder = "",
}: SelectValueProps) {
	return SelectCtx.Use((state) => {
		if (state.opts.type === "multiple") {
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Select state value shape follows the discriminated `type` prop.
			const value = state.value() as Signal<string[]>;
			const selected = derived([value, state.items, state.itemLabels], (values, items, labels) =>
				values.map((current) => ({
					value: current,
					label: labelForValue(current, items, labels),
				})),
			);
			const props: SelectValueRenderProps = { type: "multiple", value, selected };
			if (render) return render(props);
			return selected.bind((selection) =>
				selection.length === 0 ? placeholder : selection.map((item) => item.label).join(", "),
			);
		}

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Select state value shape follows the discriminated `type` prop.
		const value = state.value() as Signal<string | null>;
		const selected = derived([value, state.items, state.itemLabels], (current, items, labels) =>
			current == null ? null : { value: current, label: labelForValue(current, items, labels) },
		);
		const props: SelectValueRenderProps = { type: "single", value, selected };
		if (render) return render(props);
		return selected.bind((selection) => selection?.label ?? placeholder);
	});
});

type SelectContentOptions = {
	side: Side;
	align: Align;
	offset: number;
	onInteractOutside: (e: InteractOutsideEvent) => void;
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	onEscape: (e: EscapeEvent) => void;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
};

export type SelectContentProps = ComponentProps<typeof Div> & Partial<SelectContentOptions>;

class SelectContentState {
	constructor(
		readonly rootState: SelectState,
		readonly opts: SelectContentOptions & { id: Bindable<string>; ref: Ref<HTMLDivElement> },
	) {
		rootState.registerContent(this);
	}
}

export const SelectContent = createComponent(function SelectContent(
	{
		id = getId(),
		side = "bottom",
		align = "start",
		offset = 0,
		onInteractOutside = noop,
		onInteractOutsideBehavior = "close",
		onEscape = noop,
		escapeKeydownBehavior = "close",
		...restProps
	}: SelectContentProps,
	...children: Child[]
) {
	return SelectCtx.Use((state) => {
		const contentRef = ref<HTMLDivElement>();
		void new SelectContentState(state, {
			id,
			ref: contentRef,
			side,
			align,
			offset,
			onInteractOutside,
			onInteractOutsideBehavior,
			onEscape,
			escapeKeydownBehavior,
		});
		return Div(
			mergeProps(
				{
					id,
					this: contentRef,
					"data-select-content": "",
					role: "listbox",
					tabIndex: -1,
					"data-state": state.state,
				},
				restProps,
			),
			...children,
		);
	});
});

export type SelectItemsProps = ComponentProps<typeof Div> & {
	value: string;
	label?: string;
	disabled?: Signal<boolean> | boolean;
};

class SelectItemState {
	disabled: Signal<boolean>;
	constructor(
		readonly rootState: SelectState,
		readonly opts: Pick<SelectItemsProps, "value" | "disabled">,
	) {
		this.disabled = signal(this.opts.disabled ?? false);
	}

	get selected() {
		return this.rootState.isSelected(this.opts.value);
	}

	toggle() {
		if (this.disabled.get()) return;
		this.rootState.toggle(this.opts.value);
	}
}

export const SelectItem = createComponent(function SelectItem(
	{ id = getId(), value, label, disabled, ...restProps }: SelectItemsProps,
	...children: Child[]
) {
	return SelectCtx.Use((rootState) => {
		const state = new SelectItemState(rootState, { value, disabled });
		const itemRef = ref<HTMLDivElement>();
		const immediateLabel =
			label ??
			textChild(children) ??
			rootState.items.get().find((item) => item.value === value)?.label;
		if (immediateLabel !== undefined) rootState.registerItemLabel(value, immediateLabel);

		return Implement.Lifecycle(
			{
				onMount: () => {
					if (immediateLabel !== undefined) return;
					const text = itemRef.get()?.textContent?.trim();
					if (text) rootState.registerItemLabel(value, text);
				},
			},
			Div(
				mergeProps(
					{
						id,
						this: itemRef,
						"data-select-item": "",
						role: "option",
						"aria-selected": state.selected,
						"aria-disabled": state.disabled,
						"data-value": value,
						"data-label": immediateLabel,
						"data-selected": state.selected.bind((selected) => (selected ? "" : undefined)),
						"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
						onClick: () => state.toggle(),
						onPointerover: () => rootState.setActiveItem(value),
					},
					restProps,
				),
				...children,
			),
		);
	});
});

class SelectGroupState {
	headingId = signal<string | null>(null);
}

const SelectGroupCtx = context<SelectGroupState>("SelectGroupCtx");

export type SelectGroupProps = ComponentProps<typeof Div>;

export const SelectGroup = createComponent(function SelectGroup(
	{ id = getId(), ...restProps }: SelectGroupProps,
	...children: Child[]
) {
	return SelectCtx.Use(() => {
		const group = new SelectGroupState();
		return SelectGroupCtx.Provide(group).To(
			Div(
				mergeProps(
					{
						id,
						role: "group",
						"data-select-group": "",
						"aria-labelledby": group.headingId.bind((headingId) => headingId ?? undefined),
					},
					restProps,
				),
				...children,
			),
		);
	});
});

export type SelectGroupHeadingProps = ComponentProps<typeof Div>;

export const SelectGroupHeading = createComponent(function SelectGroupHeading(
	{ id = getId(), ...restProps }: SelectGroupHeadingProps,
	...children: Child[]
) {
	return SelectGroupCtx.Use((group) => {
		group.headingId.set(getReadableValue(id));
		return Div(
			mergeProps({ id, role: "presentation", "data-select-group-heading": "" }, restProps),
			...children,
		);
	});
});
