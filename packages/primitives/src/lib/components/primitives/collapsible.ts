import {
	Button,
	context,
	Div,
	ImplementLifecycle,
	ref,
	signal,
	type Bindable,
	type Child,
	type Signal,
} from "@implementjs/core";
import { collapsePresence } from "../helpers/collapse-presence";
import { mergeProps } from "../../merge-props";
import { getId, LIB_PREFIX, resolveId } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

const CONTENT_HEIGHT_VAR = `--${LIB_PREFIX}-collapsible-content-height`;
const CONTENT_WIDTH_VAR = `--${LIB_PREFIX}-collapsible-content-width`;

export type CollapsibleRootProps = RenderableProps<typeof Div> & {
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
	{ open, render = Div, ...restProps }: CollapsibleRootProps,
	...children: Child[]
) {
	const state = new CollapsibleState({ open });
	return CollapsibleCtx.Provide(state).To(
		render(
			mergeProps({ "data-collapsible-root": "", "data-state": state.state }, restProps),
			...children,
		),
	);
});

export type CollapsibleTriggerProps = RenderableProps<typeof Button>;

export const CollapsibleTrigger = createComponent(function CollapsibleTrigger(
	{ render = Button, ...restProps }: CollapsibleTriggerProps,
	...children: Child[]
) {
	return CollapsibleCtx.Use((state) => {
		return render(
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

export type CollapsibleContentProps = RenderableProps<typeof Div> & {
	hiddenUntilFound?: boolean;
};

export const CollapsibleContent = createComponent(function CollapsibleContent(
	{ id = getId(), hiddenUntilFound = false, render = Div, ...restProps }: CollapsibleContentProps,
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
			render(
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
