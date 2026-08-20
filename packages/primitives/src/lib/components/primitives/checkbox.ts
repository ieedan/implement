import {
	Button,
	derived,
	Fragment,
	signal,
	type Bindable,
	type Child,
	type ComponentProps,
	type Signal,
} from "@implementjs/core";
import { HiddenInput } from "../../hidden-input";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";

export type CheckboxProps = ComponentProps<typeof Button> & {
	checked?: Signal<boolean> | boolean;
	indeterminate?: Signal<boolean> | boolean;
	required?: Bindable<boolean>;
};

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

export function Checkbox(
	{
		id = getId(),
		checked,
		indeterminate,
		name,
		value = "on",
		required,
		disabled,
		...restProps
	}: CheckboxProps,
	...children: Child[]
) {
	const state = new CheckboxState({ checked, indeterminate });
	return Fragment(
		Button(
			mergeProps(
				{
					id,
					type: "button",
					role: "checkbox",
					disabled,
					"data-checkbox-root": "",
					"data-state": state.state,
					"aria-checked": state.ariaChecked,
					"aria-required": required,
					onClick: () => state.onClick(),
				},
				restProps,
			),
			...children,
		),
		...(name == null
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
}
