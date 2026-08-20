import { Button, signal, type Child, type ComponentProps, type Signal } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";

export type ToggleProps = Omit<ComponentProps<typeof Button>, "disabled"> & {
	pressed?: Signal<boolean> | boolean;
	disabled?: Signal<boolean> | boolean;
};

/**
 * A two-state button that can be on or off, like bold in a text editor.
 * Renders a `Button` with `aria-pressed`; give it a look and children, it
 * handles the state. For a binary form choice use `Checkbox` instead — the
 * two announce differently to assistive technology.
 */
export function Toggle(
	{ id = getId(), pressed = false, disabled = false, ...restProps }: ToggleProps,
	...children: Child[]
) {
	const pressedSignal = signal(pressed);
	const disabledSignal = signal(disabled);

	return Button(
		mergeProps(
			{
				id,
				type: "button",
				"aria-pressed": pressedSignal,
				"data-toggle-root": "",
				"data-state": pressedSignal.bind((pressed) => (pressed ? "on" : "off")),
				"data-disabled": disabledSignal.bind((disabled) => (disabled ? "" : undefined)),
				disabled: disabledSignal,
				onClick: () => {
					if (disabledSignal.get()) return;
					pressedSignal.toggle();
				},
			},
			restProps,
		),
		...children,
	);
}
