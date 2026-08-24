import { dom, withInsertionAnchor } from "../../dom";
import {
	isReadable,
	isWritable,
	Signal,
	signal,
	subscribe,
	type Readable,
	type Writable,
} from "../../signal";
import { asParent, beginDetach, endDetach, guarded, mountChild, isDetaching } from "../../tree";
import type { Unsubscribe } from "../../types";
import { precedes, removeRange, syncDomOrder } from "../../utils";
import { placeRegionEnd } from "./region";
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
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Static item lists are passed through when not wrapped in a signal.
		isReadable<T[]>(items) ? items.get() : (items as readonly T[]);

	return () => {
		let parent: HTMLElement | null = null;
		let unsubscribe: Unsubscribe | null = null;
		const rendered: Map<string, RenderedEntry<T>> = new Map();
		const endMarker = dom.createComment("");

		let node: IMountable;

		const reconcile = () => {
			if (!parent) return;

			asParent(node, () => {
				const value = getItems();
				const mountedKeys = new Map<string, number>();
				const ordered: IMountable[] = [];

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
					const existing = rendered.get(key);
					if (existing) {
						existing.item.sync(currentVal);
						existing.index.set(i);
						ordered.push(existing.instance);
						continue;
					}

					const writeBack = isWritable<T[]>(items)
						? (value: T) => writeListItem(items, getKey, key, value, createdAt)
						: null;
					const item = new ForEachItem<T>(currentVal, writeBack);
					const index = signal(i);
					const instance = render(item, index)();
					// Mounted against the end marker, so a fresh list arrives in order
					// and the reordering pass below has nothing left to do.
					withInsertionAnchor(endMarker, () => {
						mountChild(instance, parent!);
					});
					rendered.set(key, { instance, item, index });
					ordered.push(instance);
				}

				// Clearing the whole list is the common bulk case, and it does not
				// need one `removeChild` per row: every node between the first row
				// and the end marker is going, so one range deletion takes them all.
				// `beginDetach` is what lets each row skip its own removal — without
				// it they would each pay for a removal this pass then undoes.
				const clearingAll = mountedKeys.size === 0 && rendered.size > 0;
				let bulkStart: Node | null = null;
				if (clearingAll) {
					for (const { instance } of rendered.values()) {
						const first = instance.getFirstDomNode();
						if (first !== null && (bulkStart === null || precedes(first, bulkStart))) {
							bulkStart = first;
						}
					}
				}

				if (bulkStart !== null) beginDetach();
				try {
					for (const [key, { instance }] of rendered.entries()) {
						if (!mountedKeys.has(key)) {
							instance.unmount();
							rendered.delete(key);
						}
					}
				} finally {
					if (bulkStart !== null) endDetach();
				}
				if (bulkStart !== null) removeRange(bulkStart, endMarker);

				// A replay claimed the rows where they stand, which is behind the
				// marker the mount put in at the claim cursor. Moving the marker past
				// them is what the pass below would otherwise do row by row — and it
				// cannot do it at all for a row that owns more than its first node.
				placeRegionEnd(parent!, endMarker);
				syncDomOrder(
					parent!,
					ordered
						.map((child) => child.getFirstDomNode())
						.filter((childNode): childNode is Node => childNode !== null),
					endMarker,
				);
			});
		};

		node = {
			mount(p: HTMLElement) {
				unsubscribe?.();
				for (const { instance } of rendered.values()) {
					instance.unmount();
				}
				rendered.clear();

				parent = p;
				dom.attach(parent, endMarker);
				unsubscribe = subscribe(signals, () => guarded(node, reconcile));
			},
			unmount() {
				unsubscribe?.();
				unsubscribe = null;
				for (const { instance } of rendered.values()) {
					instance.unmount();
				}
				rendered.clear();
				if (!isDetaching()) endMarker.remove();
				parent = null;
			},
			getFirstDomNode() {
				let first: RenderedEntry<T> | null = null;
				for (const entry of rendered.values()) {
					if (!first || entry.index.get() < first.index.get()) first = entry;
				}
				return first?.instance.getFirstDomNode() ?? (endMarker.isConnected ? endMarker : null);
			},
		};
		return node;
	};
}
