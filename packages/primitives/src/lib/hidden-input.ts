import { Input, type Bindable, type Child } from "@implementjs/core";

const hiddenInputStyle = {
	position: "absolute",
	transform: "translateX(-100%)",
	pointerEvents: "none",
	opacity: "0",
	margin: "0",
};

export type HiddenInputProps = {
	checked: Bindable<boolean>;
	name?: Bindable<string>;
	value?: Bindable<string | number>;
	required?: Bindable<boolean>;
	disabled?: Bindable<boolean>;
};

/**
 * Native checkbox that submits with the form and stays out of the
 * accessibility tree. Omitted when `name` is unset.
 */
export function HiddenInput({
	checked,
	name,
	value = "on",
	required,
	disabled,
}: HiddenInputProps): Child {
	if (name == null) return null;

	return Input({
		type: "checkbox",
		"aria-hidden": true,
		tabIndex: -1,
		checked,
		name,
		value,
		required,
		disabled,
		style: hiddenInputStyle,
	});
}
