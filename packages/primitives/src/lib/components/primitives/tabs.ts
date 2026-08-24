import {
	Button,
	context,
	derived,
	Div,
	ImplementMap,
	ref,
	signal,
	type Child,
	type ReactiveMap,
	type Ref,
	type Signal,
} from "@implementjs/core";
import { handleRovingKeydown } from "../helpers/roving-focus";
import { mergeProps } from "../../merge-props";
import { getId } from "../../utils";
import { createComponent } from "../../create-component";
import type { RenderableProps } from "../../render";

/**
 * `"automatic"` selects a tab as soon as its trigger is focused, `"manual"`
 * waits for a click or Space/Enter.
 */
export type TabsActivationMode = "automatic" | "manual";

export type TabsRootProps = RenderableProps<typeof Div> & {
	/** The selected tab. Pass a signal to control it from outside; a string seeds uncontrolled state. */
	value?: Signal<string> | string;
	orientation?: "horizontal" | "vertical";
	/** Whether arrow keys wrap from the last trigger back to the first. */
	loop?: boolean;
	activationMode?: TabsActivationMode;
	disabled?: Signal<boolean> | boolean;
};

const TabsCtx = context<TabsState>("TabsCtx");

class TabsState {
	value: Signal<string>;
	disabled: Signal<boolean>;
	/** Trigger ids by tab value, so each panel can point back at its trigger. */
	triggerIds: ReactiveMap<string, string> = ImplementMap<string, string>();
	/** Content ids by tab value, so each trigger can point at its panel. */
	contentIds: ReactiveMap<string, string> = ImplementMap<string, string>();

	constructor(
		readonly opts: Required<Pick<TabsRootProps, "loop" | "orientation" | "activationMode">>,
		readonly ref: Ref<HTMLDivElement>,
		value: TabsRootProps["value"],
		disabled: Signal<boolean> | boolean,
	) {
		this.value = signal(value ?? "");
		this.disabled = signal(disabled);
	}

	select(tabValue: string) {
		if (this.value.get() === tabValue) return;
		this.value.set(tabValue);
	}

	onTriggerKeydown(e: KeyboardEvent) {
		handleRovingKeydown(e, {
			root: this.ref,
			candidateAttr: "data-tabs-trigger",
			loop: this.opts.loop,
			orientation: this.opts.orientation,
		});
	}
}

/**
 * A set of panels where one shows at a time. `Tabs` is the root and owns the
 * selected value; `TabsList` holds the `TabsTrigger`s and each `TabsContent`
 * is the panel for one value.
 */
export const Tabs = createComponent(function Tabs(
	{
		id = getId(),
		value,
		orientation = "horizontal",
		loop = true,
		activationMode = "automatic",
		disabled = false,
		render = Div,
		...restProps
	}: TabsRootProps,
	...children: Child[]
) {
	const root = ref<HTMLDivElement>();
	const state = new TabsState({ loop, orientation, activationMode }, root, value, disabled);

	return TabsCtx.Provide(state).To(
		render(
			mergeProps(
				{
					id,
					this: root,
					"data-tabs-root": "",
					"data-orientation": orientation,
					"data-disabled": state.disabled.bind((disabled) => (disabled ? "" : undefined)),
				},
				restProps,
			),
			...children,
		),
	);
});

export type TabsListProps = RenderableProps<typeof Div>;

export const TabsList = createComponent(function TabsList(
	{ id = getId(), render = Div, ...restProps }: TabsListProps,
	...children: Child[]
) {
	return TabsCtx.Use((root) => {
		return render(
			mergeProps(
				{
					id,
					role: "tablist",
					"aria-orientation": root.opts.orientation,
					"data-tabs-list": "",
					"data-orientation": root.opts.orientation,
					"data-disabled": root.disabled.bind((disabled) => (disabled ? "" : undefined)),
				},
				restProps,
			),
			...children,
		);
	});
});

export type TabsTriggerProps = Omit<RenderableProps<typeof Button>, "disabled" | "value" | "id"> & {
	/** Identifies the tab. Must match the `TabsContent` it opens. */
	value: string;
	/** Plain string: the panel points back at it with `aria-labelledby`. */
	id?: string;
	disabled?: Signal<boolean> | boolean;
};

export const TabsTrigger = createComponent(function TabsTrigger(
	{ id = getId(), value, disabled = false, render = Button, ...restProps }: TabsTriggerProps,
	...children: Child[]
) {
	return TabsCtx.Use((root) => {
		root.triggerIds.set(value, id);
		const disabledSignal = signal(disabled);
		const isDisabled = derived([disabledSignal, root.disabled], (own, group) => own || group);
		const selected = root.value.bind((current) => current === value);

		const activate = () => {
			if (isDisabled.get()) return;
			root.select(value);
		};

		return render(
			mergeProps(
				{
					id,
					type: "button",
					role: "tab",
					"aria-selected": selected,
					"aria-controls": root.contentIds.bind((ids) => ids.get(value)),
					"data-tabs-trigger": "",
					"data-value": value,
					"data-orientation": root.opts.orientation,
					"data-state": selected.bind((selected) => (selected ? "active" : "inactive")),
					"data-disabled": isDisabled.bind((disabled) => (disabled ? "" : undefined)),
					disabled: isDisabled,
					// before anything is selected every trigger is reachable with Tab;
					// once one is, it becomes the group's only tab stop
					tabIndex: root.value.bind((current) => (current === value || !current ? 0 : -1)),
					onClick: () => activate(),
					onFocus: () => {
						if (root.opts.activationMode !== "automatic") return;
						activate();
					},
					onKeydown: (e: KeyboardEvent) => {
						if (isDisabled.get()) return;
						if (e.key === " " || e.key === "Enter") {
							e.preventDefault();
							activate();
							return;
						}
						root.onTriggerKeydown(e);
					},
				},
				restProps,
			),
			...children,
		);
	});
});

export type TabsContentProps = Omit<RenderableProps<typeof Div>, "id"> & {
	/** Identifies the panel. Must match the `TabsTrigger` that opens it. */
	value: string;
	/** Plain string: the trigger points at it with `aria-controls`. */
	id?: string;
};

export const TabsContent = createComponent(function TabsContent(
	{ id = getId(), value, render = Div, ...restProps }: TabsContentProps,
	...children: Child[]
) {
	return TabsCtx.Use((root) => {
		root.contentIds.set(value, id);
		const selected = root.value.bind((current) => current === value);

		return render(
			mergeProps(
				{
					id,
					role: "tabpanel",
					tabIndex: 0,
					"aria-labelledby": root.triggerIds.bind((ids) => ids.get(value)),
					"data-tabs-content": "",
					"data-value": value,
					"data-orientation": root.opts.orientation,
					"data-state": selected.bind((selected) => (selected ? "active" : "inactive")),
					hidden: selected.bind((selected) => !selected),
				},
				restProps,
			),
			...children,
		);
	});
});
