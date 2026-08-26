import type { Unsubscribe } from "../types";

export interface IMountable {
	mount: (parent: HTMLElement) => void;
	unmount: () => void;
	getFirstDomNode: () => Node | null;
}

export type Mountable = () => IMountable;

/** Static text, or a readable that updates a text node. */
export type PrimitiveChild = string | number | boolean | null | undefined;

/**
 * A readable child is the text-node shape: it renders the value as text and
 * follows it. A readable holding a *node* is not this — passing one stringifies
 * the node — so reach for `Dynamic`, which mounts whatever node its source
 * holds.
 *
 * ```ts
 * Span({}, Dynamic([priority], (p) => PRIORITIES[p].icon()));
 * ```
 *
 * @see {@link Dynamic}
 */
export type ReadableChild = {
	get(): PrimitiveChild;
	subscribe(callback: (value: PrimitiveChild) => void): Unsubscribe;
};

/**
 * Anything an element accepts as a child: a mountable, text, or a readable of
 * text. A readable of a *node* goes through `Dynamic` rather than in here.
 *
 * @see {@link Dynamic}
 */
export type Child = Mountable | PrimitiveChild | ReadableChild;
