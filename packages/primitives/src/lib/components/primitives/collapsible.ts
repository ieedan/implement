import {
	Button,
	context,
	Div,
	signal,
	type Bindable,
	type Child,
	type ComponentProps,
	type Signal,
} from "@implementjs/core";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";

export type CollapsibleRootProps = ComponentProps<typeof Div> & {
	open?: Signal<boolean> | boolean;
};

const CollapsibleCtx = context<CollapsibleState>();

class CollapsibleState {
	open: Signal<boolean>;
	contentId: Bindable<string> | null = null;
	constructor(opts: { open?: Signal<boolean> | boolean }) {
		this.open = signal(opts.open ?? false);
	}

	registerContent(id: Bindable<string>) {
		this.contentId = id;
	}

	get state() {
		return this.open.bind((v) => (v ? "open" : "closed"));
	}
}

export const Collapsible = createComponent(function Collapsible({ open, ...restProps }: CollapsibleRootProps, ...children: Child[]) {
	const state = new CollapsibleState({ open });
	return CollapsibleCtx.Provide(state).To(
		Div(
			mergeProps({ "data-collapsible-root": "", "data-state": state.state }, restProps),
			...children,
		),
	);
});

export type CollapsibleTriggerProps = ComponentProps<typeof Button>;

export const CollapsibleTrigger = createComponent(function CollapsibleTrigger(
	{ ...restProps }: CollapsibleTriggerProps,
	...children: Child[]
) {
	return CollapsibleCtx.Use((state) => {
		return Button(
			mergeProps(
				{
					type: "button",
					"aria-expanded": state.open,
					"aria-controls": state.contentId,
					"data-collapsible-trigger": "",
					"data-state": state.state,
					onClick: () => state.open.toggle(),
				},
				restProps,
			),
			...children,
		);
	});
});

export type CollapsibleContentProps = ComponentProps<typeof Div> & {
	hiddenUntilFound?: boolean;
};

export const CollapsibleContent = createComponent(function CollapsibleContent(
	{ id = getId(), hiddenUntilFound = false, ...restProps }: CollapsibleContentProps,
	...children: Child[]
) {
	return CollapsibleCtx.Use((state) => {
		state.registerContent(id);
		return Div(
			mergeProps(
				{
					id,
					"data-collapsible-content": "",
					"data-state": state.state,
					onBeforeMatch: () => state.open.set(true),
					hidden: state.open.bind((open) =>
						open ? undefined : hiddenUntilFound ? "until-found" : "",
					),
				},
				restProps,
			),
			...children,
		);
	});
});
