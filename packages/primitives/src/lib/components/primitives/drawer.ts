import {
	context,
	derived,
	Div,
	ImplementLifecycle,
	ImplementWindow,
	Portal,
	signal,
	Span,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Readable,
	type Signal,
} from "@implementjs/core";
import {
	ModalClose,
	ModalContent,
	ModalContentState,
	ModalDescription,
	ModalOverlay,
	ModalRoot,
	ModalState,
	ModalTitle,
	ModalTrigger,
	type ModalCloseProps,
	type ModalContentProps,
	type ModalDescriptionProps,
	type ModalOverlayProps,
	type ModalRootOptions,
	type ModalTitleProps,
	type ModalTriggerProps,
} from "./modal";
import { createComponent } from "../../create-component";
import { mergeProps } from "../../merge-props";
import { getId, LIB_PREFIX, noop } from "../../utils";

/** Which edge the panel is anchored to, and therefore which way it closes. */
export type DrawerDirection = "top" | "bottom" | "left" | "right";

/**
 * A resting position for the panel: a fraction of the viewport (`0.5`) or a
 * length the viewport does not enter into (`"148px"`). Ordered least to most
 * of the screen, the way `snapPoints` takes them.
 */
export type DrawerSnapPoint = number | string;

/** px/ms past which a release is a fling rather than a drag. */
const VELOCITY_THRESHOLD = 0.4;
/** px/ms past which a fling skips straight to the far snap point. */
const FLING_VELOCITY = 2;
/** Fraction of the panel a drag has to cover before the release dismisses it. */
const CLOSE_THRESHOLD = 0.25;
/** ms after a scroll inside the panel during which a drag will not start. */
const SCROLL_LOCK_TIMEOUT = 100;
/** ms after opening during which the content scrolls instead of dragging. */
const OPEN_GRACE = 500;
/** px the page shrinks by behind a drawer that scales the background. */
const BACKGROUND_INSET = 26;
/** Movement in px before a drag starts, per pointer type. */
const TOUCH_DRAG_START = 10;
const MOUSE_DRAG_START = 2;
/** ms a handle press may last before the release stops counting as a tap. */
const HANDLE_PRESS_TIMEOUT = 250;
/** ms the handle waits before cycling, so the second tap of a double tap lands. */
const HANDLE_TAP_TIMEOUT = 120;

const OFFSET_X_VAR = `--${LIB_PREFIX}-drawer-offset-x`;
const OFFSET_Y_VAR = `--${LIB_PREFIX}-drawer-offset-y`;
const PROGRESS_VAR = `--${LIB_PREFIX}-drawer-progress`;
const FADE_VAR = `--${LIB_PREFIX}-drawer-fade`;
const SCALE_VAR = `--${LIB_PREFIX}-drawer-scale`;
const BACKGROUND_ATTRIBUTE = "data-drawer-open";
const NO_DRAG_SELECTOR = "[data-drawer-no-drag]";

/** Present as an empty data attribute, or omitted. */
function presence(on: boolean): "" | undefined {
	return on ? "" : undefined;
}

function isVertical(direction: DrawerDirection): boolean {
	return direction === "top" || direction === "bottom";
}

/** `1` when the panel closes toward the positive axis, `-1` when it closes back along it. */
function closingSign(direction: DrawerDirection): 1 | -1 {
	return direction === "bottom" || direction === "right" ? 1 : -1;
}

/**
 * Pointer capture keeps a drag alive once it leaves the panel. A pointer that
 * is no longer active cannot be captured, and that is not worth failing over.
 */
function capturePointer(target: EventTarget | null, pointerId: number) {
	if (!(target instanceof Element)) return;
	try {
		target.setPointerCapture(pointerId);
	} catch {
		/* the drag still tracks, it just stops at the panel's edge */
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Vaul's rubber band. Stays negative until the drag is past ~6px, so a panel
 * pulled beyond its open position barely moves and then moves logarithmically.
 */
function dampen(distance: number): number {
	return 8 * (Math.log(distance + 1) - 2);
}

/**
 * How far past a bound a damped overdrag actually lands: nothing at all for the
 * first few px, then a fraction of the distance the pointer travelled.
 */
function overdrag(distance: number): number {
	return Math.max(dampen(distance), 0);
}

/** A snap point as the distance in px it sits from the panel's fully open position. */
function snapDisplacement(point: DrawerSnapPoint, viewport: number): number {
	const extent = typeof point === "string" ? Number.parseFloat(point) : point * viewport;
	if (Number.isNaN(extent)) return 0;
	return Math.max(viewport - extent, 0);
}

function closestIndex(offsets: readonly number[], displacement: number): number {
	let best = 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const [index, offset] of offsets.entries()) {
		const distance = Math.abs(offset - displacement);
		if (distance < bestDistance) {
			best = index;
			bestDistance = distance;
		}
	}
	return best;
}

export type DrawerRootProps = ModalRootOptions & {
	/** Edge the panel is anchored to. Defaults to `"bottom"`. */
	direction?: DrawerDirection;
	/**
	 * When false, nothing in the drawer closes it — the drag, Escape, the scrim,
	 * and `DrawerClose` all stop. Drive `open` yourself. Defaults to true.
	 */
	dismissible?: boolean;
	/** Fraction of the panel a drag must cover to dismiss on release. Defaults to `0.25`. */
	closeThreshold?: number;
	/** ms after scrolling inside the panel during which a drag will not start. Defaults to `100`. */
	scrollLockTimeout?: number;
	/** When true, only `DrawerHandle` starts a drag. Defaults to false. */
	handleOnly?: boolean;
	/** Resting positions, least to most of the screen. Without them the panel only opens fully. */
	snapPoints?: DrawerSnapPoint[];
	/** The snap point the panel rests at. Pass a signal to drive it from outside. */
	activeSnapPoint?: Signal<DrawerSnapPoint | null> | DrawerSnapPoint | null;
	/** Snap point index the overlay finishes fading in at. Defaults to the last one. */
	fadeFromIndex?: number;
	/** When true, a fling moves one snap point at a time instead of skipping to the end. */
	snapToSequentialPoint?: boolean;
	/** When true, the page behind is marked so CSS can scale it back. Defaults to false. */
	scaleBackground?: boolean;
	/** Runs on every drag frame with how far the panel is from its resting position, 0 to 1. */
	onDrag?: (progress: number) => void;
	/** Runs when a drag ends, with whether the drawer stays open. */
	onRelease?: (open: boolean) => void;
};

/**
 * The drawer's own state, on top of the shared modal base. The modal half owns
 * open/closed, focus, dismissal, and nesting; this half owns the drag: where
 * the panel currently sits (`displacement`, in px from fully open along its
 * axis), which snap point it is resting at, and what the release does with the
 * gesture's velocity.
 */
export class DrawerState extends ModalState {
	readonly direction: DrawerDirection;
	readonly snapPoints: readonly DrawerSnapPoint[];
	readonly fadeFromIndex: number;
	readonly dismissible: boolean;
	readonly handleOnly: boolean;
	readonly closeThreshold: number;
	readonly scrollLockTimeout: number;
	readonly snapToSequentialPoint: boolean;
	readonly scaleBackground: boolean;

	/** The snap point the panel rests at, or null when there are none. */
	activeSnapPoint: Signal<DrawerSnapPoint | null>;
	/** How far the panel sits from fully open, in px along its axis. Never negative in rest. */
	displacement = signal(0);
	dragging = signal(false);
	/** Viewport extent along the axis. Snap points resolve against it, as in Vaul. */
	viewportSize = signal(0);
	/** The panel's own extent along the axis, which the close threshold is a fraction of. */
	panelSize = signal(0);
	/** The mounted panel, republished from the modal base's content ref. */
	contentElement = signal<HTMLElement | null>(null);

	readonly snapOffsets: Readable<number[]>;
	readonly activeIndex: Readable<number>;
	/** Where the panel sits when nothing is dragging it. */
	readonly restingDisplacement: Readable<number>;
	/** 0 at rest, 1 once a drag has pulled the panel a full panel away. */
	readonly progress: Readable<number>;
	/** The overlay's opacity, 1 fully covering the page and 0 fully clear. */
	readonly fade: Readable<number>;

	private readonly onDragProp: ((progress: number) => void) | undefined;
	private readonly onReleaseProp: ((open: boolean) => void) | undefined;
	private pointer: { id: number; x: number; y: number; at: number; from: number } | null = null;
	private allowedToDrag = false;
	private lastScrollAt = 0;
	private openedAt = 0;
	private suppressClick = false;
	private contentRefUnsub: (() => void) | null = null;

	constructor(props: DrawerRootProps) {
		super(
			{
				name: "drawer",
				role: "dialog",
				interactOutsideBehavior: "close",
				dismissible: props.dismissible ?? true,
			},
			props,
		);
		this.direction = props.direction ?? "bottom";
		this.snapPoints = props.snapPoints ?? [];
		this.fadeFromIndex = props.fadeFromIndex ?? this.snapPoints.length - 1;
		this.dismissible = props.dismissible ?? true;
		this.handleOnly = props.handleOnly ?? false;
		this.closeThreshold = props.closeThreshold ?? CLOSE_THRESHOLD;
		this.scrollLockTimeout = props.scrollLockTimeout ?? SCROLL_LOCK_TIMEOUT;
		this.snapToSequentialPoint = props.snapToSequentialPoint ?? false;
		this.scaleBackground = props.scaleBackground ?? false;
		this.onDragProp = props.onDrag;
		this.onReleaseProp = props.onRelease;
		this.activeSnapPoint = signal(props.activeSnapPoint ?? this.snapPoints[0] ?? null);

		this.snapOffsets = derived([this.viewportSize], (viewport) =>
			this.snapPoints.map((point) => snapDisplacement(point, viewport)),
		);
		this.activeIndex = derived([this.activeSnapPoint], (point) =>
			point === null ? -1 : this.snapPoints.indexOf(point),
		);
		this.restingDisplacement = derived(
			[this.snapOffsets, this.activeIndex],
			(offsets, index) => offsets[index] ?? 0,
		);
		this.progress = derived(
			[this.displacement, this.restingDisplacement, this.panelSize, this.viewportSize],
			(displacement, resting, panel, viewport) => {
				const size = panel > 0 ? panel : viewport;
				if (size <= 0) return 0;
				return clamp((displacement - resting) / size, 0, 1);
			},
		);
		this.fade = derived(
			[this.displacement, this.snapOffsets, this.panelSize, this.viewportSize],
			(displacement, offsets, panel, viewport) => {
				if (offsets.length === 0) {
					const size = panel > 0 ? panel : viewport;
					return size <= 0 ? 1 : clamp(1 - displacement / size, 0, 1);
				}
				// the overlay is clear below `fadeFromIndex` and solid from it up, so it
				// crosses between the two snap points on either side of that boundary
				const solid = offsets[this.fadeFromIndex] ?? 0;
				const clear = offsets[this.fadeFromIndex - 1] ?? viewport;
				if (clear <= solid) return 1;
				return clamp((clear - displacement) / (clear - solid), 0, 1);
			},
		);
	}

	get hasSnapPoints(): boolean {
		return this.snapPoints.length > 0;
	}

	get vertical(): boolean {
		return isVertical(this.direction);
	}

	get sign(): 1 | -1 {
		return closingSign(this.direction);
	}

	/** True once the panel is far enough open that the overlay is fully opaque. */
	get fadedIn(): Readable<boolean> {
		return this.activeIndex.bind((index) => index >= this.fadeFromIndex);
	}

	registerContent(content: ModalContentState) {
		super.registerContent(content);
		this.contentRefUnsub?.();
		this.contentElement.set(content.opts.ref.get());
		this.contentRefUnsub = content.opts.ref.onChange((el) => this.contentElement.set(el));
	}

	detach() {
		super.detach();
		this.contentRefUnsub?.();
		this.contentRefUnsub = null;
		this.contentElement.set(null);
	}

	measureViewport() {
		if (typeof window === "undefined") return;
		this.viewportSize.set(this.vertical ? window.innerHeight : window.innerWidth);
	}

	measurePanel() {
		const el = this.contentElement.get();
		if (!el) return;
		// offset sizes rather than the bounding rect: a nested drawer scales its
		// parent's panel, and the measurement must not follow the transform
		this.panelSize.set(this.vertical ? el.offsetHeight : el.offsetWidth);
	}

	/** Data attributes and CSS variables the panel exposes for the drag. */
	get contentProps() {
		return {
			"data-drawer-direction": this.direction,
			"data-dragging": this.dragging.bind(presence),
			"data-snap-points": presence(this.hasSnapPoints),
			"data-snap-point": this.activeIndex.bind((index) =>
				this.hasSnapPoints ? String(Math.max(index, 0)) : undefined,
			),
			style: {
				[OFFSET_X_VAR]: this.displacement.bind((d) =>
					this.vertical ? "0px" : `${d * this.sign}px`,
				),
				[OFFSET_Y_VAR]: this.displacement.bind((d) =>
					this.vertical ? `${d * this.sign}px` : "0px",
				),
				[PROGRESS_VAR]: this.progress.bind(String),
			},
		};
	}

	/** The pointer handlers the panel takes, unless `handleOnly` moved them to the handle. */
	get dragProps() {
		return {
			onPointerdown: (e: PointerEvent) => this.onPointerdown(e),
			onPointermove: (e: PointerEvent) => this.onPointermove(e),
		};
	}

	/** The handlers that end a drag. Always on the panel, even when only the handle starts one. */
	get releaseProps() {
		return {
			onPointerup: (e: PointerEvent) => this.onPointerup(e),
			onPointercancel: (e: PointerEvent) => this.onPointercancel(e),
		};
	}

	onPointerdown(e: PointerEvent) {
		if (e.button !== 0) return;
		// with nothing to snap to and no dismissal, there is nowhere for a drag to go
		if (!this.dismissible && !this.hasSnapPoints) return;
		const el = this.contentElement.get();
		if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return;
		this.measurePanel();
		// a drag that ended somewhere without a click must not swallow the next one
		this.suppressClick = false;
		// captured on the target rather than the panel, so a drag that leaves the
		// panel still reaches it by bubbling and a press that turns out to be a
		// click still clicks the thing it started on
		capturePointer(e.target, e.pointerId);
		this.pointer = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			at: Date.now(),
			from: this.displacement.get(),
		};
		this.allowedToDrag = false;
	}

	onPointermove(e: PointerEvent) {
		const pointer = this.pointer;
		if (!pointer || e.pointerId !== pointer.id) return;

		const along = (this.vertical ? e.clientY - pointer.y : e.clientX - pointer.x) * this.sign;
		const across = this.vertical ? e.clientX - pointer.x : e.clientY - pointer.y;

		if (!this.dragging.get()) {
			const threshold = e.pointerType === "touch" ? TOUCH_DRAG_START : MOUSE_DRAG_START;
			if (Math.abs(along) < threshold) {
				// the gesture committed to the other axis; it is a scroll, not a drag
				if (Math.abs(across) >= threshold) this.pointer = null;
				return;
			}
			if (Math.abs(across) > Math.abs(along)) {
				this.pointer = null;
				return;
			}
			if (!this.allowedToDrag && !this.shouldDrag(e.target, along)) return;
			// once a drag is allowed it stays allowed: scrolling to the top mid-gesture
			// must not hand the rest of the drag back to the scroll container
			this.allowedToDrag = true;
			this.dragging.set(true);
		}

		this.displacement.set(this.clampDisplacement(pointer.from + along));
		this.onDragProp?.(this.progress.get());
	}

	onPointerup(e: PointerEvent) {
		const pointer = this.pointer;
		if (!pointer || e.pointerId !== pointer.id) return;
		this.pointer = null;
		this.allowedToDrag = false;
		if (!this.dragging.get()) return;

		this.dragging.set(false);
		this.suppressClick = true;
		const along = (this.vertical ? e.clientY - pointer.y : e.clientX - pointer.x) * this.sign;
		const elapsed = Math.max(1, Date.now() - pointer.at);
		this.settle(along, Math.abs(along) / elapsed);
	}

	onPointercancel(e: PointerEvent) {
		if (!this.pointer || e.pointerId !== this.pointer.id) return;
		this.cancelDrag();
	}

	/**
	 * A drag that moved the panel must not also click whatever it started on —
	 * a button in the panel, or the handle, which would take the release for a
	 * tap and step the snap point the drag just left.
	 */
	private onClickCapture(e: Event) {
		if (!this.suppressClick) return;
		this.suppressClick = false;
		e.preventDefault();
		e.stopPropagation();
	}

	cancelDrag() {
		this.pointer = null;
		this.allowedToDrag = false;
		this.dragging.set(false);
		this.rest();
	}

	/** Move the panel back to the snap point it is resting at. */
	rest() {
		this.displacement.set(this.restingDisplacement.get());
	}

	snapTo(index: number) {
		const bounded = clamp(index, 0, this.snapPoints.length - 1);
		this.activeSnapPoint.set(this.snapPoints[bounded] ?? null);
		this.displacement.set(this.snapOffsets.get()[bounded] ?? 0);
	}

	/**
	 * Tapping the handle steps to the next snap point, and closes from the last
	 * one. With no snap points there is nothing to step through, so it does nothing.
	 */
	cycleSnapPoint() {
		if (!this.hasSnapPoints) return;
		const index = this.activeIndex.get();
		if (index >= this.snapPoints.length - 1) {
			if (this.dismissible) this.close();
			return;
		}
		this.snapTo(index + 1);
	}

	/** Everything the root has to keep in step while it is mounted. */
	onMount(): () => void {
		const stops: (() => void)[] = [];
		this.measureViewport();

		// the click has to be caught on the way down to beat the handle and any
		// button in the panel, and core only parses `on*Capture` for document and
		// window props — so this one is bound by hand
		const suppressClick = (e: Event) => this.onClickCapture(e);
		let observer: ResizeObserver | null = null;
		let bound: HTMLElement | null = null;
		const observe = (el: HTMLElement | null) => {
			observer?.disconnect();
			observer = null;
			bound?.removeEventListener("click", suppressClick, true);
			bound = el;
			if (!el) return;
			el.addEventListener("click", suppressClick, true);
			this.measurePanel();
			if (typeof ResizeObserver === "undefined") return;
			observer = new ResizeObserver(() => this.measurePanel());
			observer.observe(el);
		};
		observe(this.contentElement.get());
		stops.push(this.contentElement.onChange(observe));
		stops.push(() => {
			observer?.disconnect();
			bound?.removeEventListener("click", suppressClick, true);
		});

		// a resize moves every snap point, and the panel follows unless a hand is on it
		stops.push(
			this.restingDisplacement.onChange((displacement) => {
				if (!this.dragging.get()) this.displacement.set(displacement);
			}),
		);

		const sync = (open: boolean) => {
			if (open) {
				this.openedAt = Date.now();
				this.measureViewport();
				this.measurePanel();
				this.rest();
				return;
			}
			this.openedAt = 0;
			this.cancelDrag();
			if (this.hasSnapPoints) this.activeSnapPoint.set(this.snapPoints[0] ?? null);
			this.rest();
		};
		if (this.open.get()) sync(true);
		stops.push(this.open.onChange(sync));
		stops.push(this.watchBackground());

		return () => {
			for (const stop of stops) stop();
		};
	}

	private clampDisplacement(displacement: number): number {
		const offsets = this.snapOffsets.get();
		const size = this.panelSize.get() || this.viewportSize.get();
		const min = offsets.length > 0 ? Math.min(...offsets) : 0;
		// a drawer that cannot be dismissed stops at its smallest snap point
		const max = this.dismissible ? Math.max(size, min) : Math.max(min, ...offsets);
		if (displacement < min) return min - overdrag(min - displacement);
		if (displacement > max) return max + overdrag(displacement - max);
		return displacement;
	}

	/** Where the panel lands once the pointer lifts, given the gesture's velocity. */
	private settle(along: number, velocity: number) {
		const towardOpen = along < 0;

		if (!this.hasSnapPoints) {
			if (towardOpen) return this.release(true);
			if (this.dismissible && velocity > VELOCITY_THRESHOLD) return this.release(false);
			const viewport = this.viewportSize.get();
			const panel = this.panelSize.get() || viewport;
			const visible = viewport > 0 ? Math.min(panel, viewport) : panel;
			if (this.dismissible && this.displacement.get() >= visible * this.closeThreshold) {
				return this.release(false);
			}
			return this.release(true);
		}

		const offsets = this.snapOffsets.get();
		const last = offsets.length - 1;
		const index = Math.max(this.activeIndex.get(), 0);

		// a hard fling goes the whole way, unless every snap point is worth stopping at
		if (!this.snapToSequentialPoint && velocity > FLING_VELOCITY) {
			if (towardOpen) return this.release(true, last);
			if (this.dismissible) return this.release(false);
			return this.release(true, 0);
		}

		// a flick that stayed short moves one snap point in the direction it went
		if (velocity > VELOCITY_THRESHOLD && Math.abs(along) < this.viewportSize.get() * 0.4) {
			if (towardOpen) return this.release(true, Math.min(index + 1, last));
			if (index > 0) return this.release(true, index - 1);
			if (this.dismissible) return this.release(false);
			return this.release(true, 0);
		}

		this.release(true, closestIndex(offsets, this.displacement.get()));
	}

	private release(open: boolean, index?: number) {
		if (!open) {
			this.close();
		} else if (index === undefined) {
			this.rest();
		} else {
			this.snapTo(index);
		}
		this.onReleaseProp?.(open);
	}

	/**
	 * Vaul's `shouldDrag`, which is what lets a scrollable panel scroll: a drag
	 * only starts from a scroll container already at the edge the panel would
	 * leave from, and not for a moment after one has scrolled.
	 */
	private shouldDrag(target: EventTarget | null, along: number): boolean {
		if (!(target instanceof Element)) return true;
		if (target.tagName === "SELECT") return false;
		if (target.closest(NO_DRAG_SELECTOR) !== null) return false;

		const now = Date.now();
		// the enter transition is still running; let the content scroll under it
		if (this.openedAt !== 0 && now - this.openedAt < OPEN_GRACE) return false;
		// the panel is already translated off its fully open position — mid-drag, or
		// resting at a snap point short of the top — so there is room to drag either way
		if (this.displacement.get() > 0) return true;
		if (typeof window !== "undefined" && (window.getSelection()?.toString().length ?? 0) > 0) {
			return false;
		}
		if (this.lastScrollAt !== 0 && now - this.lastScrollAt < this.scrollLockTimeout) {
			this.lastScrollAt = now;
			return false;
		}
		// dragging back toward open from the resting position is a scroll
		if (along < 0) {
			this.lastScrollAt = now;
			return false;
		}
		if (this.scrolledAway(target)) {
			this.lastScrollAt = now;
			return false;
		}
		return true;
	}

	/**
	 * True when the drawer's axis can actually be scrolled at `el` — not merely
	 * that content overflows it. Every element with something sticking out of it
	 * reports `scrollHeight > clientHeight`, the handle's own 44px hit area
	 * included, and a 6px bar that cannot scroll must not be taken for a list
	 * that can.
	 */
	private scrolls(el: Element): boolean {
		const scrollSize = this.vertical ? el.scrollHeight : el.scrollWidth;
		const clientSize = this.vertical ? el.clientHeight : el.clientWidth;
		if (scrollSize <= clientSize + 1) return false;
		if (typeof window === "undefined") return false;
		const style = window.getComputedStyle(el);
		const overflow = this.vertical ? style.overflowY : style.overflowX;
		return overflow === "auto" || overflow === "scroll" || overflow === "overlay";
	}

	/** True when something between the target and the panel is scrolled off its edge. */
	private scrolledAway(target: Element): boolean {
		const content = this.contentElement.get();
		for (let el: Element | null = target; el !== null; el = el.parentElement) {
			if (this.scrolls(el)) {
				const scrollSize = this.vertical ? el.scrollHeight : el.scrollWidth;
				const clientSize = this.vertical ? el.clientHeight : el.clientWidth;
				const position = this.vertical ? el.scrollTop : el.scrollLeft;
				// the edge a drag pulls the panel away from: the start of the list for a
				// drawer that closes along the axis, the end for one that closes back up it
				const atEdge = this.sign > 0 ? position <= 0 : position + clientSize >= scrollSize - 1;
				if (!atEdge) return true;
			}
			if (el === content) break;
		}
		return false;
	}

	/**
	 * Marks the document while an outermost drawer is open, so a page that opts
	 * in with `[data-drawer-wrapper]` can scale itself back behind the panel.
	 * Nested drawers leave it alone — the panel behind them is another drawer.
	 */
	private watchBackground(): () => void {
		if (!this.scaleBackground || typeof document === "undefined") return noop;
		const root = document.documentElement;

		const clear = () => {
			root.removeAttribute(BACKGROUND_ATTRIBUTE);
			root.style.removeProperty(SCALE_VAR);
			root.style.removeProperty(PROGRESS_VAR);
		};
		const apply = () => {
			if (!this.open.get() || this.nested.get()) {
				clear();
				return;
			}
			const width = window.innerWidth || 1;
			const scale = (width - BACKGROUND_INSET) / width;
			const progress = this.progress.get();
			root.setAttribute(BACKGROUND_ATTRIBUTE, "");
			// the page comes back to full size as the drag pulls the panel away
			root.style.setProperty(SCALE_VAR, String(scale + progress * (1 - scale)));
			root.style.setProperty(PROGRESS_VAR, String(progress));
		};

		apply();
		const stops = [
			this.open.onChange(apply),
			this.nested.onChange(apply),
			this.progress.onChange(apply),
		];
		return () => {
			for (const stop of stops) stop();
			clear();
		};
	}
}

export const DrawerCtx = context<DrawerState>("DrawerCtx");

/**
 * A panel that slides in from an edge and can be dragged back out — Vaul's
 * drawer, on the same modal base as Dialog. It keeps the focus trap, Escape,
 * outside dismissal, scroll lock, and nesting, and adds the gesture: snap
 * points, velocity-aware release, and a rubber band past the open position.
 */
export const Drawer = createComponent(function Drawer(
	props: DrawerRootProps,
	...children: Child[]
) {
	const state = new DrawerState(props);
	return DrawerCtx.Provide(state).To(
		ModalRoot(
			state,
			ImplementLifecycle({ onMount: () => state.onMount() }),
			ImplementWindow({ onResize: () => state.measureViewport() }),
			...children,
		),
	);
});

export type DrawerTriggerProps = ModalTriggerProps;
export const DrawerTrigger = ModalTrigger;

export type DrawerTitleProps = ModalTitleProps;
export const DrawerTitle = ModalTitle;

export type DrawerDescriptionProps = ModalDescriptionProps;
export const DrawerDescription = ModalDescription;

export type DrawerPortalProps = PortalProps;
export const DrawerPortal = Portal;

export type DrawerCloseProps = ModalCloseProps;

export const DrawerClose = createComponent(function DrawerClose(
	props: DrawerCloseProps,
	...children: Child[]
) {
	return ModalClose({}, props, ...children);
});

export type DrawerOverlayProps = ModalOverlayProps;

/**
 * The backdrop. Its `--ip-drawer-fade` follows the drag, so the page behind
 * comes back as the panel is pulled away, and stays clear below the snap
 * point the overlay fades in from.
 */
export const DrawerOverlay = createComponent(function DrawerOverlay(
	props: DrawerOverlayProps,
	...children: Child[]
) {
	return DrawerCtx.Use((state) =>
		ModalOverlay(
			mergeProps(
				{
					"data-drawer-direction": state.direction,
					"data-dragging": state.dragging.bind(presence),
					"data-snap-points": presence(state.hasSnapPoints),
					"data-faded-in": state.fadedIn.bind(presence),
					style: {
						[FADE_VAR]: state.fade.bind(String),
						[PROGRESS_VAR]: state.progress.bind(String),
					},
				},
				props,
			),
			...children,
		),
	);
});

export type DrawerContentProps = ModalContentProps;

/**
 * The panel. Position it against the edge named by `direction` and translate
 * it with `--ip-drawer-offset-x` / `--ip-drawer-offset-y`, which carry the
 * drag and the active snap point together.
 */
export const DrawerContent = createComponent(function DrawerContent(
	props: DrawerContentProps,
	...children: Child[]
) {
	return DrawerCtx.Use((state) =>
		ModalContent(
			mergeProps(
				state.contentProps,
				state.releaseProps,
				state.handleOnly ? {} : state.dragProps,
				props,
			),
			...children,
		),
	);
});

export type DrawerHandleProps = ComponentProps<typeof Div> & {
	/** When true, tapping the handle no longer steps through the snap points. */
	preventCycle?: boolean;
};

/**
 * The grab bar. It is the only drag surface when the root sets `handleOnly`,
 * and tapping it steps to the next snap point (closing from the last one)
 * unless `preventCycle` says otherwise. A press held long enough to be a drag
 * rather than a tap does not cycle.
 */
export const DrawerHandle = createComponent(function DrawerHandle(
	{ id = getId(), preventCycle = false, ...restProps }: DrawerHandleProps,
	...children: Child[]
) {
	return DrawerCtx.Use((state) => {
		let pressTimer: ReturnType<typeof setTimeout> | null = null;
		let heldTooLong = false;

		const endPress = () => {
			if (pressTimer !== null) clearTimeout(pressTimer);
			pressTimer = null;
			heldTooLong = false;
		};

		const cycle = () => {
			// a long press was a drag attempt, and a tap during one is not a tap
			if (state.dragging.get() || preventCycle || heldTooLong) {
				endPress();
				return;
			}
			endPress();
			state.cycleSnapPoint();
		};

		return Div(
			mergeProps(
				{
					id,
					"data-drawer-handle": "",
					"data-state": state.state,
					"aria-hidden": true,
					// the second tap of a double tap arrives inside this window and cancels the cycle
					onClick: () => setTimeout(cycle, HANDLE_TAP_TIMEOUT),
					onPointerdown: (e: PointerEvent) => {
						if (state.handleOnly) state.onPointerdown(e);
						endPress();
						pressTimer = setTimeout(() => {
							heldTooLong = true;
						}, HANDLE_PRESS_TIMEOUT);
					},
					onPointermove: (e: PointerEvent) => {
						if (state.handleOnly) state.onPointermove(e);
					},
					onPointercancel: () => endPress(),
				},
				restProps,
			),
			Span({ "data-drawer-handle-hitarea": "", "aria-hidden": true }, ...children),
		);
	});
});
