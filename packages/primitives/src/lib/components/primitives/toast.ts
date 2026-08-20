import {
	Button,
	context,
	derived,
	Div,
	Implement,
	Portal,
	ref,
	signal,
	type Bindable,
	type Child,
	type ComponentProps,
	type PortalProps,
	type Readable,
	type Signal,
} from "@implementjs/core";
import { getId } from "../../utils";
import { mergeProps } from "../../merge-props";

function presence(on: boolean): "" | undefined {
	return on ? "" : undefined;
}

export type ToastPriority = "low" | "high";

export type SwipeDirection = "up" | "down" | "left" | "right";

export type ToastOptions = {
	/** Reuse an id to update the existing toast in place instead of adding another. */
	id?: string;
	title?: string;
	description?: string;
	/** A styling hook (`"success"`, `"error"`, …) rendered as `data-type` on the parts. */
	type?: string;
	/** Auto-dismiss delay in ms for this toast. `0` keeps it until closed. */
	timeout?: number;
	/** How urgently screen readers announce the toast. Defaults to `"low"` (polite). */
	priority?: ToastPriority;
	/** Anything else the render function needs: an icon, an action callback, a payload. */
	data?: unknown;
	/** Runs when the toast starts closing (timeout, swipe, or `close`). */
	onClose?: () => void;
	/** Runs when the toast is removed from the list, after any exit transition. */
	onRemove?: () => void;
};

export type ToastData = ToastOptions & {
	id: string;
	priority: ToastPriority;
	/** True while the toast animates out; it leaves the list when the exit finishes. */
	ending: boolean;
};

export type ToastPromiseOptions<T> = {
	loading: string | ToastOptions;
	success: string | ToastOptions | ((data: T) => string | ToastOptions);
	error: string | ToastOptions | ((error: unknown) => string | ToastOptions);
};

export type ToastManagerOptions = {
	/** Auto-dismiss delay in ms for toasts that don't set their own. Defaults to 5000; 0 disables. */
	timeout?: number;
	/** How many toasts show at once. Extra toasts stay in the list with `data-limited`. Defaults to 3. */
	limit?: number;
};

const MANAGER_DEFAULTS = {
	timeout: 5000,
	limit: 3,
} satisfies Required<ToastManagerOptions>;

type TimerEntry = {
	/** ms left on the clock; `null` when the toast never auto-dismisses. */
	remaining: number | null;
	startedAt: number | null;
	handle: ReturnType<typeof setTimeout> | null;
};

function resolvePromiseState<T>(
	state: string | ToastOptions | ((value: T) => string | ToastOptions),
	value: T,
): ToastOptions {
	const resolved = typeof state === "function" ? state(value) : state;
	return typeof resolved === "string" ? { title: resolved } : resolved;
}

/**
 * Owns the list of toasts and their clocks. Create one with
 * `createToastManager()` — usually at module scope so `add` can be called from
 * anywhere — and hand it to `ToastProvider`.
 */
export class ToastManager {
	/** Current toasts, frontmost first. Render with `ForEach(manager.toasts, (t) => t.id, ...)`. */
	toasts: Signal<ToastData[]>;
	/** Measured heights by toast id, filled in by each mounted `Toast` root. */
	heights = Implement.Map<string, number>();
	options: Required<ToastManagerOptions>;

	private timers = new Map<string, TimerEntry>();
	private pauseReasons = new Set<string>();
	/** How many mounted roots can animate each toast's exit. */
	private rootCounts = new Map<string, number>();

	constructor(options: ToastManagerOptions = {}) {
		this.toasts = signal<ToastData[]>([]);
		this.options = { ...MANAGER_DEFAULTS, ...options };
	}

	/** Adds a toast (or updates the one already using `options.id`) and returns its id. */
	add(options: ToastOptions = {}): string {
		const id = options.id ?? getId();
		if (this.toasts.get().some((t) => t.id === id)) {
			this.update(id, options);
			return id;
		}

		const toast: ToastData = { priority: "low", ...options, id, ending: false };
		this.toasts.set([toast, ...this.toasts.get()]);
		this.timers.set(id, { remaining: this.clockFor(toast), startedAt: null, handle: null });
		this.syncTimers();
		return id;
	}

	/** Merges new options into an existing toast and restarts its clock. */
	update(id: string, options: Omit<ToastOptions, "id">) {
		const list = this.toasts.get();
		const current = list.find((t) => t.id === id);
		if (!current || current.ending) return;

		const next: ToastData = { ...current, ...options };
		this.toasts.set(list.map((t) => (t.id === id ? next : t)));

		const entry = this.timers.get(id);
		if (entry) {
			this.stopTimer(entry);
			entry.remaining = this.clockFor(next);
		}
		this.syncTimers();
	}

	/**
	 * Starts dismissing a toast, or every toast when no id is given. A mounted
	 * root plays its exit first; without one the toast is removed immediately.
	 */
	close(id?: string) {
		if (id === undefined) {
			// `set` replaces the array, so this snapshot is safe to iterate while closing
			for (const toast of this.toasts.get()) this.close(toast.id);
			return;
		}

		const list = this.toasts.get();
		const toast = list.find((t) => t.id === id);
		if (!toast || toast.ending) return;

		const entry = this.timers.get(id);
		if (entry) this.stopTimer(entry);
		toast.onClose?.();

		if ((this.rootCounts.get(id) ?? 0) > 0) {
			this.toasts.set(this.toasts.get().map((t) => (t.id === id ? { ...t, ending: true } : t)));
		} else {
			this.remove(id);
		}
		this.syncTimers();
	}

	/** Drops a toast from the list with no exit transition. Roots call this after theirs. */
	remove(id: string) {
		const list = this.toasts.get();
		const toast = list.find((t) => t.id === id);
		if (!toast) return;

		this.toasts.set(list.filter((t) => t.id !== id));
		this.timers.delete(id);
		this.heights.delete(id);
		toast.onRemove?.();
		this.syncTimers();
	}

	/**
	 * Shows a loading toast for the promise, then updates it into the success
	 * or error state. Returns the same promise, still rejecting on error.
	 */
	promise<T>(promise: Promise<T>, options: ToastPromiseOptions<T>): Promise<T> {
		const loading =
			typeof options.loading === "string" ? { title: options.loading } : options.loading;
		const id = this.add({ type: "loading", ...loading, timeout: loading.timeout ?? 0 });

		promise.then(
			(data) => {
				const state = resolvePromiseState(options.success, data);
				this.update(id, {
					type: "success",
					...state,
					timeout: state.timeout ?? this.options.timeout,
				});
			},
			(error: unknown) => {
				const state = resolvePromiseState(options.error, error);
				this.update(id, {
					type: "error",
					...state,
					timeout: state.timeout ?? this.options.timeout,
				});
			},
		);

		return promise;
	}

	/** Freezes every clock until each `pause` reason has been `resume`d. */
	pause(reason = "manual") {
		this.pauseReasons.add(reason);
		this.syncTimers();
	}

	resume(reason = "manual") {
		this.pauseReasons.delete(reason);
		this.syncTimers();
	}

	registerRoot(id: string) {
		this.rootCounts.set(id, (this.rootCounts.get(id) ?? 0) + 1);
	}

	unregisterRoot(id: string) {
		const count = (this.rootCounts.get(id) ?? 0) - 1;
		if (count <= 0) this.rootCounts.delete(id);
		else this.rootCounts.set(id, count);
	}

	dispose() {
		for (const entry of this.timers.values()) this.stopTimer(entry);
		this.timers.clear();
	}

	private clockFor(toast: ToastData): number | null {
		const timeout = toast.timeout ?? this.options.timeout;
		return timeout > 0 ? timeout : null;
	}

	/**
	 * A toast's clock only runs while it is visible (inside the limit), not
	 * ending, and nothing has the manager paused. Hidden toasts keep their
	 * remaining time for when they surface.
	 */
	private syncTimers() {
		const paused = this.pauseReasons.size > 0;
		const limit = this.options.limit;
		this.toasts.get().forEach((toast, index) => {
			const entry = this.timers.get(toast.id);
			if (!entry || entry.remaining === null) return;

			const shouldRun = !paused && !toast.ending && index < limit;
			if (shouldRun && entry.handle === null) {
				entry.startedAt = Date.now();
				entry.handle = setTimeout(() => {
					entry.handle = null;
					this.close(toast.id);
				}, entry.remaining);
			} else if (!shouldRun && entry.handle !== null) {
				this.stopTimer(entry);
			}
		});
	}

	private stopTimer(entry: TimerEntry) {
		if (entry.handle === null) return;
		clearTimeout(entry.handle);
		entry.handle = null;
		if (entry.remaining !== null && entry.startedAt !== null) {
			entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
		}
		entry.startedAt = null;
	}
}

export function createToastManager(options: ToastManagerOptions = {}): ToastManager {
	return new ToastManager(options);
}

export type ToastProviderProps = ToastManagerOptions & {
	/** Share a manager created with `createToastManager()`; omitted, the provider makes its own. */
	manager?: ToastManager;
	/** Pixels between expanded toasts, used when computing `--toast-offset-y`. Defaults to 16. */
	gap?: number;
	/** Keyboard shortcut that moves focus into the viewport. Defaults to `"F6"`. */
	hotkey?: string;
};

class ToastProviderState {
	readonly manager: ToastManager;
	readonly gap: number;
	readonly hotkey: string;
	hovering = signal(false);
	focusWithin = signal(false);
	viewportRef = signal<HTMLDivElement | null>(null);

	constructor(readonly opts: ToastProviderProps) {
		this.manager = opts.manager ?? new ToastManager();
		if (opts.timeout !== undefined) this.manager.options.timeout = opts.timeout;
		if (opts.limit !== undefined) this.manager.options.limit = opts.limit;
		this.gap = opts.gap ?? 16;
		this.hotkey = opts.hotkey ?? "F6";
	}

	/** True while the pointer or keyboard focus is on the stack, spreading it out. */
	get expanded(): Readable<boolean> {
		return derived([this.hovering, this.focusWithin], (hover, focus) => hover || focus);
	}

	handleHotkey(e: KeyboardEvent) {
		if (e.key !== this.hotkey) return;
		const viewport = this.viewportRef.get();
		if (!viewport || this.manager.toasts.get().length === 0) return;
		e.preventDefault();
		viewport.focus();
	}
}

const ToastProviderContext = context<ToastProviderState>();

/**
 * Provides the manager and timing to every toast part inside it. Wrap it around
 * the app (or at least around the `ToastViewport`). Timers pause while the
 * pointer is over the stack, while it holds focus, and while the tab is hidden.
 */
export function ToastProvider(props: ToastProviderProps, ...children: Child[]) {
	const state = new ToastProviderState(props);
	const ownsManager = props.manager === undefined;
	return ToastProviderContext.Provide(state).To(
		Implement.Window({
			onBlur: () => state.manager.pause("window-blur"),
			onFocus: () => state.manager.resume("window-blur"),
		}),
		Implement.Document({
			onKeydown: (e: KeyboardEvent) => state.handleHotkey(e),
			onVisibilitychange: () => {
				if (document.hidden) state.manager.pause("document-hidden");
				else state.manager.resume("document-hidden");
			},
		}),
		Implement.Lifecycle(
			{
				onUnmount: () => {
					if (ownsManager) state.manager.dispose();
				},
			},
			...children,
		),
	);
}

export type ToastViewportProps = ComponentProps<typeof Div>;

/**
 * The landmark region holding the toasts. Render the stack inside it:
 * `ForEach(manager.toasts, (t) => t.id, (toast) => Toast({ toast }, ...))`.
 * Hover or focus expands the stack; the provider's hotkey focuses it.
 */
export function ToastViewport(
	{ id = getId(), ...restProps }: ToastViewportProps,
	...children: Child[]
) {
	return ToastProviderContext.Use((provider) => {
		const viewportRef = ref<HTMLDivElement>();

		return Implement.Lifecycle(
			{
				onMount: () => {
					provider.viewportRef.set(viewportRef.get());
					return () => provider.viewportRef.set(null);
				},
			},
			Div(
				mergeProps(
					{
						id,
						this: viewportRef,
						role: "region",
						tabIndex: -1,
						"aria-label": `Notifications (${provider.hotkey})`,
						"data-toast-viewport": "",
						"data-expanded": provider.expanded.bind(presence),
						onPointerenter: () => {
							provider.hovering.set(true);
							provider.manager.pause("hover");
						},
						onPointerleave: () => {
							provider.hovering.set(false);
							provider.manager.resume("hover");
						},
						onFocusin: () => {
							provider.focusWithin.set(true);
							provider.manager.pause("focus");
						},
						onFocusout: (e: FocusEvent) => {
							const viewport = viewportRef.get();
							if (
								viewport &&
								e.relatedTarget instanceof Node &&
								viewport.contains(e.relatedTarget)
							) {
								return;
							}
							provider.focusWithin.set(false);
							provider.manager.resume("focus");
						},
					},
					restProps,
				),
				...children,
			),
		);
	});
}

const DEFAULT_SWIPE_DIRECTIONS: SwipeDirection[] = ["down", "right"];
/** How far a swipe must travel, in px, to dismiss instead of springing back. */
const SWIPE_THRESHOLD = 45;
/** Movement in px before a drag counts as a swipe and stops being a click. */
const SWIPE_START_THRESHOLD = 8;
/** Elements a swipe never starts from. */
const SWIPE_IGNORE_SELECTOR = "button, a, input, select, textarea, [data-swipe-ignore]";

export type ToastRootProps = Omit<ComponentProps<typeof Div>, "id"> & {
	id?: string;
	/** The toast to render — the readable `ForEach` hands the render function. */
	toast: Readable<ToastData>;
	/** Which swipe direction(s) dismiss the toast. Defaults to `["down", "right"]`. */
	swipeDirection?: SwipeDirection | SwipeDirection[];
};

function toMs(value: string): number {
	const n = parseFloat(value);
	if (Number.isNaN(n)) return 0;
	return value.trim().endsWith("ms") ? n : n * 1000;
}

/** The longest transition or animation currently applying to the element, in ms. */
function exitDurationMs(el: HTMLElement): number {
	const style = getComputedStyle(el);
	const longest = (durations: string, delays: string) => {
		const delayList = delays.split(",");
		return Math.max(
			...durations
				.split(",")
				.map((d, i) => toMs(d) + toMs(delayList[i % delayList.length] ?? "0s")),
			0,
		);
	};
	return Math.max(
		longest(style.transitionDuration, style.transitionDelay),
		longest(style.animationDuration, style.animationDelay),
	);
}

class ToastRootState {
	readonly id: string;
	titleId = signal<Bindable<string> | null>(null);
	descriptionId = signal<Bindable<string> | null>(null);
	swiping = signal(false);
	swipeX = signal(0);
	swipeY = signal(0);
	swipeDirection = signal<SwipeDirection | null>(null);
	private readonly allowed: Set<SwipeDirection>;
	private pointer: { id: number; x: number; y: number } | null = null;
	private suppressClick = false;
	private removeTimer: ReturnType<typeof setTimeout> | null = null;
	private resizeObserver: ResizeObserver | null = null;

	constructor(
		readonly provider: ToastProviderState,
		readonly toast: Readable<ToastData>,
		readonly rootRef: { get(): HTMLDivElement | null },
		swipeDirection: SwipeDirection | SwipeDirection[],
	) {
		this.id = toast.get().id;
		this.allowed = new Set(Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection]);
	}

	get manager() {
		return this.provider.manager;
	}

	get state() {
		return this.toast.bind((t) => (t.ending ? "closed" : "open"));
	}

	/** Position among toasts that aren't leaving; 0 is the frontmost. */
	get index() {
		return derived([this.manager.toasts], (list) => {
			let index = 0;
			for (const t of list) {
				if (t.id === this.id) break;
				if (!t.ending) index++;
			}
			return index;
		});
	}

	/** How far this toast sits from the front of an expanded stack, in px. */
	get offsetY() {
		return derived([this.manager.toasts, this.manager.heights], (list, heights) => {
			let offset = 0;
			for (const t of list) {
				if (t.id === this.id) break;
				if (t.ending) continue;
				offset += (heights.get(t.id) ?? 0) + this.provider.gap;
			}
			return offset;
		});
	}

	get frontmostHeight() {
		return derived([this.manager.toasts, this.manager.heights], (list, heights) => {
			const front = list.find((t) => !t.ending);
			return front ? (heights.get(front.id) ?? 0) : 0;
		});
	}

	get limited() {
		return derived([this.index], (index) => index >= this.manager.options.limit);
	}

	onMount() {
		this.manager.registerRoot(this.id);
		const el = this.rootRef.get();
		if (el) {
			this.manager.heights.set(this.id, el.offsetHeight);
			if (typeof ResizeObserver !== "undefined") {
				this.resizeObserver = new ResizeObserver(() => {
					const node = this.rootRef.get();
					if (node) this.manager.heights.set(this.id, node.offsetHeight);
				});
				this.resizeObserver.observe(el);
			}
		}
	}

	onUnmount() {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.removeTimer !== null) {
			clearTimeout(this.removeTimer);
			this.removeTimer = null;
		}
		this.manager.unregisterRoot(this.id);
	}

	/** Once `ending` flips, wait out the exit transition and drop the toast. */
	scheduleRemove() {
		if (this.removeTimer !== null) return;
		const el = this.rootRef.get();
		const duration = el ? exitDurationMs(el) : 0;
		if (duration <= 0) {
			this.manager.remove(this.id);
			return;
		}
		this.removeTimer = setTimeout(() => this.manager.remove(this.id), duration + 50);
	}

	onPointerdown(e: PointerEvent) {
		if (e.button !== 0 || this.toast.get().ending) return;
		if (e.target instanceof Element && e.target.closest(SWIPE_IGNORE_SELECTOR)) return;
		this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
	}

	onPointermove(e: PointerEvent) {
		if (!this.pointer || e.pointerId !== this.pointer.id) return;
		const dx = this.clampDelta(e.clientX - this.pointer.x, "right", "left");
		const dy = this.clampDelta(e.clientY - this.pointer.y, "down", "up");

		if (!this.swiping.get()) {
			if (Math.hypot(dx, dy) < SWIPE_START_THRESHOLD) return;
			this.swiping.set(true);
			this.rootRef.get()?.setPointerCapture(e.pointerId);
		}

		this.swipeX.set(dx);
		this.swipeY.set(dy);
		this.swipeDirection.set(this.dominantDirection(dx, dy));
	}

	onPointerup(e: PointerEvent) {
		if (!this.pointer || e.pointerId !== this.pointer.id) return;
		this.pointer = null;
		if (!this.swiping.get()) return;

		this.swiping.set(false);
		this.suppressClick = true;
		const dx = this.swipeX.get();
		const dy = this.swipeY.get();
		if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_THRESHOLD) {
			// keep the swipe offset and direction so the exit continues the motion
			this.manager.close(this.id);
			return;
		}
		this.resetSwipe();
	}

	onPointercancel(e: PointerEvent) {
		if (!this.pointer || e.pointerId !== this.pointer.id) return;
		this.pointer = null;
		this.swiping.set(false);
		this.resetSwipe();
	}

	/** A drag that became a swipe must not also click whatever it started on. */
	onClickCapture(e: MouseEvent) {
		if (!this.suppressClick) return;
		this.suppressClick = false;
		e.preventDefault();
		e.stopPropagation();
	}

	onKeydown(e: KeyboardEvent) {
		if (e.key !== "Escape") return;
		e.preventDefault();
		this.manager.close(this.id);
	}

	private clampDelta(delta: number, positive: SwipeDirection, negative: SwipeDirection) {
		if (delta > 0 && this.allowed.has(positive)) return delta;
		if (delta < 0 && this.allowed.has(negative)) return delta;
		return 0;
	}

	private dominantDirection(dx: number, dy: number): SwipeDirection | null {
		if (dx === 0 && dy === 0) return null;
		if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
		return dy > 0 ? "down" : "up";
	}

	private resetSwipe() {
		this.swipeX.set(0);
		this.swipeY.set(0);
		this.swipeDirection.set(null);
	}
}

const ToastRootContext = context<ToastRootState>();

/**
 * One toast. Pass the readable from `ForEach` as `toast`; the root exposes the
 * stacking math as CSS variables and handles swipe-to-dismiss, Escape, and the
 * exit transition (removal waits for the longest transition on the element).
 */
export function Toast(
	{ id, toast, swipeDirection = DEFAULT_SWIPE_DIRECTIONS, ...restProps }: ToastRootProps,
	...children: Child[]
) {
	return ToastProviderContext.Use((provider) => {
		const rootRef = ref<HTMLDivElement>();
		const state = new ToastRootState(provider, toast, rootRef, swipeDirection);

		return ToastRootContext.Provide(state).To(
			Implement.Lifecycle(
				{
					onMount: () => {
						state.onMount();
						return () => state.onUnmount();
					},
				},
				Implement.Watch([toast], (t) => {
					if (t.ending) state.scheduleRemove();
				}),
				Div(
					mergeProps(
						{
							id: id ?? state.id,
							this: rootRef,
							role: "status",
							"aria-atomic": true,
							"aria-live": toast.bind((t) => (t.priority === "high" ? "assertive" : "polite")),
							"aria-labelledby": state.titleId.bind((v) => v ?? undefined),
							"aria-describedby": state.descriptionId.bind((v) => v ?? undefined),
							tabIndex: 0,
							"data-toast-root": "",
							"data-state": state.state,
							"data-type": toast.bind((t) => t.type),
							"data-expanded": provider.expanded.bind(presence),
							"data-behind": state.index.bind((i) => presence(i > 0)),
							"data-limited": state.limited.bind(presence),
							"data-swiping": state.swiping.bind(presence),
							"data-swipe-direction": state.swipeDirection.bind((d) => d ?? undefined),
							style: {
								"--toast-index": state.index.bind(String),
								"--toast-offset-y": state.offsetY.bind((v) => `${v}px`),
								"--toast-height": provider.manager.heights.bind((h) => `${h.get(state.id) ?? 0}px`),
								"--toast-frontmost-height": state.frontmostHeight.bind((v) => `${v}px`),
								"--toast-swipe-movement-x": state.swipeX.bind((v) => `${v}px`),
								"--toast-swipe-movement-y": state.swipeY.bind((v) => `${v}px`),
							},
							onPointerdown: (e: PointerEvent) => state.onPointerdown(e),
							onPointermove: (e: PointerEvent) => state.onPointermove(e),
							onPointerup: (e: PointerEvent) => state.onPointerup(e),
							onPointercancel: (e: PointerEvent) => state.onPointercancel(e),
							onClickCapture: (e: MouseEvent) => state.onClickCapture(e),
							onKeydown: (e: KeyboardEvent) => state.onKeydown(e),
						},
						restProps,
					),
					...children,
				),
			),
		);
	});
}

export type ToastTitleProps = ComponentProps<typeof Div>;

export function ToastTitle({ id = getId(), ...restProps }: ToastTitleProps, ...children: Child[]) {
	return ToastRootContext.Use((rootState) => {
		rootState.titleId.set(id);
		return Div(
			mergeProps(
				{
					id,
					"data-toast-title": "",
					"data-type": rootState.toast.bind((t) => t.type),
				},
				restProps,
			),
			...children,
		);
	});
}

export type ToastDescriptionProps = ComponentProps<typeof Div>;

export function ToastDescription(
	{ id = getId(), ...restProps }: ToastDescriptionProps,
	...children: Child[]
) {
	return ToastRootContext.Use((rootState) => {
		rootState.descriptionId.set(id);
		return Div(
			mergeProps(
				{
					id,
					"data-toast-description": "",
					"data-type": rootState.toast.bind((t) => t.type),
				},
				restProps,
			),
			...children,
		);
	});
}

export type ToastActionProps = ComponentProps<typeof Button>;

/** A button for the toast's action (undo, retry, …). Closes the toast after your `onClick`. */
export function ToastAction(
	{ id = getId(), ...restProps }: ToastActionProps,
	...children: Child[]
) {
	return ToastRootContext.Use((rootState) => {
		return Button(
			mergeProps(
				{
					id,
					type: "button",
					"data-toast-action": "",
					"data-type": rootState.toast.bind((t) => t.type),
					onClick: () => rootState.manager.close(rootState.id),
				},
				restProps,
			),
			...children,
		);
	});
}

export type ToastCloseProps = ComponentProps<typeof Button>;

export function ToastClose({ id = getId(), ...restProps }: ToastCloseProps, ...children: Child[]) {
	return ToastRootContext.Use((rootState) => {
		return Button(
			mergeProps(
				{
					id,
					type: "button",
					"aria-label": "Close notification",
					"data-toast-close": "",
					"data-type": rootState.toast.bind((t) => t.type),
					onClick: () => rootState.manager.close(rootState.id),
				},
				restProps,
			),
			...children,
		);
	});
}

export type ToastPortalProps = PortalProps;

export const ToastPortal = Portal;
