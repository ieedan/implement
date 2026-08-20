import {
	Button,
	context,
	derived,
	Div,
	ref,
	signal,
	type Bindable,
	type Child,
	type ComponentProps,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { handleRovingKeydown } from "../helpers/roving-focus";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";

export type RadioGroupRootProps = ComponentProps<typeof Div> & {
	value?: Signal<string | null> | string | null;
	disabled?: Signal<boolean> | boolean;
	required?: Bindable<boolean>;
	/** Whether arrow keys wrap from the last item back to the first. */
	loop?: boolean;
	orientation?: "horizontal" | "vertical";
};

const RadioGroupCtx = context<RadioGroupState>();

class RadioGroupState {
	value: Signal<string | null>;
	disabled: Signal<boolean>;
	/** The one item reachable with Tab; arrow keys move between the rest. */
	tabStop = signal<string | null>(null);
	constructor(
		readonly opts: Required<Pick<RadioGroupRootProps, "loop" | "orientation">>,
		readonly ref: Ref<HTMLDivElement>,
		value: RadioGroupRootProps["value"],
		disabled: Signal<boolean> | boolean,
	) {
		this.value = signal(value ?? null);
		this.disabled = signal(disabled);
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

export function RadioGroup(
	{
		id = getId(),
		value,
		disabled = false,
		required,
		loop = true,
		orientation = "vertical",
		...restProps
	}: RadioGroupRootProps,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const state = new RadioGroupState({ loop, orientation }, root, value, disabled);

	return RadioGroupCtx.Provide(state).To(
		Div(
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
}

export type RadioGroupItemProps = Omit<ComponentProps<typeof Button>, "disabled" | "value"> & {
	/** Identifies the item. Must be unique within the group. */
	value: string;
	disabled?: Signal<boolean> | boolean;
};

export function RadioGroupItem(
	{ id = getId(), value, disabled = false, ...restProps }: RadioGroupItemProps,
	...children: Child[]
) {
	return RadioGroupCtx.Use((root) => {
		root.register(value);
		const disabledSignal = signal(disabled);
		const isDisabled = derived([disabledSignal, root.disabled], (own, group) => own || group);
		const checked = root.value.bind((current) => current === value);

		return Button(
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
}
