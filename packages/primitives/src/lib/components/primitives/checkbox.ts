import {
	Button,
	derived,
	Fragment,
	signal,
	Span,
	type Bindable,
	type Child,
	type ComponentProps,
	type Signal,
} from "@implementjs/core";
import { HiddenInput } from "../../hidden-input";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps, RenderFn } from "../../render";

export type CheckboxProps = RenderableProps<typeof Button> & {
	checked?: Signal<boolean> | boolean;
	indeterminate?: Signal<boolean> | boolean;
	required?: Bindable<boolean>;
	/** Runs whenever the checked state changes. */
	onCheckedChange?: ChangeHandler<boolean>;
	/** Runs whenever the indeterminate state changes. */
	onIndeterminateChange?: ChangeHandler<boolean>;
	/**
	 * Draw the box inside something that is already the control — a
	 * `menuitemcheckbox` row, a selectable card — where a second checkbox would
	 * mean two checked states on one thing. It renders a `Span` rather than a
	 * `Button`, drops `role`, `aria-checked`, and `aria-required`, and sets
	 * `aria-hidden`, so nothing tabs to it and assistive tech reads the control
	 * around it instead. `data-state` and the click toggle stay, so the look and
	 * the behavior are every other checkbox's. Submitting is the real control's
	 * job: `name` renders no hidden input here, and `disabled` is not forwarded.
	 */
	decorative?: boolean;
};

/**
 * The element a decorative checkbox renders. `CheckboxProps` describes the
 * button the control renders, so the props arrive typed for one; a decorative
 * checkbox never sets the button-only ones.
 */
const renderSpan: RenderFn<ComponentProps<typeof Button>> = (props, ...children) =>
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Decorative mode omits every button-only prop before this renders.
	Span(props as ComponentProps<typeof Span>, ...children);

class CheckboxState {
	checked: Signal<boolean>;
	indeterminate: Signal<boolean>;
	constructor(readonly opts: Pick<CheckboxProps, "checked" | "indeterminate">) {
		this.checked = signal(this.opts.checked ?? false);
		this.indeterminate = signal(this.opts.indeterminate ?? false);
	}

	get state() {
		return derived([this.checked, this.indeterminate], (checked, indeterminate) => {
			if (indeterminate) return "indeterminate";
			if (checked) return "checked";
			return "unchecked";
		});
	}

	get ariaChecked() {
		return this.state.bind((value) => {
			if (value === "indeterminate") return "mixed";
			return value === "checked";
		});
	}

	onClick() {
		if (this.indeterminate.get()) {
			this.indeterminate.set(false);
			this.checked.set(true);
			return;
		}

		this.checked.toggle();
	}
}

export const Checkbox = createComponent(function Checkbox(
	{
		id = getId(),
		checked,
		indeterminate,
		name,
		value = "on",
		required,
		disabled,
		decorative = false,
		onCheckedChange,
		onIndeterminateChange,
		// decoration is not a button: a span takes no `type` and nothing tabs to it
		render = decorative ? renderSpan : Button,
		...restProps
	}: CheckboxProps,
	...children: Child[]
) {
	const state = new CheckboxState({ checked, indeterminate });
	return Fragment(
		...changeEffect(state.checked, onCheckedChange),
		...changeEffect(state.indeterminate, onIndeterminateChange),
		render(
			mergeProps(
				{
					id,
					"data-checkbox-root": "",
					"data-state": state.state,
					onClick: () => state.onClick(),
					...(decorative
						? { "aria-hidden": true }
						: {
								type: "button",
								role: "checkbox",
								disabled,
								"aria-checked": state.ariaChecked,
								"aria-required": required,
							}),
				},
				restProps,
			),
			...children,
		),
		...(name == null || decorative
			? []
			: [
					HiddenInput({
						checked: state.checked,
						name,
						value,
						required,
						disabled,
					}),
				]),
	);
});
