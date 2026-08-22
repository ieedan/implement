import {
	Button,
	context,
	Div,
	ImplementLifecycle,
	ref,
	signal,
	type Bindable,
	type Child,
	type ComponentProps,
	type Signal,
} from "@implementjs/core";
import { collapsePresence } from "../helpers/collapse-presence";
import { mergeProps } from "../../merge-props";
import { getId, LIB_PREFIX, resolveId } from "../../utils";
import { createComponent } from "../../create-component";

const CONTENT_HEIGHT_VAR = `--${LIB_PREFIX}-collapsible-content-height`;
const CONTENT_WIDTH_VAR = `--${LIB_PREFIX}-collapsible-content-width`;

export type CollapsibleRootProps = ComponentProps<typeof Div> & {
	open?: Signal<boolean> | boolean;
};

const CollapsibleCtx = context<CollapsibleState>("CollapsibleCtx");

class CollapsibleState {
	open: Signal<boolean>;
	/** The content's id, so the trigger can point at it with `aria-controls`. */
	contentId = signal<string | null>(null);
	constructor(opts: { open?: Signal<boolean> | boolean }) {
		this.open = signal(opts.open ?? false);
	}

	registerContent(id: Bindable<string>) {
		this.contentId.set(resolveId(id));
	}

	get state() {
		return this.open.bind((v) => (v ? "open" : "closed"));
	}
}

export const Collapsible = createComponent(function Collapsible(
	{ open, ...restProps }: CollapsibleRootProps,
	...children: Child[]
) {
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
					"aria-controls": state.contentId.bind((contentId) => contentId ?? undefined),
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
		const contentRef = ref<HTMLDivElement>();
		const { hidden, onMount } = collapsePresence({
			open: state.open,
			ref: contentRef,
			heightVar: CONTENT_HEIGHT_VAR,
			widthVar: CONTENT_WIDTH_VAR,
			hiddenUntilFound,
		});

		return ImplementLifecycle(
			{ onMount },
			Div(
				mergeProps(
					{
						id,
						this: contentRef,
						"data-collapsible-content": "",
						"data-state": state.state,
						onBeforeMatch: () => state.open.set(true),
						hidden,
					},
					restProps,
				),
				...children,
			),
		);
	});
});
