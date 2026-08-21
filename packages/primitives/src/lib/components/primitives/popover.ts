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
	type Bindable,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Signal,
} from "@implementjs/core";
import { getId, noop, type MaybeReadable } from "../../utils";
import { focusFirst, trapFocus } from "../../focus";
import { mergeProps } from "../../merge-props";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";
import { positionFloatingElement, type Side, type Align } from "../helpers/floating-ui";
import { ScrollLock } from "../helpers/scroll-lock";
import { createComponent } from "../../create-component";

export type { Side, Align };

export type PopoverRootProps = {
	open?: Signal<boolean> | boolean;
	/** When true, the page behind cannot scroll while the popover is open. Defaults to false. */
	preventScroll?: boolean;
};

class PopoverState {
	open: Signal<boolean>;
	currentTriggerId = signal<string | null>(null);
	triggerRefs = Implement.Map<string, PopoverTriggerState>();
	content = signal<PopoverContentState | null>(null);
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
		this.content.set(content);
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get contentEl() {
		return derived([this.content], (c) => (c === null ? null : c.opts.ref.get()));
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
		focusFirst(this.content.get()?.opts.ref.get());
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
		const content = this.content.get();
		if (!trigger || content === null) return;

		const triggerEl = trigger.opts.ref.get();
		const contentEl = content?.opts.ref.get();
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

	contentKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case "Tab":
				trapFocus(e, this.content.get()?.opts.ref.get());
				return;
		}
	}

	dispose() {
		this.unfollow();
	}
}

const PopoverContext = context<PopoverState>();

export const Popover = createComponent(function Popover(
	props: PopoverRootProps,
	...children: Child[]
) {
	const state = new PopoverState(props);
	return DismissableLayer(
		{
			open: state.open,
			close: () => state.close(),
			anchors: state.triggerRefs.bind((refs) => [...refs.values()].map((t) => t.opts.ref.get())),
			content: state.contentEl,
			escapeKeydownBehavior: state.content.bind((c) =>
				c === null ? "close" : c.opts.escapeKeydownBehavior,
			),
			onEscape: state.content.bind((c) => (c === null ? noop : c.opts.onEscape)),
			onInteractOutside: state.content.bind((c) => (c === null ? noop : c.opts.onInteractOutside)),
			onInteractOutsideBehavior: state.content.bind((c) =>
				c === null ? "close" : c.opts.onInteractOutsideBehavior,
			),
		},
		ScrollLock({ open: state.open, enabled: state.opts.preventScroll === true }),
		PopoverContext.Provide(state).To(
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
});

export type PopoverTriggerProps = Omit<ComponentProps<typeof Button>, "id"> & {
	id?: string;
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
		return derived(
			[this.rootState.open, this.rootState.currentTriggerId],
			(open, current) => open && current === this.opts.id,
		);
	}

	toggle() {
		this.rootState.toggle(this.opts.id);
	}
}

export const PopoverTrigger = createComponent(function PopoverTrigger(
	{ id = getId(), default: isDefault = false, ...restProps }: PopoverTriggerProps,
	...children: Child[]
) {
	return PopoverContext.Use((rootState) => {
		const triggerRef = ref<HTMLButtonElement>();
		const triggerState = new PopoverTriggerState(rootState, { id, ref: triggerRef }, isDefault);

		return Button(
			mergeProps(
				{
					id,
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
});

type PopoverContentOptions = {
	side: Side;
	align: Align;
	offset: number;
	onInteractOutside: (e: InteractOutsideEvent) => void;
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	onEscape: (e: EscapeEvent) => void;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
};

export type PopoverContentProps = ComponentProps<typeof Div> & Partial<PopoverContentOptions>;

class PopoverContentState {
	constructor(
		readonly rootState: PopoverState,
		readonly opts: PopoverContentOptions & { id: Bindable<string>; ref: Ref<HTMLDivElement> },
	) {
		rootState.registerContent(this);
	}
}

export const PopoverContent = createComponent(function PopoverContent(
	{
		id = getId(),
		side = "bottom",
		align = "start",
		offset = 0,
		onInteractOutside = noop,
		onInteractOutsideBehavior = "close",
		onEscape = noop,
		escapeKeydownBehavior = "close",
		...restProps
	}: PopoverContentProps,
	...children: Child[]
) {
	return PopoverContext.Use((rootState) => {
		const contentRef = ref<HTMLDivElement>();
		const _contentState = new PopoverContentState(rootState, {
			id,
			ref: contentRef,
			side,
			align,
			offset,
			onInteractOutside,
			onInteractOutsideBehavior,
			onEscape,
			escapeKeydownBehavior,
		});

		return Div(
			mergeProps(
				{
					id,
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
});

export type PopoverPortalProps = PortalProps;

export const PopoverPortal = Portal;

export type PopoverCloseProps = ComponentProps<typeof Button>;

export const PopoverClose = createComponent(function PopoverClose(
	{ id = getId(), ...restProps }: PopoverCloseProps,
	...children: Child[]
) {
	return PopoverContext.Use((state) => {
		return Button(
			mergeProps(
				{
					id,
					type: "button",
					onClick: () => state.close(),
				},
				restProps,
			),
			...children,
		);
	});
});
