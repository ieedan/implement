import {
	Button,
	context,
	derived,
	Div,
	ref,
	signal,
	type Bindable,
	type Child,
	type Readable,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { handleRovingKeydown } from "../helpers/roving-focus";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type RadioGroupRootProps = RenderableProps<typeof Div> & {
	value?: Signal<string | null> | string | null;
	/** Runs whenever the selected item changes. `null` while nothing is selected. */
	onValueChange?: ChangeHandler<string | null>;
	disabled?: Readable<boolean> | boolean;
	required?: Bindable<boolean>;
	/** Whether arrow keys wrap from the last item back to the first. */
	loop?: boolean;
	orientation?: "horizontal" | "vertical";
};

const RadioGroupCtx = context<RadioGroupState>("RadioGroupCtx");

class RadioGroupState {
	value: Signal<string | null>;
	disabled: Readable<boolean>;
	/** The one item reachable with Tab; arrow keys move between the rest. */
	tabStop = signal<string | null>(null);
	constructor(
		readonly opts: Required<Pick<RadioGroupRootProps, "loop" | "orientation">>,
		readonly ref: Ref<HTMLDivElement>,
		value: RadioGroupRootProps["value"],
		disabled: Readable<boolean> | boolean,
	) {
		this.value = signal(value ?? null);
		this.disabled = toReadable(disabled);
		const initial = this.value.get();
		if (initial !== null) this.tabStop.set(initial);
	}

	register(itemValue: string) {
		if (this.tabStop.get() === null) this.tabStop.set(itemValue);
	}

	select(itemValue: string) {
		if (this.disabled.get()) return;
		this.value.set(itemValue);
		this.tabStop.set(itemValue);
	}

	onItemKeydown(e: KeyboardEvent) {
		handleRovingKeydown(e, {
			root: this.ref,
			candidateAttr: "data-radio-group-item",
			loop: this.opts.loop,
			orientation: this.opts.orientation,
			bothAxes: true,
		});
	}
}

export const RadioGroup = createComponent(function RadioGroup(
	{
		id = getId(),
		value,
		onValueChange,
		disabled = false,
		required,
		loop = true,
		orientation = "vertical",
		render = Div,
		...restProps
	}: RadioGroupRootProps,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const state = new RadioGroupState({ loop, orientation }, root, value, disabled);

	return RadioGroupCtx.Provide(state).To(
		...changeEffect(state.value, onValueChange),
		render(
			mergeProps(
				{
					id,
					this: root,
					role: "radiogroup",
					"aria-required": required,
					"aria-disabled": state.disabled,
					"data-radio-group-root": "",
					"data-orientation": orientation,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
				},
				restProps,
			),
			...children,
		),
	);
});

export type RadioGroupItemProps = Omit<RenderableProps<typeof Button>, "disabled" | "value"> & {
	/** Identifies the item. Must be unique within the group. */
	value: string;
	disabled?: Readable<boolean> | boolean;
};

export const RadioGroupItem = createComponent(function RadioGroupItem(
	{ id = getId(), value, disabled = false, render = Button, ...restProps }: RadioGroupItemProps,
	...children: Child[]
) {
	return RadioGroupCtx.Use((root) => {
		root.register(value);
		const ownDisabled = toReadable(disabled);
		const isDisabled = derived([ownDisabled, root.disabled], (own, group) => own || group);
		const checked = root.value.bind((current) => current === value);

		return render(
			mergeProps(
				{
					id,
					type: "button",
					role: "radio",
					"aria-checked": checked,
					"data-radio-group-item": "",
					"data-value": value,
					"data-orientation": root.opts.orientation,
					"data-state": checked.bind((checked) => (checked ? "checked" : "unchecked")),
					"data-disabled": isDisabled.bind((disabled) => (disabled ? "" : undefined)),
					disabled: isDisabled,
					tabIndex: root.tabStop.bind((tabStop) => (tabStop === value ? 0 : -1)),
					onClick: () => root.select(value),
					onFocus: () => {
						root.tabStop.set(value);
						// arrowing through a group that has a value moves the selection with it
						if (root.value.get() !== null) root.select(value);
					},
					onKeydown: (e: KeyboardEvent) => root.onItemKeydown(e),
				},
				restProps,
			),
			...children,
		);
	});
});
