import {
	Button,
	context,
	derived,
	Div,
	ImplementLifecycle,
	ImplementMap,
	ImplementWindow,
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
import { getId, getReadableValue, noop, type MaybeReadable } from "../../utils";
import { mergeProps } from "../../merge-props";
import { changeEffect, type ChangeHandler } from "../../on-change";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";
import { positionFloatingElement, type Side, type Align } from "../helpers/floating-ui";
import { trackSafePolygon } from "../helpers/safe-polygon";
import { createComponent } from "../../create-component";

export type { Side, Align };

export type TooltipProviderProps = {
	/** How long the pointer must rest on a trigger before the tooltip opens, in ms. */
	delayDuration?: number;
	/**
	 * After a tooltip closes, how long (in ms) another trigger opens instantly
	 * instead of waiting through the delay again.
	 */
	skipDelayDuration?: number;
	/** Close as soon as the pointer leaves the trigger instead of letting it reach the content. */
	disableHoverableContent?: boolean;
	/** Keep the tooltip open when the trigger is clicked. */
	disableCloseOnTriggerClick?: boolean;
	/** Disables every tooltip under the provider. */
	disabled?: boolean;
	/** Only open on focus when the focus is keyboard-driven (`:focus-visible`). */
	ignoreNonKeyboardFocus?: boolean;
};

const PROVIDER_DEFAULTS = {
	delayDuration: 700,
	skipDelayDuration: 300,
	disableHoverableContent: false,
	disableCloseOnTriggerClick: false,
	disabled: false,
	ignoreNonKeyboardFocus: false,
} satisfies Required<TooltipProviderProps>;

class TooltipProviderState {
	readonly opts: Required<TooltipProviderProps>;
	/** False during the skip-delay window after a tooltip closed, so the next one opens instantly. */
	isOpenDelayed = true;
	private skipTimer: ReturnType<typeof setTimeout> | null = null;
	private openTooltip: TooltipState | null = null;

	constructor(opts: TooltipProviderProps) {
		this.opts = { ...PROVIDER_DEFAULTS, ...opts };
	}

	onOpen(tooltip: TooltipState) {
		// only one tooltip per provider is open at a time
		if (this.openTooltip && this.openTooltip !== tooltip) {
			this.openTooltip.handleClose();
		}
		this.clearSkipTimer();
		this.isOpenDelayed = false;
		this.openTooltip = tooltip;
	}

	onClose(tooltip: TooltipState) {
		if (this.openTooltip !== tooltip) return;
		this.openTooltip = null;
		this.startSkipTimer();
	}

	isTooltipOpen(tooltip: TooltipState) {
		return this.openTooltip === tooltip;
	}

	/** Close the open tooltip when its trigger's scroll container scrolls. */
	handleScroll(e: Event) {
		const tooltip = this.openTooltip;
		if (!tooltip) return;
		const triggerEl = tooltip.currentTriggerEl;
		if (!triggerEl) return;
		const target = e.target;
		if (!(target instanceof Element || target instanceof Document)) return;
		if (target.contains(triggerEl)) tooltip.handleClose();
	}

	private startSkipTimer() {
		if (this.opts.skipDelayDuration === 0) {
			// no grace period — the next trigger waits the full delay
			this.isOpenDelayed = true;
			return;
		}
		this.clearSkipTimer();
		this.skipTimer = setTimeout(() => {
			this.isOpenDelayed = true;
		}, this.opts.skipDelayDuration);
	}

	private clearSkipTimer() {
		if (this.skipTimer !== null) {
			clearTimeout(this.skipTimer);
			this.skipTimer = null;
		}
	}

	dispose() {
		this.clearSkipTimer();
	}
}

const TooltipProviderContext = context<TooltipProviderState>("TooltipProviderContext");

/**
 * Shares tooltip timing across every `Tooltip` inside it: one open at a time,
 * and moving between triggers within `skipDelayDuration` skips the open delay.
 */
export const TooltipProvider = createComponent(function TooltipProvider(
	props: TooltipProviderProps,
	...children: Child[]
) {
	const state = new TooltipProviderState(props);
	return TooltipProviderContext.Provide(state).To(
		ImplementWindow({ onScroll: (e: Event) => state.handleScroll(e) }),
		ImplementLifecycle({ onUnmount: () => state.dispose() }, ...children),
	);
});

export type TooltipRootProps = {
	open?: Signal<boolean> | boolean;
	/** Runs whenever the open state changes. */
	onOpenChange?: ChangeHandler<boolean>;
	/** Overrides the provider's `delayDuration` for this tooltip. */
	delayDuration?: number;
	/** Overrides the provider's `disableHoverableContent` for this tooltip. */
	disableHoverableContent?: boolean;
	/** Overrides the provider's `disableCloseOnTriggerClick` for this tooltip. */
	disableCloseOnTriggerClick?: boolean;
	/** Overrides the provider's `disabled` for this tooltip. */
	disabled?: boolean;
	/** Overrides the provider's `ignoreNonKeyboardFocus` for this tooltip. */
	ignoreNonKeyboardFocus?: boolean;
};

class TooltipState {
	open: Signal<boolean>;
	/** Whether the current open came from the hover delay ("delayed-open") or not ("instant-open"). */
	wasOpenDelayed = signal(false);
	currentTriggerId = signal<string | null>(null);
	triggerRefs = ImplementMap<string, TooltipTriggerState>();
	content = signal<TooltipContentState | null>(null);
	autoUpdateDispose: (() => void) | null = null;
	safePolygonDispose: (() => void) | null = null;
	private openTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		readonly opts: TooltipRootProps,
		readonly provider: TooltipProviderState,
	) {
		this.open = signal(this.opts.open ?? false);
	}

	get delayDuration() {
		return this.opts.delayDuration ?? this.provider.opts.delayDuration;
	}

	get disableHoverableContent() {
		return this.opts.disableHoverableContent ?? this.provider.opts.disableHoverableContent;
	}

	get disableCloseOnTriggerClick() {
		return this.opts.disableCloseOnTriggerClick ?? this.provider.opts.disableCloseOnTriggerClick;
	}

	get disabled() {
		return this.opts.disabled ?? this.provider.opts.disabled;
	}

	get ignoreNonKeyboardFocus() {
		return this.opts.ignoreNonKeyboardFocus ?? this.provider.opts.ignoreNonKeyboardFocus;
	}

	get state() {
		return derived([this.open, this.wasOpenDelayed], (open, delayed) => {
			if (!open) return "closed";
			return delayed ? "delayed-open" : "instant-open";
		});
	}

	get contentEl() {
		return derived([this.content], (c) => (c === null ? null : c.opts.ref.get()));
	}

	get currentTriggerEl() {
		return this.triggerRefs.get(this.currentTriggerId.get() ?? "")?.opts.ref.get() ?? null;
	}

	registerTrigger(triggerId: string, trigger: TooltipTriggerState) {
		this.triggerRefs.set(triggerId, trigger);

		// Assign the id during tree build so data-state is correct on first paint.
		// Positioning waits for onMount, when refs exist.
		if (this.open.get() && this.currentTriggerId.get() === null) {
			this.currentTriggerId.set(triggerId);
		}
	}

	unregisterTrigger(triggerId: string) {
		const wasActive = this.currentTriggerId.get() === triggerId;
		this.triggerRefs.delete(triggerId);
		if (wasActive && this.open.get()) this.handleClose();
	}

	registerContent(content: TooltipContentState) {
		this.content.set(content);
	}

	isActiveTrigger(triggerId: string) {
		return this.currentTriggerId.get() === triggerId;
	}

	/** Open immediately, e.g. from keyboard focus. */
	handleOpen(triggerId?: string) {
		this.clearOpenTimer();
		this.wasOpenDelayed.set(false);
		if (triggerId !== undefined) this.currentTriggerId.set(triggerId);
		this.open.set(true);
	}

	handleClose() {
		this.clearOpenTimer();
		this.open.set(false);
	}

	/** Stops a pending delayed open without touching the open state. */
	cancelPendingOpen() {
		this.clearOpenTimer();
	}

	onTriggerEnter(triggerId: string) {
		this.currentTriggerId.set(triggerId);
		this.handleDelayedOpen();
	}

	onTriggerLeave() {
		if (this.disableHoverableContent) {
			this.handleClose();
		} else {
			this.clearOpenTimer();
		}
	}

	private handleDelayedOpen() {
		this.clearOpenTimer();

		// skip the delay entirely when another tooltip just closed, or there is none
		if (!this.provider.isOpenDelayed || this.delayDuration === 0) {
			this.wasOpenDelayed.set(false);
			this.open.set(true);
			return;
		}

		this.openTimer = setTimeout(() => {
			this.openTimer = null;
			this.wasOpenDelayed.set(true);
			this.open.set(true);
		}, this.delayDuration);
	}

	private clearOpenTimer() {
		if (this.openTimer !== null) {
			clearTimeout(this.openTimer);
			this.openTimer = null;
		}
	}

	/** If open with no hover yet, pick the first trigger and start following it. */
	ensureAnchor() {
		if (!this.open.get()) return;
		let id = this.currentTriggerId.get();
		if (id == null || !this.triggerRefs.has(id)) {
			id = this.triggerRefs.keys().next().value ?? null;
			this.currentTriggerId.set(id);
		}
		if (id != null) this.follow(id);
	}

	releaseAnchor() {
		this.unfollow();
		this.currentTriggerId.set(null);
	}

	private follow(triggerId: string) {
		const trigger = this.triggerRefs.get(triggerId);
		const content = this.content.get();
		if (!trigger || content === null) return;

		const triggerEl = trigger.opts.ref.get();
		const contentEl = content.opts.ref.get();
		if (!triggerEl || !contentEl) return;

		this.unfollow();
		this.autoUpdateDispose = positionFloatingElement(triggerEl, contentEl, {
			componentName: "tooltip",
			side: content.opts.side,
			align: content.opts.align,
			offset: content.opts.offset,
			strategy: "absolute",
			autoUpdate: true,
		});

		if (!this.disableHoverableContent) {
			// keep it open while the pointer travels from trigger to content
			this.safePolygonDispose = trackSafePolygon(triggerEl, contentEl, {
				transitIntentTimeout: 180,
				ignoredTargets: () => {
					// only skip closing for sibling triggers when a skip-delay grace
					// period exists; with skipDelayDuration=0 the close+reopen is
					// intentional (full delay + re-animation)
					if (this.provider.opts.skipDelayDuration === 0) return [];
					const nodes: HTMLElement[] = [];
					for (const [id, trigger] of this.triggerRefs.get()) {
						if (id === triggerId) continue;
						const node = trigger.opts.ref.get();
						if (node) nodes.push(node);
					}
					return nodes;
				},
				onPointerExit: () => {
					if (this.provider.isTooltipOpen(this)) this.handleClose();
				},
			});
		}
	}

	private unfollow() {
		this.autoUpdateDispose?.();
		this.autoUpdateDispose = null;
		this.safePolygonDispose?.();
		this.safePolygonDispose = null;
	}

	dispose() {
		this.clearOpenTimer();
		this.unfollow();
	}
}

const TooltipContext = context<TooltipState>("TooltipContext");

export const Tooltip = createComponent(function Tooltip(
	props: TooltipRootProps,
	...children: Child[]
) {
	return TooltipProviderContext.UseOr((provider) => {
		// a root without a provider gets a private one with the defaults
		const ownsProvider = provider === null;
		const providerState = provider ?? new TooltipProviderState({});
		const state = new TooltipState(props, providerState);

		const tree = DismissableLayer(
			{
				open: state.open,
				close: () => state.handleClose(),
				anchors: state.triggerRefs.bind((refs) => [...refs.values()].map((t) => t.opts.ref.get())),
				content: state.contentEl,
				escapeKeydownBehavior: state.content.bind((c) =>
					c === null ? "close" : c.opts.escapeKeydownBehavior,
				),
				onEscape: state.content.bind((c) => (c === null ? noop : c.opts.onEscape)),
				onInteractOutside: state.content.bind((c) =>
					c === null ? noop : c.opts.onInteractOutside,
				),
				onInteractOutsideBehavior: state.content.bind((c) =>
					c === null ? "close" : c.opts.onInteractOutsideBehavior,
				),
			},
			...changeEffect(state.open, props.onOpenChange),
			TooltipContext.Provide(state).To(
				ImplementLifecycle(
					{
						onMount: () => {
							if (state.open.get()) {
								state.ensureAnchor();
								providerState.onOpen(state);
							}
							return state.open.onChange((open) => {
								if (open) {
									state.ensureAnchor();
									providerState.onOpen(state);
								} else {
									providerState.onClose(state);
									state.releaseAnchor();
								}
							});
						},
						onUnmount: () => {
							state.dispose();
							if (ownsProvider) providerState.dispose();
						},
					},
					...children,
				),
			),
		);

		if (!ownsProvider) return tree;
		return TooltipProviderContext.Provide(providerState).To(
			ImplementWindow({
				onScroll: (e: Event) => providerState.handleScroll(e),
			}),
			tree,
		);
	}, null);
});

export type TooltipTriggerProps = Omit<ComponentProps<typeof Button>, "id" | "disabled"> & {
	id?: string;
	disabled?: Signal<boolean> | boolean;
};

class TooltipTriggerState {
	private isPointerDown = false;
	private hasPointerMoveOpened = false;

	constructor(
		readonly rootState: TooltipState,
		readonly opts: {
			id: string;
			ref: Ref<HTMLButtonElement>;
			disabled: Signal<boolean>;
		},
	) {
		this.rootState.registerTrigger(opts.id, this);
	}

	get isDisabled() {
		return this.opts.disabled.get() || this.rootState.disabled;
	}

	get isOpenForTrigger() {
		return derived(
			[this.rootState.open, this.rootState.currentTriggerId],
			(open, current) => open && current === this.opts.id,
		);
	}

	get state() {
		return derived(
			[this.rootState.open, this.rootState.currentTriggerId, this.rootState.wasOpenDelayed],
			(open, current, delayed) => {
				if (!open || current !== this.opts.id) return "closed";
				return delayed ? "delayed-open" : "instant-open";
			},
		);
	}

	onPointerdown() {
		if (this.isDisabled) return;

		// close on pointerdown regardless of button so right/middle click dismiss
		// the tooltip too, and a pending open timer is cancelled before `contextmenu`
		if (!this.rootState.disableCloseOnTriggerClick) {
			if (this.rootState.open.get()) {
				this.rootState.handleClose();
			} else {
				this.rootState.cancelPendingOpen();
			}
		}

		this.isPointerDown = true;
		document.addEventListener(
			"pointerup",
			() => {
				this.isPointerDown = false;
			},
			{ once: true },
		);
	}

	onPointerup() {
		if (this.isDisabled) return;
		this.isPointerDown = false;
	}

	onPointerenter(e: PointerEvent) {
		if (this.isDisabled) {
			if (this.rootState.open.get()) this.rootState.handleClose();
			return;
		}
		if (e.pointerType === "touch") return;
		this.rootState.onTriggerEnter(this.opts.id);
		this.hasPointerMoveOpened = true;
	}

	onPointermove(e: PointerEvent) {
		if (this.isDisabled) {
			if (this.rootState.open.get()) this.rootState.handleClose();
			return;
		}
		if (e.pointerType === "touch") return;
		if (this.hasPointerMoveOpened) return;
		this.rootState.onTriggerEnter(this.opts.id);
		this.hasPointerMoveOpened = true;
	}

	onPointerleave(e: PointerEvent) {
		if (this.isDisabled) return;
		if (!this.rootState.isActiveTrigger(this.opts.id)) {
			this.hasPointerMoveOpened = false;
			return;
		}

		// when moving to a sibling trigger and skip delay is active, don't close —
		// the sibling's enter handler switches the active trigger instantly. With
		// skipDelayDuration=0 there is no grace period, so close now and let the
		// sibling wait through the full delay (and re-animate).
		const relatedTarget = e.relatedTarget;
		if (relatedTarget instanceof Element) {
			for (const trigger of this.rootState.triggerRefs.values()) {
				if (trigger.opts.ref.get() !== relatedTarget) continue;
				if (this.rootState.provider.opts.skipDelayDuration > 0) {
					this.hasPointerMoveOpened = false;
					return;
				}
				this.rootState.handleClose();
				this.hasPointerMoveOpened = false;
				return;
			}
		}

		this.rootState.onTriggerLeave();
		this.hasPointerMoveOpened = false;
	}

	onFocus(e: FocusEvent) {
		if (this.isPointerDown) return;
		if (this.isDisabled) {
			if (this.rootState.open.get()) this.rootState.handleClose();
			return;
		}
		if (
			this.rootState.ignoreNonKeyboardFocus &&
			e.currentTarget instanceof Element &&
			!e.currentTarget.matches(":focus-visible")
		) {
			return;
		}
		this.rootState.handleOpen(this.opts.id);
	}

	onBlur() {
		if (this.isDisabled) return;
		this.rootState.handleClose();
	}

	onClick() {
		if (this.rootState.disableCloseOnTriggerClick || this.isDisabled) return;
		this.rootState.handleClose();
	}
}

export const TooltipTrigger = createComponent(function TooltipTrigger(
	{ id = getId(), disabled = false, ...restProps }: TooltipTriggerProps,
	...children: Child[]
) {
	return TooltipContext.Use((rootState) => {
		const triggerRef = ref<HTMLButtonElement>();
		const disabledSignal = signal(disabled);
		const triggerState = new TooltipTriggerState(rootState, {
			id,
			ref: triggerRef,
			disabled: disabledSignal,
		});

		return ImplementLifecycle(
			{ onUnmount: () => rootState.unregisterTrigger(id) },
			Button(
				mergeProps(
					{
						id,
						this: triggerRef,
						type: "button",
						disabled: disabledSignal,
						"data-tooltip-trigger": "",
						"data-state": triggerState.state,
						"data-disabled": disabledSignal.bind((d) => (d ? "" : undefined)),
						"data-delay-duration": `${rootState.delayDuration}`,
						"aria-describedby": derived(
							[rootState.open, rootState.currentTriggerId, rootState.content],
							(open, current, content) =>
								open && current === id && content !== null
									? getReadableValue(content.opts.id)
									: undefined,
						),
						onPointerdown: () => triggerState.onPointerdown(),
						onPointerup: () => triggerState.onPointerup(),
						onPointerenter: (e: PointerEvent) => triggerState.onPointerenter(e),
						onPointermove: (e: PointerEvent) => triggerState.onPointermove(e),
						onPointerleave: (e: PointerEvent) => triggerState.onPointerleave(e),
						onFocus: (e: FocusEvent) => triggerState.onFocus(e),
						onBlur: () => triggerState.onBlur(),
						onClick: () => triggerState.onClick(),
					},
					restProps,
				),
				...children,
			),
		);
	});
});

type TooltipContentOptions = {
	side: Side;
	align: Align;
	offset: number;
	onInteractOutside: (e: InteractOutsideEvent) => void;
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	onEscape: (e: EscapeEvent) => void;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
};

export type TooltipContentProps = ComponentProps<typeof Div> & Partial<TooltipContentOptions>;

class TooltipContentState {
	constructor(
		readonly rootState: TooltipState,
		readonly opts: TooltipContentOptions & {
			id: Bindable<string>;
			ref: Ref<HTMLDivElement>;
		},
	) {
		rootState.registerContent(this);
	}
}

export const TooltipContent = createComponent(function TooltipContent(
	{
		id = getId(),
		side = "top",
		align = "center",
		offset = 0,
		onInteractOutside = noop,
		onInteractOutsideBehavior = "close",
		onEscape = noop,
		escapeKeydownBehavior = "close",
		...restProps
	}: TooltipContentProps,
	...children: Child[]
) {
	return TooltipContext.Use((rootState) => {
		const contentRef = ref<HTMLDivElement>();
		void new TooltipContentState(rootState, {
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
					role: "tooltip",
					"data-tooltip-content": "",
					"data-state": rootState.state,
				},
				restProps,
			),
			...children,
		);
	});
});

export type TooltipPortalProps = PortalProps;

export const TooltipPortal = Portal;
