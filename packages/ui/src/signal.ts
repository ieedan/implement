import equal from "fast-deep-equal";
import type { Unsubscribe } from "./types";

export type Callback<T> = (value: T) => void;

/** True when `next` should replace `prev` and notify subscribers. */
function hasChanged<T>(prev: T, next: T): boolean {
	if (prev === next) return false;
	// fast-deep-equal treats Map/Set as empty objects, so a new collection is always a change
	if (prev instanceof Map || prev instanceof Set || next instanceof Map || next instanceof Set) {
		return true;
	}
	return !equal(prev, next);
}

export type Getter<T, Signals extends readonly Readable<any>[]> = (
	...values: SignalValues<Signals>
) => T;

export type SignalValues<Signals extends readonly Readable<any>[]> = {
	-readonly [K in keyof Signals]: ReturnType<Signals[K]["get"]>;
};

export function subscribe<T, Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<T, Signals>,
) {
	const values = signals.map((signal) => signal.get()) as SignalValues<Signals>;
	const unsubscribers = signals.map((signal, i) =>
		signal.subscribe((newValue) => {
			const changed = values[i] !== newValue;
			if (!changed) return;
			values[i] = newValue;
			getter(...values);
		}),
	);
	// populate initial value
	getter(...values);

	// unsubscribe
	return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export function watch<Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<void, Signals>,
) {
	return subscribe(signals, getter);
}

export interface Writable<T> {
	get(): T;
	set(value: T): void;
	subscribe(callback: Callback<T>): Unsubscribe;
}

export interface Readable<T> {
	get(): T;
	subscribe(callback: Callback<T>): Unsubscribe;
}

export function isReadable<T = unknown>(value: unknown): value is Readable<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		"get" in value &&
		"subscribe" in value &&
		typeof value.get === "function" &&
		typeof value.subscribe === "function"
	);
}

export function isWritable<T = unknown>(value: unknown): value is Writable<T> {
	return isReadable<T>(value) && "set" in value && typeof value.set === "function";
}

let activeTracker: Set<Readable<unknown>> | null = null;

function noteRead(readable: Readable<unknown>) {
	activeTracker?.add(readable);
}

/** Subscribe to every Readable that `getter` reads via `.get()`. */
export function subscribeTracked<T>(getter: () => T, callback: (value: T) => void): Unsubscribe {
	const current = new Map<Readable<unknown>, Unsubscribe>();
	let disposed = false;

	const run = () => {
		if (disposed) return;

		const tracker = new Set<Readable<unknown>>();
		const prev = activeTracker;
		activeTracker = tracker;
		let value: T;
		try {
			value = getter();
		} finally {
			activeTracker = prev;
		}

		for (const dep of tracker) {
			if (!current.has(dep)) {
				current.set(dep, dep.subscribe(run));
			}
		}
		for (const [dep, unsub] of current) {
			if (!tracker.has(dep)) {
				unsub();
				current.delete(dep);
			}
		}

		callback(value);
	};

	run();

	return () => {
		disposed = true;
		for (const unsub of current.values()) unsub();
		current.clear();
	};
}

export class Signal<T> implements Writable<T> {
	private value: T;
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<T>> = new Map();

	constructor(initialValue: T) {
		this.value = initialValue;
	}

	get() {
		noteRead(this);
		return this.value;
	}

	set(value: T) {
		if (!hasChanged(this.value, value)) return;
		this.value = value;
		this.notify(value);
	}

	update(fn: (current: T) => T) {
		this.set(fn(this.get()));
	}

	toggle(this: Signal<boolean>) {
		this.update((value) => !value);
	}

	increment(this: Signal<number>, step = 1) {
		this.update((value) => value + step);
	}

	decrement(this: Signal<number>, step = 1) {
		this.update((value) => value - step);
	}

	push<Item>(this: Signal<Item[]>, ...items: Item[]): number {
		const next = [...this.get(), ...items];
		this.set(next);
		return next.length;
	}

	pop<Item>(this: Signal<Item[]>): Item | undefined {
		const current = this.get();
		if (current.length === 0) return undefined;
		this.set(current.slice(0, -1));
		return current[current.length - 1];
	}

	unshift<Item>(this: Signal<Item[]>, ...items: Item[]): number {
		const next = [...items, ...this.get()];
		this.set(next);
		return next.length;
	}

	shift<Item>(this: Signal<Item[]>): Item | undefined {
		const current = this.get();
		if (current.length === 0) return undefined;
		const [first, ...rest] = current;
		this.set(rest);
		return first;
	}

	splice<Item>(
		this: Signal<Item[]>,
		start: number,
		deleteCount?: number,
		...items: Item[]
	): Item[] {
		const next = this.get().slice();
		const deleted =
			deleteCount === undefined && items.length === 0
				? next.splice(start)
				: next.splice(start, deleteCount ?? 0, ...items);
		this.set(next);
		return deleted;
	}

	private notify(value: T) {
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(value);
		}
	}

	subscribe(callback: Callback<T>): Unsubscribe {
		const id = ++this.subscriberId;
		this.subscribers.set(id, callback);
		return () => this.subscribers.delete(id);
	}
}

/** Each property of `T` exposed as its own `Readable`. */
export type PropertySignals<T> = {
	readonly [K in keyof T]-?: Readable<T[K]>;
};

/**
 * Reactive property access for an object Readable: reading `issue.status` off
 * the returned proxy gives a `Readable` of that property, usable anywhere a
 * Readable is accepted — instead of `new Derived([entry], ([issue]) => issue.status)`.
 *
 * The optional `pick` narrows the source first (e.g. a ForEach entry tuple):
 *
 * ```ts
 * const issue = properties(entry, ([issue]) => issue);
 * Span().content(issue.title);
 * If([issue.commentCount], (count) => count > 0);
 * ```
 *
 * Property Readables are created lazily and cached per key, and only notify
 * when that property's value actually changes (same equality guard as
 * `Derived`). Like any `Derived`, each one stays subscribed to the source for
 * the source's lifetime.
 */
export function properties<T extends object>(source: Readable<T>): PropertySignals<T>;
export function properties<T, U extends object>(
	source: Readable<T>,
	pick: (value: T) => U,
): PropertySignals<U>;
export function properties(
	source: Readable<any>,
	pick?: (value: any) => any,
): PropertySignals<any> {
	const base: Readable<any> = pick ? new Derived([source], pick) : source;
	const cache = new Map<PropertyKey, Readable<unknown>>();
	return new Proxy({} as PropertySignals<any>, {
		get(_, key) {
			let property = cache.get(key);
			if (!property) {
				property = new Derived([base], (value) => value?.[key]);
				cache.set(key, property);
			}
			return property;
		},
	});
}

/** Writable that starts as `null`, for binding a component's element without an initial value. */
export class Ref<T> extends Signal<T | null> {
	constructor() {
		super(null);
	}
}

export class Derived<T, Signals extends readonly Readable<any>[]> implements Readable<T> {
	private value: T;
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<T>> = new Map();

	constructor(signals: readonly [...Signals], getter: Getter<T, Signals>) {
		this.value = getter(...(signals.map((signal) => signal.get()) as SignalValues<Signals>));
		subscribe(signals, (...values) => {
			const next = getter(...values);
			if (!hasChanged(this.value, next)) return;
			this.value = next;
			this.notify(next);
		});
	}

	get() {
		noteRead(this);
		return this.value;
	}

	private notify(value: T) {
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(value);
		}
	}

	subscribe(callback: Callback<T>): Unsubscribe {
		const id = ++this.subscriberId;
		this.subscribers.set(id, callback);
		return () => this.subscribers.delete(id);
	}
}
