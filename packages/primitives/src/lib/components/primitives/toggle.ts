import { Button, signal, type Child, type Readable, type Signal } from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { withChangeEffect, type ChangeHandler } from "../../on-change";
import { getId, toReadable } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type ToggleProps = Omit<RenderableProps<typeof Button>, "disabled"> & {
	pressed?: Signal<boolean> | boolean;
	disabled?: Readable<boolean> | boolean;
	/** Runs whenever the pressed state changes. */
	onPressedChange?: ChangeHandler<boolean>;
};

/**
 * A two-state button that can be on or off, like bold in a text editor.
 * Renders a `Button` with `aria-pressed`; give it a look and children, it
 * handles the state. For a binary form choice use `Checkbox` instead — the
 * two announce differently to assistive technology.
 */
export const Toggle = createComponent(function Toggle(
	{
		id = getId(),
		pressed = false,
		disabled = false,
		onPressedChange,
		render = Button,
		...restProps
	}: ToggleProps,
	...children: Child[]
) {
	const pressedSignal = signal(pressed);
	const isDisabled = toReadable(disabled);

	return withChangeEffect(
		render(
			mergeProps(
				{
					id,
					type: "button",
					"aria-pressed": pressedSignal,
					"data-toggle-root": "",
					"data-state": pressedSignal.bind((pressed) => (pressed ? "on" : "off")),
					"data-disabled": isDisabled.bind((disabled) => (disabled ? "" : undefined)),
					disabled: isDisabled,
					onClick: () => {
						if (isDisabled.get()) return;
						pressedSignal.toggle();
					},
				},
				restProps,
			),
			...children,
		),
		pressedSignal,
		onPressedChange,
	);
});
