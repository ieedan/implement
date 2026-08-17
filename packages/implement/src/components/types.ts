import type { Unsubscribe } from "../types";

export interface IMountable {
	mount: (parent: HTMLElement) => void;
	unmount: () => void;
	getFirstDomNode: () => Node | null;
}

export type Mountable = () => IMountable;

/** Static text, or a readable that updates a text node. */
export type PrimitiveChild = string | number | boolean | null | undefined;

export type ReadableChild = {
	get(): PrimitiveChild;
	subscribe(callback: (value: PrimitiveChild) => void): Unsubscribe;
};

export type Child = Mountable | PrimitiveChild | ReadableChild;
