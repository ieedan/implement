import { dom } from "../../dom";
import { cancelExit, forceUnmount, removeChild } from "../../exit";
import {
	isReadable,
	isWritable,
	Signal,
	signal,
	subscribe,
	type Readable,
	type Writable,
} from "../../signal";
import { asParent, guarded, mountChild } from "../../tree";
import type { Unsubscribe } from "../../types";
import { syncDomOrder } from "../../utils";
import type { IMountable, Mountable } from "../types";

function stackFrames(stack: string): string {
	const newline = stack.indexOf("\n");
	if (newline === -1) return stack;
	const first = stack.slice(0, newline).trim();
	return first.startsWith("at") ? stack : stack.slice(newline + 1);
}

/** Stack starting at the caller of `skip` (the `ForEach(...)` site in user code). */
function captureCallerStack(skip: (...args: never[]) => unknown): string | undefined {
	const target: { stack?: string } = {};
	const captureStackTrace = (
		Error as typeof Error & {
			captureStackTrace?: (target: object, constructorOpt?: (...args: never[]) => unknown) => void;
		}
	).captureStackTrace;
	if (typeof captureStackTrace === "function") {
		captureStackTrace(target, skip);
		return target.stack;
	}

	const stack = new Error().stack;
	if (!stack) return undefined;
	return stack
		.split("\n")
		.filter(
			(line, i) =>
				i > 0 && !line.includes("helpers/foreach") && !line.includes("captureCallerStack"),
		)
		.join("\n");
}

function forEachError(message: string, createdAt: string | undefined): Error {
	const error = new Error(message);
	error.name = "ForEachError";
	if (createdAt) {
		const frames = stackFrames(createdAt);
		if (frames) error.stack = `${error.name}: ${error.message}\n${frames}`;
	}
	return error;
}

function resolveKey<T>(
	getKey: ForEachKey<T>,
	item: T,
	index: number,
	createdAt: string | undefined,
): string {
	const key = getKey(item, index);
	if (typeof key !== "string" && typeof key !== "number") {
		throw forEachError(
			`ForEach key getter must return a string or number (got ${key === null ? "null" : typeof key})`,
			createdAt,
		);
	}
	return key.toString();
}

/** Live row when the list itself is writable. */
type ForEachRenderWritable<T> = (item: Signal<T>, index: Readable<number>) => Mountable;

/** Live row when the list is read-only. */
type ForEachRenderReadable<T> = (item: Readable<T>, index: Readable<number>) => Mountable;

type ReadableList<T> = Pick<Readable<T[]>, "get" | "subscribe">;
type WritableList<T> = Pick<Writable<T[]>, "get" | "set" | "subscribe" | "flush">;

/** Derives a stable identity from the list item, like Svelte's `{#each items as item (item.id)}`. */
type ForEachKey<T> = (item: T, index: number) => string | number;

/**
 * Per-row signal. `set`/`flush` write through to the parent list when it is
 * writable. `sync` is for ForEach applying a parent update without echoing it.
 */
class ForEachItem<T> extends Signal<T> {
	constructor(
		initial: T,
		private readonly writeBack: ((value: T) => void) | null,
	) {
		super(initial);
	}

	set(value: T) {
		const prev = this.get();
		super.set(value);
		if (this.writeBack && this.get() !== prev) this.writeBack(this.get());
	}

	flush() {
		super.flush();
		this.writeBack?.(this.get());
	}

	sync(value: T) {
		super.set(value);
	}
}

type RenderedEntry<T> = {
	instance: IMountable;
	item: ForEachItem<T>;
	index: Signal<number>;
};

function writeListItem<T>(
	source: Writable<T[]>,
	getKey: ForEachKey<T>,
	key: string,
	value: T,
	createdAt: string | undefined,
) {
	const prev = source.get();
	const next = prev.slice();
	let found = false;
	for (let i = 0; i < next.length; i++) {
		if (resolveKey(getKey, next[i]!, i, createdAt) === key) {
			next[i] = value;
			found = true;
			break;
		}
	}
	if (!found) return;
	source.set(next);
	if (source.get() === prev) source.flush();
}

/**
 * Renders a list. `getKey` is required so items can be reused and reordered
 * across updates without putting keys on the children themselves.
 * A writable list yields writable items; a readable list or plain array
 * yields readable items.
 */
export function ForEach<T>(
	items: WritableList<T>,
	getKey: ForEachKey<T>,
	render: ForEachRenderWritable<T>,
): Mountable;
export function ForEach<T>(
	items: ReadableList<T> | readonly T[],
	getKey: ForEachKey<T>,
	render: ForEachRenderReadable<T>,
): Mountable;
export function ForEach<T>(
	items: ReadableList<T> | readonly T[],
	getKey: ForEachKey<T>,
	render: ForEachRenderWritable<T>,
): Mountable {
	const createdAt = captureCallerStack(ForEach);

	const signals: readonly Readable<T[]>[] = isReadable<T[]>(items) ? [items] : [];
	const getItems = (): readonly T[] =>
		isReadable<T[]>(items) ? items.get() : (items as readonly T[]);

	return () => {
		let parent: HTMLElement | null = null;
		let unsubscribe: Unsubscribe | null = null;
		const rendered: Map<string, RenderedEntry<T>> = new Map();
		/** Rows animating out, by key: still on screen, no longer in the list. */
		const exiting: Map<string, RenderedEntry<T>> = new Map();
		/** Keys in DOM order after the last pass, exiting rows included. */
		let lastOrder: string[] = [];
		const endMarker = dom.createComment("");

		let node: IMountable;

		const reconcile = () => {
			if (!parent) return;

			asParent(node, () => {
				const value = getItems();
				const mountedKeys = new Map<string, number>();
				const liveKeys: string[] = [];

				for (let i = 0; i < value.length; i++) {
					const currentVal = value[i]!;
					const key = resolveKey(getKey, currentVal, i, createdAt);
					const previous = mountedKeys.get(key);
					if (previous !== undefined) {
						throw forEachError(
							`Duplicate key "${key}" in ForEach at indices ${previous} and ${i}`,
							createdAt,
						);
					}
					mountedKeys.set(key, i);
					liveKeys.push(key);
					const existing = rendered.get(key) ?? revive(key);
					if (existing) {
						existing.item.sync(currentVal);
						existing.index.set(i);
						continue;
					}

					const writeBack = isWritable<T[]>(items)
						? (value: T) => writeListItem(items, getKey, key, value, createdAt)
						: null;
					const item = new ForEachItem<T>(currentVal, writeBack);
					const index = signal(i);
					const instance = render(item, index)();
					mountChild(instance, parent!);
					rendered.set(key, { instance, item, index });
				}

				for (const [key, entry] of rendered.entries()) {
					if (mountedKeys.has(key)) continue;
					rendered.delete(key);
					const deferred = removeChild(entry.instance, () => exiting.delete(key));
					if (deferred) exiting.set(key, entry);
				}

				const order = placeExiting(liveKeys);
				lastOrder = order;
				syncDomOrder(parent!, nodesFor(order), endMarker);
			});
		};

		/**
		 * A key that comes back while its row is still animating out keeps the
		 * row it had: the exit is cancelled and the instance — never unmounted,
		 * so still live — goes back into the list.
		 */
		const revive = (key: string): RenderedEntry<T> | null => {
			const leaving = exiting.get(key);
			if (!leaving) return null;
			exiting.delete(key);
			cancelExit(leaving.instance);
			rendered.set(key, leaving);
			return leaving;
		};

		/**
		 * Splices the exiting rows back into the live order, each one behind the
		 * neighbour it followed before it left. Indices cannot do this — a live
		 * row's index is in the new list's coordinates and an exiting row's in
		 * the old one — so placement follows the previous DOM order instead,
		 * which keeps a leaving row in its slot while the rows around it move.
		 */
		const placeExiting = (liveKeys: string[]): string[] => {
			if (exiting.size === 0) return liveKeys;
			const order = [...liveKeys];
			for (let i = 0; i < lastOrder.length; i++) {
				const key = lastOrder[i]!;
				if (!exiting.has(key) || order.includes(key)) continue;
				let at = 0;
				for (let before = i - 1; before >= 0; before--) {
					const anchor = order.indexOf(lastOrder[before]!);
					if (anchor !== -1) {
						at = anchor + 1;
						break;
					}
				}
				order.splice(at, 0, key);
			}
			return order;
		};

		const nodesFor = (order: readonly string[]): Node[] => {
			const nodes: Node[] = [];
			for (const key of order) {
				const entry = rendered.get(key) ?? exiting.get(key);
				const first = entry?.instance.getFirstDomNode();
				if (first) nodes.push(first);
			}
			return nodes;
		};

		const teardown = () => {
			for (const entry of exiting.values()) forceUnmount(entry.instance);
			exiting.clear();
			lastOrder = [];
			for (const { instance } of rendered.values()) forceUnmount(instance);
			rendered.clear();
		};

		node = {
			mount(p: HTMLElement) {
				unsubscribe?.();
				teardown();

				parent = p;
				dom.attach(parent, endMarker);
				unsubscribe = subscribe(signals, () => guarded(node, reconcile));
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				teardown();
				endMarker.remove();
				parent = null;
			},
			getFirstDomNode() {
				// lastOrder is DOM order, so the first row still on screen — live
				// or leaving — is what logical siblings anchor against
				for (const key of lastOrder) {
					const entry = rendered.get(key) ?? exiting.get(key);
					const first = entry?.instance.getFirstDomNode();
					if (first) return first;
				}
				return endMarker.isConnected ? endMarker : null;
			},
		};
		return node;
	};
}
