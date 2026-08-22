/**
 * The seam hydration is reached through.
 *
 * Mounting has to ask, at every element and every text node, whether a
 * serialized node should be claimed instead of created. Asking that through a
 * direct import would put the whole claim machinery — cursors, the leftover
 * sweep, the mismatch report — into every bundle, including the many apps that
 * never server-render at all. So the question is asked here, of a slot that is
 * empty until something fills it, and `hydrate.ts` is the module that fills it.
 *
 * An app opts in by calling `installHydration()` from `@implementjs/core/hydrate`
 * before its first render; kit's generated client entry does this for every kit
 * app. With the slot empty every accessor below is the answer a fresh mount
 * wants anyway, so nothing branches differently — it simply never asks.
 */

/**
 * Where a pass stopped matching. Recorded at the claim that failed — the only
 * point where both sides are still known: what the client render asked for,
 * what the server left there, and the stack of component frames that got here.
 * By the time `App.render` reports it the pass has moved on, so nothing about
 * the failure is recoverable from the fallback path itself.
 */
export type HydrationMismatch = {
	/** What the client render tried to create. */
	expected: string;
	/** What the server markup had in that position. Development-only. */
	found: string;
	/** Path from the hydration root down to the parent being filled. Development-only. */
	path: string;
	/** The parent whose children diverged, for an inspectable console entry. */
	parent: Node | null;
	/** The serialized node the claim rejected, if there was one. */
	node: Node | null;
	/** Stack from the failing claim: the component frames that built this node. */
	stack: string | undefined;
};

export type HtmlBlock = {
	/** Where the helper's own start comment belongs (first content node, or the end position). */
	before: Node | null;
	/** Where the helper's own end comment belongs (the node after the block). */
	after: Node | null;
};

/** What `hydrate.ts` installs. Every member mirrors the accessor of the same name. */
export type HydrationSupport = {
	begin(root: Element): void;
	end(): HydrationMismatch | null;
	withMountParent<T>(parent: HTMLElement, fn: () => T): T;
	attachAtCursor(parent: HTMLElement, node: Node): boolean;
	claimElement(tag: string): HTMLElement | null;
	claimSvgRoot(): SVGSVGElement | null;
	claimText(data: string): Text | null;
	claimHtmlBlock(): HtmlBlock | null;
	wasClaimed(node: Node): boolean;
	describeMismatch(mismatch: HydrationMismatch): string;
};

let support: HydrationSupport | null = null;

/**
 * True only while a pass is actually claiming nodes.
 *
 * A plain module-level boolean rather than a question put to the installed
 * support, because `dom` reads it once per node created — a hundred thousand
 * times to build ten thousand rows — and a mount that is not hydrating should
 * pay a load and a branch for it, not a call.
 */
let claiming = false;

/** Fill the slot. Called by `installHydration` in `@implementjs/core/hydrate`. */
export function setHydrationSupport(value: HydrationSupport): void {
	support = value;
}

/** Whether anything can hydrate at all — the slot is filled. */
export function canHydrate(): boolean {
	return support !== null;
}

/** Flip the fast flag. `hydrate.ts` owns when this is true. */
export function setClaiming(value: boolean): void {
	claiming = value;
}

export function isHydrating(): boolean {
	return claiming;
}

export function beginHydration(root: Element): void {
	support?.begin(root);
}

export function endHydration(): HydrationMismatch | null {
	return support?.end() ?? null;
}

/** Track the element a mount call is inserting into, so claims know their parent. */
export function withMountParent<T>(parent: HTMLElement, fn: () => T): T {
	return support === null ? fn() : support.withMountParent(parent, fn);
}

export function attachAtCursor(parent: HTMLElement, node: Node): boolean {
	return support?.attachAtCursor(parent, node) ?? false;
}

export function claimElement(tag: string): HTMLElement | null {
	return support?.claimElement(tag) ?? null;
}

export function claimSvgRoot(): SVGSVGElement | null {
	return support?.claimSvgRoot() ?? null;
}

export function claimText(data: string): Text | null {
	return support?.claimText(data) ?? null;
}

export function claimHtmlBlock(): HtmlBlock | null {
	return support?.claimHtmlBlock() ?? null;
}

/** True when `node` was adopted this pass and is already in position. */
export function wasClaimed(node: Node): boolean {
	return support?.wasClaimed(node) ?? false;
}

export function describeMismatch(mismatch: HydrationMismatch): string {
	return (
		support?.describeMismatch(mismatch) ??
		"[implement] hydration mismatch: discarding server-rendered markup and mounting fresh."
	);
}
