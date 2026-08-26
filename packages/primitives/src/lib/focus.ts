/**
 * Whether an element is actually reachable by Tab right now. A selector only
 * knows markup, so on its own it hands back the `display: none` file input
 * behind an attachment button and the search field inside a closed menu —
 * elements the browser will not focus. `getClientRects()` is empty for
 * anything the layout does not draw, including detached subtrees, and unlike
 * `offsetParent` it does not call a `position: fixed` element hidden. `inert`
 * and `hidden` are the two ways a drawn element still refuses focus, so they
 * are asked separately; `inert` is inherited, hence the walk up the tree.
 */
function isReachable(el: HTMLElement) {
	if (el.hasAttribute("hidden")) return false;
	if (el.closest("[inert]") !== null) return false;

	return el.getClientRects().length > 0;
}

/**
 * Get all tabbable elements within an element
 *
 * @param el
 * @returns
 */
export function tabbable(el: HTMLElement) {
	const TABBABLE = [
		"a[href]",
		"button:not([disabled])",
		"input:not([disabled]):not([type=hidden])",
		"select:not([disabled])",
		"textarea:not([disabled])",
		"audio[controls]",
		"video[controls]",
		"[contenteditable]:not([contenteditable=false])",
		"[tabindex]:not([tabindex='-1'])",
		"details > summary:first-of-type",
	].join(",");

	return [...el.querySelectorAll<HTMLElement>(TABBABLE)].filter(isReachable);
}

/**
 * Trap focus within an element
 *
 * @param e
 * @param el
 * @returns
 */
export function trapFocus(e: KeyboardEvent, el: HTMLElement | undefined | null) {
	if (!el) return;
	const tabbableElements = tabbable(el);
	if (tabbableElements.length === 0) return;

	const direction = e.shiftKey ? "previous" : "next";

	/**
	 * Cancelling the keystroke comes last, once focus has moved. Cancelling it
	 * first and then asking an element that turns focus down to take it left
	 * Tab doing nothing at all — a trap with no way out — where falling
	 * through to the browser's own Tab at least keeps the keyboard working.
	 */
	const focus = (index: number) => {
		const target = tabbableElements[index];
		if (!target) return;

		target.focus();
		if (document.activeElement !== target) return;

		e.preventDefault();
	};

	const activeElement = document.activeElement;
	if (activeElement === null) {
		focus(0);
	} else {
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- activeElement is compared against tabbable HTMLElements in this container.
		const activeIndex = tabbableElements.indexOf(activeElement as HTMLElement);
		if (activeIndex === -1) {
			focus(0);
			return;
		}

		if (direction === "previous") {
			if (activeIndex === 0) {
				focus(tabbableElements.length - 1);
				return;
			}
			focus(activeIndex - 1);
		} else {
			if (activeIndex === tabbableElements.length - 1) {
				focus(0);
				return;
			}
			focus(activeIndex + 1);
		}
	}
}

/**
 * Focus the first tabbable element within an element
 *
 * @param el
 * @returns
 */
export function focusFirst(el: HTMLElement | undefined | null) {
	if (!el) return;
	const tabbableElements = tabbable(el);
	if (tabbableElements.length === 0) return;
	tabbableElements[0]?.focus({ preventScroll: true });
}
