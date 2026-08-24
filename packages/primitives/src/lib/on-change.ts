import { Fragment, ImplementEffect, type Child, type Readable } from "@implementjs/core";

/** What a primitive hands its `on*Change` prop when a bound value moves. */
export type ChangeHandler<T> = (value: T) => void;

/**
 * The children behind a primitive's `on*Change` prop: an effect that reports
 * every later change to `source`, and nothing at all when the prop was left
 * off, so the common case costs no node.
 *
 * The handler follows the value rather than the writes. A primitive moves a
 * bound signal from a dozen places — a click, a key, a dismiss, a close from
 * the layer above — and an outside write to a signal the caller passed in is
 * one more; watching the signal itself reports all of them without every
 * mutation site having to remember to.
 *
 * Spread it into the primitive's own children so the subscription lives
 * exactly as long as the primitive is mounted:
 *
 * ```ts
 * Ctx.Provide(state).To(
 * 	...changeEffect(state.open, onOpenChange),
 * 	Div({ ... }, ...children),
 * );
 * ```
 */
export function changeEffect<T>(
	source: Readable<T>,
	handler: ChangeHandler<T> | undefined,
): Child[] {
	if (handler === undefined) return [];
	return [ImplementEffect([source], (value) => handler(value), { immediate: false })];
}

/**
 * {@link changeEffect} for a primitive that renders one node and has no
 * children list to spread into. Without a handler it returns that node
 * untouched, so the wrapper only exists for the callers that asked for one.
 */
export function withChangeEffect<T>(
	node: Child,
	source: Readable<T>,
	handler: ChangeHandler<T> | undefined,
): Child {
	if (handler === undefined) return node;
	return Fragment(...changeEffect(source, handler), node);
}
