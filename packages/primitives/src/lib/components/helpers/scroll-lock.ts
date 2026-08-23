import { ImplementLifecycle, type Mountable, type Readable } from "@implementjs/core";
import { LIB_PREFIX, noop } from "../../utils";

const SCROLLBAR_WIDTH_VAR = `--${LIB_PREFIX}-scrollbar-width`;

let lockCount = 0;
let originalBodyStyle: string | null = null;
let stopTouchMove: (() => void) | null = null;
/** Where the finger went down, so a move knows which way it is going. */
let touchStart: { x: number; y: number } | null = null;

/** True when `el` is a scroll container with `delta` px still to give along `axis`. */
function hasRoom(el: Element, axis: "x" | "y", delta: number): boolean {
	const style = getComputedStyle(el);
	const overflow = axis === "y" ? style.overflowY : style.overflowX;
	if (overflow !== "auto" && overflow !== "scroll" && overflow !== "overlay") return false;
	const scrollSize = axis === "y" ? el.scrollHeight : el.scrollWidth;
	const clientSize = axis === "y" ? el.clientHeight : el.clientWidth;
	if (scrollSize <= clientSize + 1) return false;
	const position = axis === "y" ? el.scrollTop : el.scrollLeft;
	// a finger moving down reveals what is above it, which needs room at the start
	return delta > 0 ? position > 0 : position + clientSize < scrollSize - 1;
}

/**
 * True when something between the finger and the body still has somewhere to
 * go. The body and the document are deliberately not candidates — the page is
 * the thing being held still.
 */
function touchCanScroll(target: EventTarget | null, dx: number, dy: number): boolean {
	const axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
	const delta = axis === "x" ? dx : dy;
	if (delta === 0) return true;
	for (
		let el: Element | null = target instanceof Element ? target : null;
		el !== null && el !== document.body && el !== document.documentElement;
		el = el.parentElement
	) {
		if (hasRoom(el, axis, delta)) return true;
	}
	return false;
}

function onTouchStart(e: TouchEvent) {
	const touch = e.touches.length === 1 ? e.touches[0] : undefined;
	touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * The page behind a modal has to be held still by hand. `overflow: hidden` on
 * the body does not do it on iOS Safari, and once a scroll gesture is under way
 * the browser stops listening — so the first move of every touch is either let
 * through to something that can scroll, or cancelled outright.
 */
function preventBackgroundTouchMove(e: TouchEvent) {
	if (touchStart === null || e.touches.length > 1 || !e.cancelable) return;
	const touch = e.touches[0];
	if (!touch) return;
	if (touchCanScroll(e.target, touch.clientX - touchStart.x, touch.clientY - touchStart.y)) return;
	e.preventDefault();
}

function restoreBodyStyle() {
	if (originalBodyStyle === null || originalBodyStyle === "") {
		document.body.removeAttribute("style");
	} else {
		document.body.setAttribute("style", originalBodyStyle);
	}
	originalBodyStyle = null;
	stopTouchMove?.();
	stopTouchMove = null;
}

/**
 * Prevents the document from scrolling. Nested callers share one lock; the
 * last unlock restores the body's inline styles as they were before the first.
 */
export function lockBodyScroll(): () => void {
	if (typeof document === "undefined") return noop;

	if (lockCount === 0) {
		originalBodyStyle = document.body.getAttribute("style");

		const htmlStyle = getComputedStyle(document.documentElement);
		const bodyStyle = getComputedStyle(document.body);
		const hasStableGutter =
			htmlStyle.scrollbarGutter?.includes("stable") ||
			bodyStyle.scrollbarGutter?.includes("stable");
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		const rtl = htmlStyle.direction === "rtl" || bodyStyle.direction === "rtl";
		const paddingProp = rtl ? "paddingLeft" : "paddingRight";
		const existingPadding = Number.parseFloat(bodyStyle[paddingProp]) || 0;

		if (scrollbarWidth > 0 && !hasStableGutter) {
			document.body.style[paddingProp] = `${existingPadding + scrollbarWidth}px`;
			document.body.style.setProperty(SCROLLBAR_WIDTH_VAR, `${scrollbarWidth}px`);
		}
		document.body.style.overflow = "hidden";

		// Not gated on sniffing for iOS. The `navigator.platform` test that used to
		// do it is deprecated and already lies about the iPad; on a device where
		// `overflow: hidden` was enough, this listener has nothing left to cancel.
		document.addEventListener("touchstart", onTouchStart, { passive: true });
		document.addEventListener("touchmove", preventBackgroundTouchMove, { passive: false });
		stopTouchMove = () => {
			document.removeEventListener("touchstart", onTouchStart);
			document.removeEventListener("touchmove", preventBackgroundTouchMove);
			touchStart = null;
		};
	}

	lockCount += 1;

	let released = false;
	return () => {
		if (released) return;
		released = true;
		lockCount = Math.max(0, lockCount - 1);
		if (lockCount === 0) restoreBodyStyle();
	};
}

export type ScrollLockProps = {
	open: Readable<boolean>;
	/** When false, the page stays scrollable even while `open` is true. */
	enabled?: boolean;
};

/**
 * Locks document scroll for as long as `open` is true. Pair with a dismissable
 * overlay so the page behind a dialog, select, or popover cannot move.
 */
export function ScrollLock({ open, enabled = true }: ScrollLockProps): Mountable {
	return ImplementLifecycle({
		onMount: () => {
			if (!enabled) return () => {};

			let unlock: (() => void) | null = null;
			const sync = (isOpen: boolean) => {
				if (isOpen) {
					if (unlock === null) unlock = lockBodyScroll();
					return;
				}
				unlock?.();
				unlock = null;
			};

			sync(open.get());
			const unsub = open.onChange(sync);
			return () => {
				unsub();
				unlock?.();
				unlock = null;
			};
		},
	});
}
