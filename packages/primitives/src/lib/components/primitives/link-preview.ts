import {
	A,
	context,
	derived,
	Div,
	ImplementDocument,
	ImplementLifecycle,
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
import { tabbable } from "../../focus";
import { mergeProps } from "../../merge-props";
import {
	DismissableLayer,
	EscapeEvent,
	InteractOutsideEvent,
	type DismissBehavior,
} from "../helpers/dismissable-layer";
import { positionFloatingElement, type Side, type Align } from "../helpers/floating-ui";
import { trackSafePolygon } from "../helpers/safe-polygon";
import { ScrollLock } from "../helpers/scroll-lock";
import { createComponent } from "../../create-component";

export type LinkPreviewRootProps = {
	open?: Signal<boolean> | boolean;
	/** When disabled the preview never opens; the link still works. */
	disabled?: Signal<boolean> | boolean;
	/** When true, the page behind cannot scroll while the preview is open. Defaults to true. */
	preventScroll?: boolean;
	/** How long the pointer must rest on the link before the preview opens, in milliseconds. */
	openDelay?: number;
	/** How long the preview stays up after the pointer leaves, in milliseconds. */
	closeDelay?: number;
};

class LinkPreviewState {
	open: Signal<boolean>;
	disabled: Signal<boolean>;
	trigger = ref<HTMLAnchorElement>();
	content = signal<LinkPreviewContentState | null>(null);
	autoUpdateDispose: (() => void) | null = null;
	safePolygonDispose: (() => void) | null = null;
	/** The pending open or close; only one is ever in flight. */
	private timer: ReturnType<typeof setTimeout> | null = null;
	private selectionTimer: ReturnType<typeof setTimeout> | null = null;
	/** An open is scheduled. Cleared when something cancels it before it lands. */
	private opening = false;
	/** A press started inside the content, so the pointer is dragging out a selection. */
	private pointerDownOnContent = false;
	/** Text is selected inside the content; closing under the selection would lose it. */
	private hasSelection = false;

	readonly openDelay: number;
	readonly closeDelay: number;

	constructor(readonly opts: LinkPreviewRootProps) {
		this.open = signal(opts.open ?? false);
		this.disabled = signal(opts.disabled ?? false);
		this.openDelay = opts.openDelay ?? 700;
		this.closeDelay = opts.closeDelay ?? 300;
	}

	get state() {
		return this.open.bind((open) => (open ? "open" : "closed"));
	}

	get contentEl() {
		return derived([this.content], (c) => (c === null ? null : c.opts.ref.get()));
	}

	/** The open content's id, for the trigger's aria-controls. */
	get contentId() {
		return derived([this.open, this.content], (open, c) =>
			open && c !== null ? getReadableValue(c.opts.id) : undefined,
		);
	}

	registerContent(content: LinkPreviewContentState) {
		this.content.set(content);
	}

	private clearTimer() {
		if (this.timer === null) return;
		clearTimeout(this.timer);
		this.timer = null;
	}

	/**
	 * Cancel a pending close and, if closed, schedule the open. Both the link and
	 * the preview call this on pointer enter, which is what lets the pointer
	 * travel from one to the other without the preview disappearing.
	 */
	scheduleOpen() {
		this.clearTimer();
		if (this.open.get() || this.disabled.get()) return;
		this.opening = true;
		this.timer = setTimeout(() => {
			this.timer = null;
			if (!this.opening) return;
			this.opening = false;
			this.open.set(true);
		}, this.openDelay);
	}

	scheduleClose() {
		this.opening = false;
		this.clearTimer();
		// leave it up while the pointer is dragging out a selection, or a selection stands
		if (this.pointerDownOnContent || this.hasSelection) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.open.set(false);
		}, this.closeDelay);
	}

	closeImmediately() {
		this.opening = false;
		this.clearTimer();
		this.open.set(false);
	}

	contentPointerdown() {
		this.pointerDownOnContent = true;
		this.hasSelection = true;
	}

	/** Anywhere in the document: a release ends the drag, and decides whether a selection stands. */
	documentPointerup() {
		if (!this.open.get()) return;
		this.pointerDownOnContent = false;
		this.clearSelectionTimer();
		// the selection is not on the document until after this event settles
		this.selectionTimer = setTimeout(() => {
			this.selectionTimer = null;
			this.hasSelection = document.getSelection()?.toString() !== "";
		}, 1);
	}

	private clearSelectionTimer() {
		if (this.selectionTimer === null) return;
		clearTimeout(this.selectionTimer);
		this.selectionTimer = null;
	}

	onOpened() {
		this.position();
		const contentEl = this.content.get()?.opts.ref.get();
		if (!contentEl) return;
		// the preview is not a stop on the way through the page: Tab from the link
		// moves past it, the way it would if the preview were not there
		for (const candidate of tabbable(contentEl)) {
			candidate.setAttribute("tabindex", "-1");
		}
	}

	onClosed() {
		this.hasSelection = false;
		this.pointerDownOnContent = false;
		this.unfollow();
	}

	position() {
		const triggerEl = this.trigger.get();
		const content = this.content.get();
		const contentEl = content?.opts.ref.get();
		if (!triggerEl || !content || !contentEl) return;

		this.unfollow();
		this.autoUpdateDispose = positionFloatingElement(triggerEl, contentEl, {
			componentName: "link-preview",
			side: content.opts.side,
			align: content.opts.align,
			offset: content.opts.offset,
			strategy: "absolute",
			autoUpdate: true,
		});

		// keep it open while the pointer travels the gap from the link to the panel
		this.safePolygonDispose = trackSafePolygon(triggerEl, contentEl, {
			transitIntentTimeout: 180,
			onPointerExit: () => this.scheduleClose(),
		});
	}

	private unfollow() {
		this.autoUpdateDispose?.();
		this.autoUpdateDispose = null;
		this.safePolygonDispose?.();
		this.safePolygonDispose = null;
	}

	dispose() {
		this.clearTimer();
		this.clearSelectionTimer();
		this.unfollow();
	}
}

const LinkPreviewCtx = context<LinkPreviewState>("LinkPreviewCtx");

export const LinkPreview = createComponent(function LinkPreview(
	props: LinkPreviewRootProps,
	...children: Child[]
) {
	const state = new LinkPreviewState(props);
	return DismissableLayer(
		{
			open: state.open,
			close: () => state.closeImmediately(),
			anchors: state.trigger.bind((el) => [el]),
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
		ScrollLock({ open: state.open, enabled: state.opts.preventScroll !== false }),
		LinkPreviewCtx.Provide(state).To(
			ImplementDocument({ onPointerup: () => state.documentPointerup() }),
			ImplementLifecycle(
				{
					onMount: () => {
						if (state.open.get()) state.onOpened();
						return state.open.onChange((open) => {
							if (open) state.onOpened();
							else state.onClosed();
						});
					},
					onUnmount: () => state.dispose(),
				},
				...children,
			),
		),
	);
});

export type LinkPreviewTriggerProps = Omit<ComponentProps<typeof A>, "id"> & {
	id?: string;
};

export const LinkPreviewTrigger = createComponent(function LinkPreviewTrigger(
	{ id = getId(), ...restProps }: LinkPreviewTriggerProps,
	...children: Child[]
) {
	return LinkPreviewCtx.Use((state) => {
		return A(
			mergeProps(
				{
					id,
					this: state.trigger,
					"data-link-preview-trigger": "",
					"data-state": state.state,
					"aria-haspopup": "dialog",
					"aria-expanded": state.open,
					"aria-controls": state.contentId,
					onPointerenter: (e: PointerEvent) => {
						if (e.pointerType === "touch") return;
						state.scheduleOpen();
					},
					onPointerleave: (e: PointerEvent) => {
						if (e.pointerType === "touch") return;
						// once it is open the safe polygon owns the exit, so the pointer
						// can cut across the gap to the panel; before that, leaving cancels
						if (!state.open.get()) state.closeImmediately();
					},
					// keyboard reveals it, pointer-driven focus does not
					onFocus: (e: FocusEvent) => {
						if (!isFocusVisible(e.currentTarget)) return;
						state.scheduleOpen();
					},
					onBlur: () => state.scheduleClose(),
				},
				restProps,
			),
			...children,
		);
	});
});

function isFocusVisible(target: EventTarget | null): boolean {
	return target instanceof Element && target.matches(":focus-visible");
}

type LinkPreviewContentOptions = {
	side: Side;
	align: Align;
	offset: number;
	onInteractOutside: (e: InteractOutsideEvent) => void;
	onInteractOutsideBehavior: MaybeReadable<DismissBehavior>;
	onEscape: (e: EscapeEvent) => void;
	escapeKeydownBehavior: MaybeReadable<DismissBehavior>;
};

export type LinkPreviewContentProps = ComponentProps<typeof Div> &
	Partial<LinkPreviewContentOptions>;

class LinkPreviewContentState {
	constructor(
		readonly rootState: LinkPreviewState,
		readonly opts: LinkPreviewContentOptions & { id: Bindable<string>; ref: Ref<HTMLDivElement> },
	) {
		rootState.registerContent(this);
	}
}

export const LinkPreviewContent = createComponent(function LinkPreviewContent(
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
	}: LinkPreviewContentProps,
	...children: Child[]
) {
	return LinkPreviewCtx.Use((state) => {
		const contentRef = ref<HTMLDivElement>();
		void new LinkPreviewContentState(state, {
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
					"data-link-preview-content": "",
					tabIndex: -1,
					"data-state": state.state,
					onPointerdown: () => state.contentPointerdown(),
					onPointerenter: (e: PointerEvent) => {
						if (e.pointerType === "touch") return;
						state.scheduleOpen();
					},
				},
				restProps,
			),
			...children,
		);
	});
});

export type LinkPreviewPortalProps = PortalProps;

export const LinkPreviewPortal = Portal;
