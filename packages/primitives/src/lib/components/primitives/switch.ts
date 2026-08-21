import {
	Button,
	context,
	signal,
	Span,
	type Bindable,
	type Child,
	type ComponentProps,
	type Signal,
} from "@implementjs/core";
import { HiddenInput } from "../../hidden-input";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";

export type SwitchProps = ComponentProps<typeof Button> & {
	checked?: Signal<boolean> | boolean;
	required?: Bindable<boolean>;
};

const SwitchCtx = context<SwitchState>();

class SwitchState {
	checked: Signal<boolean>;
	constructor(readonly opts: Pick<SwitchProps, "checked">) {
		this.checked = signal(opts.checked ?? false);
	}

	get state() {
		return this.checked.bind((v) => (v ? "checked" : "unchecked"));
	}
}

export const Switch = createComponent(function Switch(
	{ id = getId(), checked, name, value = "on", required, disabled, ...restProps }: SwitchProps,
	...children: Child[]
) {
	const state = new SwitchState({ checked });
	return SwitchCtx.Provide(state).To(
		Button(
			mergeProps(
				{
					id,
					type: "button",
					role: "switch",
					disabled,
					"data-switch-root": "",
					"data-state": state.state,
					"aria-checked": state.checked,
					"aria-required": required,
					onClick: () => state.checked.toggle(),
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
});

export type SwitchThumbProps = ComponentProps<typeof Span>;

export const SwitchThumb = createComponent(function SwitchThumb(
	{ id = getId(), ...restProps }: SwitchThumbProps,
	...children: Child[]
) {
	return SwitchCtx.Use((state) => {
		return Span(
			mergeProps({ "data-switch-thumb": "", "data-state": state.state, id }, restProps),
			...children,
		);
	});
});
