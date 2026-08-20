import {
	Button,
	context,
	derived,
	Div,
	Implement,
	Portal,
	ref,
	Ref,
	signal,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Signal,
} from "@implementjs/core";
import { getId } from "../../utils";
import { focusFirst, trapFocus } from "../../focus";
import { mergeProps } from "../../merge-props";
import { DismissableLayer } from "../helpers/dismissable-layer";
import {
	positionFloatingElement,
	handleOutsideClick,
	type Side,
	type Align,
} from "../helpers/floating-ui";

export type { Side, Align };

export type PopoverRootProps = {
	open?: Signal<boolean> | boolean;
};

class PopoverState {
	open: Signal<boolean>;
	currentTriggerId = signal<string | null>(null);
	triggerRefs = new Map<string, PopoverTriggerState>();
	content: PopoverContentState | null = null;
	autoUpdateDispose: (() => void) | null = null;
	/** First trigger that registered with `default: true`, if any. */
	private defaultTriggerId: string | null = null;

	constructor(readonly opts: PopoverRootProps) {
		this.open = signal(this.opts.open ?? false);
	}

	registerTrigger(triggerId: string, trigger: PopoverTriggerState, isDefault = false) {
		this.triggerRefs.set(triggerId, trigger);
		if (isDefault && this.defaultTriggerId == null) this.defaultTriggerId = triggerId;

		// Assign the id during tree build so data-state is correct on first paint.
		// Positioning waits for onMount, when refs exist.
		if (this.open.get()) this.currentTriggerId.set(this.pickTrigger());
	}

	registerContent(content: PopoverContentState) {
		this.content = content;
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	toggle(triggerId: string) {
		if (this.open.get() && this.currentTriggerId.get() === triggerId) {
			this.open.set(false);
			return;
		}

		this.currentTriggerId.set(triggerId);
		if (this.open.get()) {
			this.follow(triggerId);
			return;
		}
		this.openAndFocus();
	}

	private openAndFocus() {
		this.open.set(true);
		focusFirst(this.content?.opts.ref.get());
	}

	close() {
		const currentTrigger = this.triggerRefs.get(this.currentTriggerId.get() ?? "");
		if (currentTrigger) {
			currentTrigger.opts.ref.get()?.focus({ preventScroll: true });
		}
		this.open.set(false);
		this.currentTriggerId.set(null);
		this.unfollow();
	}

	/** If open with no click yet, pick the default (or first) trigger and start following it. */
	ensureAnchor() {
		if (!this.open.get()) return;
		let id = this.currentTriggerId.get();
		if (id == null || !this.triggerRefs.has(id)) {
			id = this.pickTrigger();
			this.currentTriggerId.set(id);
		}
		if (id != null) this.follow(id);
	}

	releaseAnchor() {
		this.unfollow();
		this.currentTriggerId.set(null);
	}

	private pickTrigger(): string | null {
		if (this.defaultTriggerId != null && this.triggerRefs.has(this.defaultTriggerId)) {
			return this.defaultTriggerId;
		}
		return this.triggerRefs.keys().next().value ?? null;
	}

	private follow(triggerId: string) {
		const trigger = this.triggerRefs.get(triggerId);
		const content = this.content;
		if (!trigger || !content) return;

		const triggerEl = trigger.opts.ref.get();
		const contentEl = content.opts.ref.get();
		if (!triggerEl || !contentEl) return;

		this.unfollow();
		this.autoUpdateDispose = positionFloatingElement(triggerEl, contentEl, {
			componentName: "popover",
			side: content.opts.side,
			align: content.opts.align,
			offset: content.opts.offset,
			strategy: "absolute",
			autoUpdate: true,
		});
	}

	private unfollow() {
		this.autoUpdateDispose?.();
		this.autoUpdateDispose = null;
	}

	onPointerdown(e: PointerEvent) {
		if (!this.open.get()) return;

		handleOutsideClick(
			e,
			[...this.triggerRefs.values()].map((t) => t.opts.ref.get()),
			this.content?.opts.ref.get(),
			{
				onClose: () => this.close(),
			},
		);
	}

	contentKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case "Tab":
				trapFocus(e, this.content?.opts.ref.get());
				return;
		}
	}

	dispose() {
		this.unfollow();
	}
}

const PopoverContext = context<PopoverState>();

export function Popover(props: PopoverRootProps, ...children: Child[]) {
	const state = new PopoverState(props);
	return DismissableLayer(
		{ open: state.open, onDismiss: () => state.close() },
		PopoverContext.Provide(state).To(
			Implement.Document({
				onPointerdown: (e) => state.onPointerdown(e),
			}),
			Implement.Lifecycle(
				{
					onMount: () => {
						if (state.open.get()) state.ensureAnchor();
						return state.open.onChange((open) => {
							if (open) state.ensureAnchor();
							else state.releaseAnchor();
						});
					},
					onUnmount: () => state.dispose(),
				},
				...children,
			),
		),
	);
}

export type PopoverTriggerProps = ComponentProps<typeof Button> & {
	/** When the popover starts open, anchor to this trigger instead of the first one. */
	default?: boolean;
};

class PopoverTriggerState {
	constructor(
		readonly rootState: PopoverState,
		readonly opts: { id: string; ref: Ref<HTMLButtonElement> },
		isDefault = false,
	) {
		this.rootState.registerTrigger(opts.id, this, isDefault);
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get open() {
		return derived([this.rootState.open, this.rootState.currentTriggerId], (open, current) =>
			open && current === this.opts.id ? true : false,
		);
	}

	toggle() {
		this.rootState.toggle(this.opts.id);
	}
}

export function PopoverTrigger(
	{ default: isDefault = false, ...restProps }: PopoverTriggerProps,
	...children: Child[]
) {
	return PopoverContext.Use((rootState) => {
		const triggerRef = ref<HTMLButtonElement>();
		const triggerId = getId();
		const triggerState = new PopoverTriggerState(
			rootState,
			{ id: triggerId, ref: triggerRef },
			isDefault,
		);

		return Button(
			mergeProps(
				{
					this: triggerRef,
					type: "button",
					"data-popover-trigger": "",
					"data-state": triggerState.state,
					"aria-haspopup": "dialog",
					"aria-expanded": triggerState.open,
					onClick: () => triggerState.toggle(),
				},
				restProps,
			),
			...children,
		);
	});
}

export type PopoverContentProps = ComponentProps<typeof Div> & {
	side?: Side;
	align?: Align;
	offset?: number;
};

class PopoverContentState {
	constructor(
		readonly rootState: PopoverState,
		readonly opts: { ref: Ref<HTMLDivElement>; side: Side; align: Align; offset: number },
	) {
		rootState.registerContent(this);
	}
}

export function PopoverContent(
	{ side = "bottom", align = "start", offset = 0, ...restProps }: PopoverContentProps,
	...children: Child[]
) {
	return PopoverContext.Use((rootState) => {
		const contentRef = ref<HTMLDivElement>();
		new PopoverContentState(rootState, {
			ref: contentRef,
			side,
			align,
			offset,
		});

		return Div(
			mergeProps(
				{
					this: contentRef,
					"data-popover-content": "",
					tabIndex: -1,
					"data-state": rootState.state,
					onKeydown: (e: KeyboardEvent) => rootState.contentKeydown(e),
				},
				restProps,
			),
			...children,
		);
	});
}

export type PopoverPortalProps = PortalProps;

export const PopoverPortal = Portal;

export type PopoverCloseProps = ComponentProps<typeof Button>;

export function PopoverClose({ ...restProps }: PopoverCloseProps, ...children: Child[]) {
	return PopoverContext.Use((state) => {
		return Button(
			mergeProps(
				{
					type: "button",
					onClick: () => state.close(),
				},
				restProps,
			),
			...children,
		);
	});
}
