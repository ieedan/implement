import {
	Button,
	context,
	derived,
	Div,
	ref,
	signal,
	type Child,
	type ComponentProps,
	type Readable,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { handleRovingKeydown } from "../helpers/roving-focus";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";

export type ToggleGroupRootProps<T extends "single" | "multiple" = "single"> = (T extends "multiple"
	? {
			type: "multiple";
			value?: Signal<string[]>;
			/** Runs whenever the set of pressed items changes. */
			onValueChange?: ChangeHandler<string[]>;
		}
	: {
			type?: "single";
			value?: Signal<string | null>;
			/** Runs whenever the pressed item changes. `null` once nothing is pressed. */
			onValueChange?: ChangeHandler<string | null>;
		}) &
	ComponentProps<typeof Div> & {
		disabled?: Readable<boolean> | boolean;
		/** Whether arrow keys wrap from the last item back to the first. */
		loop?: boolean;
		orientation?: "horizontal" | "vertical";
	};

const ToggleGroupCtx = context<ToggleGroupState>("ToggleGroupCtx");

abstract class ToggleGroupState {
	disabled: Readable<boolean>;
	/** The one item reachable with Tab; arrow keys move between the rest. */
	tabStop = signal<string | null>(null);
	abstract readonly multiple: boolean;
	constructor(
		readonly opts: { loop: boolean; orientation: "horizontal" | "vertical" },
		readonly ref: Ref<HTMLDivElement>,
		disabled: Readable<boolean> | boolean,
	) {
		this.disabled = toReadable(disabled);
	}

	abstract isPressed(value: string): Readable<boolean>;
	abstract isPressedNow(value: string): boolean;
	abstract toggle(value: string): void;

	register(itemValue: string) {
		const current = this.tabStop.get();
		if (current === null || (this.isPressedNow(itemValue) && !this.isPressedNow(current))) {
			this.tabStop.set(itemValue);
		}
	}

	press(itemValue: string) {
		if (this.disabled.get()) return;
		this.toggle(itemValue);
	}

	onItemKeydown(e: KeyboardEvent) {
		handleRovingKeydown(e, {
			root: this.ref,
			candidateAttr: "data-toggle-group-item",
			loop: this.opts.loop,
			orientation: this.opts.orientation,
		});
	}
}

class ToggleGroupSingleState extends ToggleGroupState {
	value: Signal<string | null>;
	readonly multiple = false;
	constructor(
		opts: { loop: boolean; orientation: "horizontal" | "vertical" },
		rootRef: Ref<HTMLDivElement>,
		disabled: Readable<boolean> | boolean,
		value?: Signal<string | null>,
	) {
		super(opts, rootRef, disabled);
		this.value = value ?? signal<string | null>(null);
	}

	isPressed(value: string) {
		return this.value.bind((current) => current === value);
	}

	isPressedNow(value: string) {
		return this.value.get() === value;
	}

	toggle(value: string) {
		this.value.update((current) => (current === value ? null : value));
	}
}

class ToggleGroupMultipleState extends ToggleGroupState {
	value: Signal<string[]>;
	readonly multiple = true;
	constructor(
		opts: { loop: boolean; orientation: "horizontal" | "vertical" },
		rootRef: Ref<HTMLDivElement>,
		disabled: Readable<boolean> | boolean,
		value?: Signal<string[]>,
	) {
		super(opts, rootRef, disabled);
		this.value = value ?? signal<string[]>([]);
	}

	isPressed(value: string) {
		return this.value.bind((current) => current.includes(value));
	}

	isPressedNow(value: string) {
		return this.value.get().includes(value);
	}

	toggle(value: string) {
		this.value.update((current) =>
			current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
		);
	}
}

export const ToggleGroup = createComponent(function ToggleGroup(
	{
		id = getId(),
		type = "single",
		value,
		onValueChange,
		disabled = false,
		loop = true,
		orientation = "horizontal",
		...restProps
	}: ToggleGroupRootProps<"single" | "multiple">,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const opts = { loop, orientation };
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Discriminated `type` prop selects the matching toggle-group state class. */
	const state =
		type === "multiple"
			? new ToggleGroupMultipleState(opts, root, disabled, value as Signal<string[]> | undefined)
			: new ToggleGroupSingleState(
					opts,
					root,
					disabled,
					value as Signal<string | null> | undefined,
				);
	// the same `type` decides which shape the callback is handed
	const valueChange = changeEffect(
		state.value as Readable<string | string[] | null>,
		onValueChange as ChangeHandler<string | string[] | null> | undefined,
	);
	/* oxlint-enable typescript/no-unsafe-type-assertion */

	return ToggleGroupCtx.Provide(state).To(
		...valueChange,
		Div(
			mergeProps(
				{
					id,
					this: root,
					role: "group",
					"data-toggle-group-root": "",
					"data-orientation": orientation,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
				},
				restProps,
			),
			...children,
		),
	);
});

export type ToggleGroupItemProps = Omit<ComponentProps<typeof Button>, "disabled" | "value"> & {
	/** Identifies the item. Must be unique within the group. */
	value: string;
	disabled?: Readable<boolean> | boolean;
};

export const ToggleGroupItem = createComponent(function ToggleGroupItem(
	{ id = getId(), value, disabled = false, ...restProps }: ToggleGroupItemProps,
	...children: Child[]
) {
	return ToggleGroupCtx.Use((root) => {
		root.register(value);
		const ownDisabled = toReadable(disabled);
		const isDisabled = derived([ownDisabled, root.disabled], (own, group) => own || group);
		const pressed = root.isPressed(value);

		return Button(
			mergeProps(
				{
					id,
					type: "button",
					// a single-select group announces as a radio group's options
					role: root.multiple ? undefined : "radio",
					"aria-checked": root.multiple ? undefined : pressed,
					"aria-pressed": root.multiple ? pressed : undefined,
					"data-toggle-group-item": "",
					"data-value": value,
					"data-orientation": root.opts.orientation,
					"data-state": pressed.bind((pressed) => (pressed ? "on" : "off")),
					"data-disabled": isDisabled.bind((disabled) => (disabled ? "" : undefined)),
					disabled: isDisabled,
					tabIndex: root.tabStop.bind((tabStop) => (tabStop === value ? 0 : -1)),
					onClick: () => root.press(value),
					onFocus: () => root.tabStop.set(value),
					onKeydown: (e: KeyboardEvent) => root.onItemKeydown(e),
				},
				restProps,
			),
			...children,
		);
	});
});
