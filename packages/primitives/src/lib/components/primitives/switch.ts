import {
	Button,
	context,
	signal,
	Span,
	type Bindable,
	type Child,
	type Signal,
} from "@implementjs/core";
import { HiddenInput } from "../../hidden-input";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

export type SwitchProps = RenderableProps<typeof Button> & {
	checked?: Signal<boolean> | boolean;
	required?: Bindable<boolean>;
};

const SwitchCtx = context<SwitchState>("SwitchCtx");

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
	{
		id = getId(),
		checked,
		name,
		value = "on",
		required,
		disabled,
		render = Button,
		...restProps
	}: SwitchProps,
	...children: Child[]
) {
	const state = new SwitchState({ checked });
	return SwitchCtx.Provide(state).To(
		render(
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

export type SwitchThumbProps = RenderableProps<typeof Span>;

export const SwitchThumb = createComponent(function SwitchThumb(
	{ id = getId(), render = Span, ...restProps }: SwitchThumbProps,
	...children: Child[]
) {
	return SwitchCtx.Use((state) => {
		return render(
			mergeProps({ "data-switch-thumb": "", "data-state": state.state, id }, restProps),
			...children,
		);
	});
});
