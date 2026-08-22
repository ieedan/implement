import { ImplementLifecycle, type Mountable, type Readable } from "@implementjs/core";
import { LIB_PREFIX, noop } from "../../utils";

const SCROLLBAR_WIDTH_VAR = `--${LIB_PREFIX}-scrollbar-width`;

let lockCount = 0;
let originalBodyStyle: string | null = null;
let stopTouchMove: (() => void) | null = null;

/** True on iPhone/iPad, where `overflow: hidden` on body does not stop scroll. */
function isIos(): boolean {
	if (typeof navigator === "undefined") return false;
	return (
		/iP(ad|hone|od)/.test(navigator.platform) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	);
}

function preventBackgroundTouchMove(e: TouchEvent) {
	// inner overlay scrolling still works; this only blocks the page behind
	if (e.target !== document.documentElement) return;
	if (e.touches.length > 1) return;
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

		if (isIos()) {
			document.addEventListener("touchmove", preventBackgroundTouchMove, { passive: false });
			stopTouchMove = () => {
				document.removeEventListener("touchmove", preventBackgroundTouchMove);
			};
		}
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
