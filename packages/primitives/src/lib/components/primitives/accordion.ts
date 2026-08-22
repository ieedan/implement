import {
	Button,
	context,
	derived,
	Div,
	ImplementLifecycle,
	ref,
	signal,
	type Child,
	type ComponentProps,
	type Readable,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { handleRovingKeydown } from "../helpers/roving-focus";
import { collapsePresence } from "../helpers/collapse-presence";
import { mergeProps } from "../../merge-props";
import { getId, LIB_PREFIX, resolveId } from "../../utils";
import { createComponent } from "../../create-component";

const CONTENT_HEIGHT_VAR = `--${LIB_PREFIX}-accordion-content-height`;
const CONTENT_WIDTH_VAR = `--${LIB_PREFIX}-accordion-content-width`;

export type AccordionRootProps<T extends "single" | "multiple" = "single"> = (T extends "multiple"
	? { type: "multiple"; value?: Signal<string[]> }
	: { type?: "single"; value?: Signal<string | null> }) &
	ComponentProps<typeof Div> & {
		disabled?: Signal<boolean> | boolean;
		/** Whether arrow keys wrap from the last trigger back to the first. */
		loop?: boolean;
		orientation?: "horizontal" | "vertical";
	};

const AccordionCtx = context<AccordionState>("AccordionCtx");

abstract class AccordionState {
	disabled: Signal<boolean>;
	constructor(
		readonly opts: { loop: boolean; orientation: "horizontal" | "vertical" },
		readonly ref: Ref<HTMLDivElement>,
		disabled: Signal<boolean> | boolean,
	) {
		this.disabled = signal(disabled);
	}

	abstract isOpen(value: string): Readable<boolean>;
	abstract isOpenNow(value: string): boolean;
	abstract toggle(value: string): void;
	abstract openItem(value: string): void;

	onTriggerKeydown(e: KeyboardEvent) {
		handleRovingKeydown(e, {
			root: this.ref,
			candidateAttr: "data-accordion-trigger",
			loop: this.opts.loop,
			orientation: this.opts.orientation,
		});
	}
}

class AccordionSingleState extends AccordionState {
	value: Signal<string | null>;
	constructor(
		opts: { loop: boolean; orientation: "horizontal" | "vertical" },
		rootRef: Ref<HTMLDivElement>,
		disabled: Signal<boolean> | boolean,
		value?: Signal<string | null>,
	) {
		super(opts, rootRef, disabled);
		this.value = value ?? signal<string | null>(null);
	}

	isOpen(value: string) {
		return this.value.bind((current) => current === value);
	}

	isOpenNow(value: string) {
		return this.value.get() === value;
	}

	toggle(value: string) {
		this.value.update((current) => (current === value ? null : value));
	}

	openItem(value: string) {
		this.value.set(value);
	}
}

class AccordionMultipleState extends AccordionState {
	value: Signal<string[]>;
	constructor(
		opts: { loop: boolean; orientation: "horizontal" | "vertical" },
		rootRef: Ref<HTMLDivElement>,
		disabled: Signal<boolean> | boolean,
		value?: Signal<string[]>,
	) {
		super(opts, rootRef, disabled);
		this.value = value ?? signal<string[]>([]);
	}

	isOpen(value: string) {
		return this.value.bind((current) => current.includes(value));
	}

	isOpenNow(value: string) {
		return this.value.get().includes(value);
	}

	toggle(value: string) {
		this.value.update((current) =>
			current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
		);
	}

	openItem(value: string) {
		this.value.update((current) => (current.includes(value) ? current : [...current, value]));
	}
}

export const Accordion = createComponent(function Accordion(
	{
		id = getId(),
		type = "single",
		value,
		disabled = false,
		loop = true,
		orientation = "vertical",
		...restProps
	}: AccordionRootProps<"single" | "multiple">,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const opts = { loop, orientation };
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Discriminated `type` prop selects the matching accordion state class. */
	const state =
		type === "multiple"
			? new AccordionMultipleState(opts, root, disabled, value as Signal<string[]> | undefined)
			: new AccordionSingleState(opts, root, disabled, value as Signal<string | null> | undefined);
	/* oxlint-enable typescript/no-unsafe-type-assertion */

	return AccordionCtx.Provide(state).To(
		Div(
			mergeProps(
				{
					id,
					this: root,
					"data-accordion-root": "",
					"data-orientation": orientation,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
				},
				restProps,
			),
			...children,
		),
	);
});

export type AccordionItemProps = ComponentProps<typeof Div> & {
	/** Identifies the item. Must be unique within the accordion. */
	value: string;
	disabled?: Signal<boolean> | boolean;
};

class AccordionItemState {
	disabled: Readable<boolean>;
	/** The trigger's id, so the content can label itself with `aria-labelledby`. */
	triggerId = signal<string | null>(null);
	/** The content's id, so the trigger can point at it with `aria-controls`. */
	contentId = signal<string | null>(null);

	constructor(
		readonly rootState: AccordionState,
		readonly value: AccordionItemProps["value"],
		disabled: Signal<boolean> | boolean,
	) {
		const ownDisabled = signal(disabled);
		this.disabled = derived([ownDisabled, rootState.disabled], (own, root) => own || root);
	}

	get isOpen() {
		return this.rootState.isOpen(this.value);
	}

	get state() {
		return this.isOpen.bind((open) => (open ? "open" : "closed"));
	}

	get dataDisabled() {
		return this.disabled.bind((disabled) => (disabled ? "" : undefined));
	}

	isOpenNow() {
		return this.rootState.isOpenNow(this.value);
	}

	toggle() {
		if (this.disabled.get()) return;
		this.rootState.toggle(this.value);
	}

	open() {
		this.rootState.openItem(this.value);
	}
}

const AccordionItemCtx = context<AccordionItemState>("AccordionItemCtx");

export const AccordionItem = createComponent(function AccordionItem(
	{ id = getId(), value, disabled = false, ...restProps }: AccordionItemProps,
	...children: Child[]
) {
	return AccordionCtx.Use((rootState) => {
		const state = new AccordionItemState(rootState, value, disabled);
		return AccordionItemCtx.Provide(state).To(
			Div(
				mergeProps(
					{
						id,
						"data-accordion-item": "",
						"data-state": state.state,
						"data-disabled": state.dataDisabled,
						"data-orientation": rootState.opts.orientation,
					},
					restProps,
				),
				...children,
			),
		);
	});
});

export type AccordionTriggerProps = Omit<ComponentProps<typeof Button>, "disabled"> & {
	disabled?: Signal<boolean> | boolean;
};

export const AccordionTrigger = createComponent(function AccordionTrigger(
	{ id = getId(), disabled = false, ...restProps }: AccordionTriggerProps,
	...children: Child[]
) {
	return AccordionItemCtx.Use((state) => {
		state.triggerId.set(resolveId(id));
		const ownDisabled = signal(disabled);
		const isDisabled = derived([ownDisabled, state.disabled], (own, item) => own || item);

		return Button(
			mergeProps(
				{
					id,
					type: "button",
					"data-accordion-trigger": "",
					"data-state": state.state,
					"data-value": state.value,
					"data-disabled": isDisabled.bind((disabled) => (disabled ? "" : undefined)),
					"data-orientation": state.rootState.opts.orientation,
					disabled: isDisabled,
					"aria-expanded": state.isOpen,
					"aria-controls": state.contentId.bind((contentId) => contentId ?? undefined),
					onClick: () => state.toggle(),
					onKeydown: (e: KeyboardEvent) => state.rootState.onTriggerKeydown(e),
				},
				restProps,
			),
			...children,
		);
	});
});

export type AccordionContentProps = ComponentProps<typeof Div> & {
	hiddenUntilFound?: boolean;
};

export const AccordionContent = createComponent(function AccordionContent(
	{ id = getId(), hiddenUntilFound = false, ...restProps }: AccordionContentProps,
	...children: Child[]
) {
	return AccordionItemCtx.Use((state) => {
		state.contentId.set(resolveId(id));
		const contentRef = ref<HTMLDivElement>();
		const { hidden, onMount } = collapsePresence({
			open: state.isOpen,
			ref: contentRef,
			heightVar: CONTENT_HEIGHT_VAR,
			widthVar: CONTENT_WIDTH_VAR,
			hiddenUntilFound,
		});

		return ImplementLifecycle(
			{ onMount },
			Div(
				mergeProps(
					{
						id,
						this: contentRef,
						role: "region",
						"aria-labelledby": state.triggerId.bind((triggerId) => triggerId ?? undefined),
						"data-accordion-content": "",
						"data-state": state.state,
						"data-disabled": state.dataDisabled,
						"data-orientation": state.rootState.opts.orientation,
						onBeforeMatch: () => state.open(),
						hidden,
					},
					restProps,
				),
				...children,
			),
		);
	});
});

export type AccordionHeaderProps = ComponentProps<typeof Div> & {
	level?: 1 | 2 | 3 | 4 | 5 | 6;
};

export const AccordionHeader = createComponent(function AccordionHeader(
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
					"data-disabled": state.dataDisabled,
					"data-orientation": state.rootState.opts.orientation,
					"data-heading-level": level.toString(),
					"aria-level": level,
					role: "heading",
				},
				restProps,
			),
			...children,
		);
	});
});
