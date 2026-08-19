import {
	Button,
	derived,
	signal,
	type Child,
	type ComponentProps,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";

export type CheckboxProps = ComponentProps<typeof Button> & {
	checked?: Signal<boolean> | boolean;
	indeterminate?: Signal<boolean> | boolean;
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
	{ checked, indeterminate, ...restProps }: CheckboxProps,
	...children: Child[]
) {
	const state = new CheckboxState({ checked, indeterminate });
	return Button(
		mergeProps(
			{
				type: "button",
				role: "checkbox",
				"data-checkbox-root": "",
				"data-state": state.state,
				"aria-checked": state.ariaChecked,
				onClick: () => state.onClick(),
			},
			restProps,
		),
		...children,
	);
}
