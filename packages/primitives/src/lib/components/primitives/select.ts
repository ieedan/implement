import {
	Button,
	context,
	derived,
	Div,
	Implement,
	ref,
	Ref,
	signal,
	Span,
	type Child,
	type ComponentProps,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { noop, type MaybeReadable } from "../../utils";
import { mergeProps } from "../../merge-props";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";
import { positionFloatingElement, type Align, type Side } from "../helpers/floating-ui";

// TODO: grouping support
// TODO: scroll locking

export type SelectProps<T extends "single" | "multiple" = "single"> = (T extends "multiple"
	? { type: "multiple"; value?: Signal<string[]> }
	: { type?: "single"; value?: Signal<string | null> }) & {
	open?: Signal<boolean>;
	closeOnSelect?: boolean;
};

const SelectCtx = context<SelectState>();

abstract class SelectState {
	open: Signal<boolean>;
	trigger = ref<HTMLButtonElement>();
	content = signal<SelectContentState | null>(null);
	autoUpdateDispose: (() => void) | null = null;
	constructor(readonly opts: SelectProps<any>) {
		this.open = signal(this.opts.open ?? false);
	}

	abstract value(): Signal<string | null> | Signal<string[]>;

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
	constructor(readonly opts: SelectProps<"single">) {
		super(opts);
		this.#value = signal(this.opts.value ?? (null as string | null));
	}

	override toggle(value: string) {
		const currentValue = this.#value.get();
		if (currentValue === value) return;
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

export function Select(props: SelectProps<"single" | "multiple">, ...children: Child[]) {
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
		SelectCtx.Provide(state).To(
			Implement.Lifecycle(
				{
					onUnmount: () => state.dispose(),
				},
				...children,
			),
		),
	);
}

export type SelectTriggerProps = ComponentProps<typeof Button>;

export function SelectTrigger({ ...restProps }: SelectTriggerProps, ...children: Child[]) {
	return SelectCtx.Use((state) => {
		return Button(
			mergeProps(
				{
					this: state.trigger,
					type: "button",
					"data-state": state.state,
					onClick: () => state.toggleOpen(),
					onKeydown: (e: KeyboardEvent) => state.onKeydown(e),
					// onBlur: () => state.close()
				},
				restProps,
			),
			...children,
		);
	});
}

export type SelectValueRenderProps =
	| { type: "single"; value: Signal<string | null> }
	| { type: "multiple"; value: Signal<string[]> };

export type SelectValueProps = ComponentProps<typeof Span> & {
	placeholder?: string;
	render?: (props: SelectValueRenderProps) => Child;
};

export function SelectValue({ render }: SelectValueProps) {
	return SelectCtx.Use((state) => {
		const props: SelectValueRenderProps =
			state.opts.type === "multiple"
				? { type: "multiple", value: state.value() as Signal<string[]> }
				: { type: "single", value: state.value() as Signal<string | null> };

		if (render) {
			return render(props);
		}

		if (props.type === "multiple") {
			return props.value.bind((v) => v.join(", "));
		}
		return props.value.bind((v) => v ?? "");
	});
}

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
		readonly opts: SelectContentOptions & { ref: Ref<HTMLDivElement> },
	) {
		rootState.registerContent(this);
	}
}

export function SelectContent(
	{
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
		new SelectContentState(state, {
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
}

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

export function SelectItem(
	{ value, label, disabled, ...restProps }: SelectItemsProps,
	...children: Child[]
) {
	return SelectCtx.Use((rootState) => {
		const state = new SelectItemState(rootState, { value, disabled });
		return Div(
			mergeProps(
				{
					"data-select-item": "",
					role: "option",
					"aria-selected": state.selected,
					"aria-disabled": state.disabled,
					"data-value": value,
					"data-label": label,
					"data-selected": state.selected.bind((selected) => (selected ? "" : undefined)),
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
					onClick: () => state.toggle(),
					onPointerover: () => rootState.setActiveItem(value),
				},
				restProps,
			),
			...children,
		);
	});
}
