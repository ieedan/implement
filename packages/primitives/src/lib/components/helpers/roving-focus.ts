import type { Ref } from "@implementjs/core";

export type RovingFocusOptions<T extends HTMLElement = HTMLElement> = {
	/** The group element the candidates live in. */
	root: Ref<T>;
	/** Attribute marking the focusable items, e.g. `"data-radio-group-item"`. */
	candidateAttr: string;
	/** Whether arrow keys wrap from the last item back to the first. */
	loop: boolean;
	/** Which arrow keys move focus: horizontal is Left/Right, vertical is Up/Down. */
	orientation: "horizontal" | "vertical";
	/** Also move on the cross-axis arrows, the way a radio group does. */
	bothAxes?: boolean;
};

/**
 * Arrow-key focus movement for a group of items. Call from an item's keydown;
 * moves focus among the enabled candidates inside the root (disabled items are
 * skipped via `[data-disabled]`). Home and End jump to the ends.
 */
export function handleRovingKeydown<T extends HTMLElement>(
	e: KeyboardEvent,
	opts: RovingFocusOptions<T>,
): void {
	const rootEl = opts.root.get();
	const target = e.target;
	if (!rootEl || !(target instanceof HTMLElement)) return;

	const items = Array.from(
		rootEl.querySelectorAll<HTMLElement>(`[${opts.candidateAttr}]:not([data-disabled])`),
	);
	if (items.length === 0) return;

	const currentIndex = items.indexOf(target);
	if (currentIndex === -1) return;

	const nextKey = opts.orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
	const prevKey = opts.orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";

	const keyToIndex: Record<string, number> = {
		[nextKey]: currentIndex + 1,
		[prevKey]: currentIndex - 1,
		Home: 0,
		End: items.length - 1,
	};

	if (opts.bothAxes) {
		keyToIndex[nextKey === "ArrowDown" ? "ArrowRight" : "ArrowDown"] = currentIndex + 1;
		keyToIndex[prevKey === "ArrowUp" ? "ArrowLeft" : "ArrowUp"] = currentIndex - 1;
	}

	let index = keyToIndex[e.key];
	if (index === undefined) return;
	e.preventDefault();

	if (index < 0) {
		if (!opts.loop) return;
		index = items.length - 1;
	} else if (index >= items.length) {
		if (!opts.loop) return;
		index = 0;
	}

	items[index]?.focus();
}
