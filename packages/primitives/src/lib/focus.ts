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

	return [...el.querySelectorAll<HTMLElement>(TABBABLE)];
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

	const focus = (index: number) => {
		e.preventDefault();
		tabbableElements[index]?.focus();
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
