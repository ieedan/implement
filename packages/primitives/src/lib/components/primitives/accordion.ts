import {
	Button,
	context,
	Div,
	Implement,
	ref,
	signal,
	type Ref,
	type Child,
	type ComponentProps,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";

export type AccordionRootProps = ComponentProps<typeof Div> & {
	type?: "single" | "multiple";
	loop?: boolean;
};

const AccordionCtx = context<AccordionState>();

class AccordionState {
	open = Implement.Set<string>();
	focused = signal<string | null>(null);
	constructor(
		readonly opts: Pick<AccordionRootProps, "type" | "loop">,
		readonly ref: Ref<HTMLDivElement>,
	) {}

	toggle(value: string) {
		const isOpen = this.open.has(value);
		if (isOpen) {
			this.open.delete(value);
		} else {
			if (this.opts.type === "single") {
				this.open.clear();
			}
			this.open.add(value);
		}
	}

	down() {
		const info = this.getFocusInfo();
		if (!info) return;

		if (info.focusedIndex === info.items.length - 1) {
			if (this.opts.loop) info.items[0]!.focus();
		} else {
			info.items[info.focusedIndex + 1]!.focus();
		}
	}

	up() {
		const info = this.getFocusInfo();
		if (!info) return;

		if (info.focusedIndex === 0) {
			if (this.opts.loop) info.items[info.items.length - 1]!.focus();
		} else {
			info.items[info.focusedIndex - 1]!.focus();
		}
	}

	private getFocusInfo() {
		const items = this.ref.get()?.querySelectorAll<HTMLButtonElement>("[data-accordion-trigger]");
		if (!items) return;
		const focused = this.focused.get();
		if (!focused) return;

		let focusedIndex = -1;
		for (let i = 0; i < items.length; i++) {
			if (items[i]!.getAttribute("data-value") === focused) {
				focusedIndex = i;
				break;
			}
		}

		return { items, focusedIndex };
	}

	onKeyDown(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			this.down();
		} else if (e.key === "ArrowUp") {
			this.up();
		}
	}
}

export function Accordion(
	{ id = getId(), type = "single", loop = true, ...restProps }: AccordionRootProps,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const state = new AccordionState({ type, loop }, root);

	return AccordionCtx.Provide(state).To(
		Div(
			mergeProps(
				{
					id,
					this: root,
					"data-accordion-root": "",
					onKeydown: (e: KeyboardEvent) => state.onKeyDown(e),
				},
				restProps,
			),
			...children,
		),
	);
}

export type AccordionItemProps = ComponentProps<typeof Div> & {
	value: string;
};

class AccordionItemState {
	constructor(
		readonly rootState: AccordionState,
		readonly value: AccordionItemProps["value"],
	) {}

	get isOpen() {
		return this.rootState.open.bind(() => this.rootState.open.has(this.value));
	}

	get state() {
		return this.isOpen.bind((open) => (open ? "open" : "closed"));
	}

	onFocus() {
		this.rootState.focused.set(this.value);
	}

	onBlur() {
		if (this.rootState.focused.get() === this.value) {
			this.rootState.focused.set(null);
		}
	}

	toggle() {
		this.rootState.toggle(this.value);
	}

	open() {
		this.rootState.open.add(this.value);
	}
}

const AccordionItemCtx = context<AccordionItemState>();

export function AccordionItem(
	{ id = getId(), value, ...restProps }: AccordionItemProps,
	...children: Child[]
) {
	return AccordionCtx.Use((rootState) => {
		const state = new AccordionItemState(rootState, value);
		return AccordionItemCtx.Provide(state).To(
			Div(
				mergeProps({ id, "data-accordion-item": "", "data-state": state.state }, restProps),
				...children,
			),
		);
	});
}

export type AccordionTriggerProps = ComponentProps<typeof Button>;

export function AccordionTrigger(
	{ id = getId(), ...restProps }: AccordionTriggerProps,
	...children: Child[]
) {
	return AccordionItemCtx.Use((state) => {
		return Button(
			mergeProps(
				{
					id,
					type: "button",
					"data-accordion-trigger": "",
					"data-state": state.state,
					"data-value": state.value,
					"aria-expanded": state.isOpen,
					onClick: () => state.toggle(),
					onFocus: () => state.onFocus(),
					onBlur: () => state.onBlur(),
				},
				restProps,
			),
			...children,
		);
	});
}

export type AccordionContentProps = ComponentProps<typeof Div> & {
	hiddenUntilFound?: boolean;
};

export function AccordionContent(
	{ id = getId(), hiddenUntilFound = false, ...restProps }: AccordionContentProps,
	...children: Child[]
) {
	return AccordionItemCtx.Use((state) => {
		return Div(
			mergeProps(
				{
					id,
					"data-accordion-content": "",
					"data-state": state.state,
					onBeforeMatch: () => state.open(),
					hidden: state.isOpen.bind((open) =>
						open ? undefined : hiddenUntilFound ? "until-found" : "",
					),
				},
				restProps,
			),
			...children,
		);
	});
}

export type AccordionHeaderProps = ComponentProps<typeof Div> & {
	level?: 1 | 2 | 3 | 4 | 5 | 6;
};

export function AccordionHeader(
	{ id = getId(), level = 3, ...restProps }: AccordionHeaderProps,
	...children: Child[]
) {
	return AccordionItemCtx.Use((state) => {
		return Div(
			mergeProps(
				{
					id,
					"data-accordion-header": "",
					"data-state": state.state,
					"data-heading-level": level.toString(),
					"aria-level": level,
					role: "heading",
				},
				restProps,
			),
			...children,
		);
	});
}
