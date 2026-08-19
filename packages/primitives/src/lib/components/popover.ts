import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	shift,
	size,
	type Placement,
} from "@floating-ui/dom";
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
	type Signal,
} from "@implementjs/core";
import { getId } from "../utils";

// TODO: apply the correct attributes to everything
// TODO: handle nested portaled popovers
// TODO: trap focus

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

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
		this.open.set(true);
	}

	close() {
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

		this.autoUpdate(triggerEl, contentEl, () =>
			this.position(triggerEl, {
				el: contentEl,
				side: content.opts.side,
				align: content.opts.align,
				offset: content.opts.offset,
			}),
		);
	}

	private unfollow() {
		this.autoUpdateDispose?.();
		this.autoUpdateDispose = null;
	}

	private autoUpdate(trigger: HTMLButtonElement, content: HTMLDivElement, callback: () => void) {
		this.unfollow();
		this.autoUpdateDispose = autoUpdate(trigger, content, callback);
	}

	private position(
		trigger: HTMLButtonElement,
		content: { el: HTMLDivElement; side: Side; align: Align; offset: number },
	) {
		const placement = toFloatingUIPlacement(content.side, content.align);
		computePosition(trigger, content.el, {
			placement,
			strategy: "absolute",
			middleware: [
				offset(content.offset),
				shift(),
				flip(),
				size({
					apply({ availableWidth, availableHeight, rects, elements, placement: resolved }) {
						applyPopoverCssVars(elements.floating, {
							placement: resolved,
							availableWidth,
							availableHeight,
							anchor: rects.reference,
							floating: rects.floating,
						});
					},
				}),
			],
		}).then(({ x, y, placement: resolved }) => {
			content.el.style.left = `${x}px`;
			content.el.style.top = `${y}px`;
			const [side, align = "center"] = resolved.split("-") as [Side, Align];
			content.el.dataset.side = side;
			content.el.dataset.align = align;
		});
	}

	onPointerDown(e: PointerEvent) {
		if (!this.open.get()) return;
		// only close on left clicks
		const isRightClick = e.button === 2 || (e.button === 0 && e.ctrlKey);
		if (isRightClick) return;

		// we don't handle trigger clicks here
		const currentTriggerId = this.currentTriggerId.get();
		if (currentTriggerId) {
			const trigger = this.triggerRefs.get(currentTriggerId);
			if (trigger?.opts.ref.get()?.contains(e.target as Node)) return;
		}

		if (this.content) {
			if (this.content.opts.ref.get()?.contains(e.target as Node)) return;
		}

		this.close();
	}

	dispose() {
		this.unfollow();
	}
}

export function toFloatingUIPlacement(side: Side, align: Align): Placement {
	if (align === "center") return side;
	return `${side}-${align}`;
}

const ALIGN_ORIGIN: Record<Align, string> = {
	start: "0%",
	center: "50%",
	end: "100%",
};

/** Transform origin so scale/fade animations grow from the trigger. */
function toTransformOrigin(
	side: Side,
	align: Align,
	floating: { width: number; height: number },
): string {
	const alignOrigin = ALIGN_ORIGIN[align];
	if (side === "bottom") return `${alignOrigin} 0px`;
	if (side === "top") return `${alignOrigin} ${floating.height}px`;
	if (side === "right") return `0px ${alignOrigin}`;
	return `${floating.width}px ${alignOrigin}`;
}

function applyPopoverCssVars(
	el: HTMLElement,
	opts: {
		placement: Placement;
		availableWidth: number;
		availableHeight: number;
		anchor: { width: number; height: number };
		floating: { width: number; height: number };
	},
) {
	const [side, align = "center"] = opts.placement.split("-") as [Side, Align];
	el.style.setProperty(
		"--bits-popover-content-transform-origin",
		toTransformOrigin(side, align, opts.floating),
	);
	el.style.setProperty("--bits-popover-content-available-width", `${opts.availableWidth}px`);
	el.style.setProperty("--bits-popover-content-available-height", `${opts.availableHeight}px`);
	el.style.setProperty("--bits-popover-anchor-width", `${opts.anchor.width}px`);
	el.style.setProperty("--bits-popover-anchor-height", `${opts.anchor.height}px`);
}

const PopoverContext = context<PopoverState>();

export function Popover(props: PopoverRootProps, ...children: Child[]) {
	const state = new PopoverState(props);
	return PopoverContext.Provide(state).To(
		Implement.Document({
			onPointerdown: (e) => state.onPointerDown(e),
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
		)
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
			{
				this: triggerRef,
				type: "button",
				"data-popover-trigger": "",
				"data-state": triggerState.state,
				"aria-haspopup": "dialog",
				"aria-expanded": triggerState.open,
				onClick: () => triggerState.toggle(),
				...restProps,
			},
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
	) { }
}

export function PopoverContent(
	{ side = "bottom", align = "start", offset = 0, ...restProps }: PopoverContentProps,
	...children: Child[]
) {
	return PopoverContext.Use((state) => {
		const contentRef = ref<HTMLDivElement>();
		const contentState = new PopoverContentState(state, { ref: contentRef, side, align, offset });
		state.registerContent(contentState);

		return Div(
			{ this: contentRef, "data-popover-content": "", tabIndex: -1, "data-state": state.state, ...restProps },
			...children,
		);
	});
}

export const PopoverPortal = Portal;

export type PopoverCloseProps = ComponentProps<typeof Button>;

export function PopoverClose({ ...restProps }: PopoverCloseProps, ...children: Child[]) {
	return PopoverContext.Use((state) => {
		return Button(
			{
				type: "button",
				onClick: () => state.close(),
				...restProps,
			},
			...children,
		);
	});
}
