import { context, If, Implement, type Child, type Readable, type Signal } from "@implementjs/core";
import { getId, getReadableValue, type MaybeReadable } from "../../utils";

export type DismissBehavior = "close" | "ignore" | "defer-otherwise-close";

export type DismissableLayerProps = {
	open: Signal<boolean>;
	onEscape: MaybeReadable<(e: EscapeEvent) => void>;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
	onInteractOutside: MaybeReadable<(e: InteractOutsideEvent) => void>;
	/**
	 * Behavior when the user clicks or focuses outside the dismissable layer.
	 */
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	close: (e: InteractOutsideEvent | EscapeEvent) => void;
	anchors: Readable<(HTMLElement | null | undefined)[]>;
	content: Readable<HTMLElement | null | undefined>;
};

export class EscapeEvent extends Event {
	behavior: DismissBehavior;
	constructor(behavior: DismissBehavior) {
		super("escape");
		this.behavior = behavior;
	}
}

export type InteractOutsideSource = "pointer" | "focus";

export class InteractOutsideEvent extends Event {
	behavior: DismissBehavior;
	source: InteractOutsideSource;
	/**
	 * The pointer/focus event that triggered this. This event is constructed,
	 * not dispatched, so its own `target` is always null — the interacted
	 * element is `originalEvent.target`.
	 */
	readonly originalEvent: Event;
	constructor(behavior: DismissBehavior, source: InteractOutsideSource, originalEvent: Event) {
		super("focusOutside");
		this.behavior = behavior;
		this.source = source;
		this.originalEvent = originalEvent;
	}
}

class DismissableLayerState {
	private dismissableChildren = new Map<string, DismissableLayerState>();
	openUnsubscribe: () => void;
	constructor(
		readonly parent: DismissableLayerState | null,
		readonly opts: DismissableLayerProps & { id: string },
	) {
		this.openUnsubscribe = this.opts.open.subscribe((open) => {
			if (open) {
				this.parent?.addDismissableLayer(this.opts.id, this);
			} else {
				this.parent?.removeDismissableLayer(this.opts.id);
			}
		});
	}

	addDismissableLayer(id: string, state: DismissableLayerState) {
		this.dismissableChildren.set(id, state);
	}

	removeDismissableLayer(id: string) {
		this.dismissableChildren.delete(id);
	}

	get hasDismissableChildren() {
		return this.dismissableChildren.size > 0;
	}

	private onEscape(e: EscapeEvent, deferred = false) {
		// can't close if it ain't open
		if (!this.opts.open.get()) return;

		if (this.hasDismissableChildren && !deferred) {
			// only handle escape on the last layer (unless it was deferred from a child)
			for (const child of this.dismissableChildren.values()) {
				child.onEscape(e);
			}
			return;
		}

		getReadableValue(this.opts.onEscape)(e);

		if (e.defaultPrevented) return;

		const escapeBehavior = getReadableValue(this.opts.escapeKeydownBehavior);

		e.behavior = escapeBehavior;

		if (e.behavior === "ignore") return;
		if (e.behavior === "defer-otherwise-close") {
			if (this.parent) {
				this.parent.onEscape(e, true);
			} else {
				this.opts.open.set(false);
			}
			return;
		}

		this.opts.close(e);
	}

	onKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case "Escape":
				this.onEscape(new EscapeEvent(getReadableValue(this.opts.escapeKeydownBehavior)));
				return;
			default:
				return;
		}
	}

	private onInteractOutside(
		e: InteractOutsideEvent,
		{ reverseWalking, deferred: _deferred } = { reverseWalking: false, deferred: false },
	) {
		if (!this.opts.open.get()) return;

		// go all the way to the end and then come back down
		if (this.hasDismissableChildren && !reverseWalking) {
			for (const child of this.dismissableChildren.values()) {
				child.onInteractOutside(e);
			}
			return;
		}

		const interactedOutside = isInteractionWithOutsideElement(
			e.originalEvent.target as Node,
			this.opts.anchors.get(),
			this.opts.content.get(),
		);
		// if we didn't interact outside, we don't need to do anything
		if (!interactedOutside) return;

		// if we did interact outside
		// then we need to at least close the current layer

		getReadableValue(this.opts.onInteractOutside)(e);

		if (e.defaultPrevented) return;

		const interactOutsideBehavior = getReadableValue(this.opts.onInteractOutsideBehavior);

		e.behavior = interactOutsideBehavior;

		if (interactOutsideBehavior === "ignore") return;
		if (interactOutsideBehavior === "defer-otherwise-close") {
			if (!this.parent) {
				// we are gonna check the parent below so we just close if there is no parent
				this.opts.close(e);
				return;
			} else {
				this.parent?.onInteractOutside(e, { reverseWalking: true, deferred: true });
				return;
			}
		}

		this.opts.close(e);

		this.parent?.onInteractOutside(e, { reverseWalking: true, deferred: false });
	}

	onFocusin(e: FocusEvent) {
		const previousFocus = e.relatedTarget;
		const currentFocus = document.activeElement;
		if (previousFocus === currentFocus) return;

		const event = new InteractOutsideEvent(
			getReadableValue(this.opts.onInteractOutsideBehavior),
			"focus",
			e,
		);
		this.onInteractOutside(event);
	}

	onPointerDown(e: PointerEvent) {
		// only close on left clicks
		const isRightClick = e.button === 2 || (e.button === 0 && e.ctrlKey);
		if (isRightClick) return;

		const event = new InteractOutsideEvent(
			getReadableValue(this.opts.onInteractOutsideBehavior),
			"pointer",
			e,
		);
		this.onInteractOutside(event);
	}

	dispose() {
		this.openUnsubscribe();
	}
}

function isInteractionWithOutsideElement(
	target: Node,
	anchors: (HTMLElement | null | undefined)[],
	floating: HTMLElement | null | undefined,
): boolean {
	// we don't handle trigger clicks here
	for (const anchor of anchors) {
		if (anchor?.contains(target)) return false;
	}

	if (floating) {
		if (floating.contains(target)) return false;
	}

	return true;
}

const DismissableLayerCtx = context<DismissableLayerState>();

export function DismissableLayer(props: DismissableLayerProps, ...children: Child[]) {
	return DismissableLayerCtx.UseOr((parent) => {
		const state = new DismissableLayerState(parent, { ...props, id: getId() });
		return DismissableLayerCtx.Provide(state).To(
			// only register listener for the big boss
			If(parent === null).Then(
				Implement.Document({
					onKeydown: (e) => state.onKeydown(e),
					onPointerdown: (e) => state.onPointerDown(e),
					onFocusin: (e) => state.onFocusin(e),
				}),
			),
			Implement.Lifecycle(
				{
					onUnmount: () => state.dispose(),
				},
				...children,
			),
		);
	}, null);
}
