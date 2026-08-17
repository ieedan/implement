import equal from "fast-deep-equal";
import type { Unsubscribe } from "./types";

export type Callback<T> = (value: T) => void;

/** Called when a signal's value changes. Does not run with the current value. */
export type ChangeCallback<T> = (value: T, previous: T) => void;

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

function bindOnChange<T>(
	initial: T,
	subscribeTo: (callback: Callback<T>) => Unsubscribe,
	callback: ChangeCallback<T>,
): Unsubscribe {
	let previous = initial;
	return subscribeTo((value) => {
		const prev = previous;
		previous = value;
		callback(value, prev);
	});
}

export interface Writable<T> {
	get(): T;
	set(value: T): void;
	subscribe(callback: Callback<T>): Unsubscribe;
	/** Subscribe to later updates. Unlike `watch`, this does not run with the current value. */
	onChange(callback: ChangeCallback<T>): Unsubscribe;
}

export interface Readable<T> {
	get(): T;
	subscribe(callback: Callback<T>): Unsubscribe;
	/** Subscribe to later updates. Unlike `watch`, this does not run with the current value. */
	onChange(callback: ChangeCallback<T>): Unsubscribe;
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

export class Signal<T> implements Writable<T> {
	private value: T;
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<T>> = new Map();

	constructor(initialValue: T) {
		this.value = initialValue;
	}

	get() {
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

	onChange(callback: ChangeCallback<T>): Unsubscribe {
		return bindOnChange(this.value, (cb) => this.subscribe(cb), callback);
	}
}

/** Writable that starts as `null`, for binding a component's element without an initial value. */
export class Ref<T> extends Signal<T | null> {
	constructor() {
		super(null);
	}
}

/**
 * Cached readable that watches sources only while it has subscribers (or until
 * {@link dispose}). Creating one inside a per-row factory no longer leaks a
 * source subscription when the row is discarded or unmounted.
 */
abstract class LazyReadable<T> implements Readable<T> {
	protected value!: T;
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<T>> = new Map();
	private sourceUnsubscribe: Unsubscribe | null = null;
	private disposed = false;

	/** Compute the current value without subscribing to sources. */
	protected abstract read(): T;
	/** Subscribe to sources and report each new value, including the current one. */
	protected abstract watch(onValue: (value: T) => void): Unsubscribe;

	get() {
		if (!this.disposed && !this.sourceUnsubscribe) {
			this.value = this.read();
		}
		return this.value;
	}

	private notify(value: T) {
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(value);
		}
	}

	private activate() {
		if (this.sourceUnsubscribe || this.disposed) return;
		this.value = this.read();
		this.sourceUnsubscribe = this.watch((value) => {
			if (!hasChanged(this.value, value)) return;
			this.value = value;
			this.notify(value);
		});
	}

	private deactivate() {
		this.sourceUnsubscribe?.();
		this.sourceUnsubscribe = null;
	}

	subscribe(callback: Callback<T>): Unsubscribe {
		if (this.disposed) return () => {};
		this.activate();
		const id = ++this.subscriberId;
		this.subscribers.set(id, callback);
		return () => {
			this.subscribers.delete(id);
			if (this.subscribers.size === 0) this.deactivate();
		};
	}

	onChange(callback: ChangeCallback<T>): Unsubscribe {
		if (!this.disposed && !this.sourceUnsubscribe) {
			this.value = this.read();
		}
		return bindOnChange(this.value, (cb) => this.subscribe(cb), callback);
	}

	/** Stop watching sources and drop subscribers. Safe to call more than once. */
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.deactivate();
		this.subscribers.clear();
	}
}

export class Derived<T, Signals extends readonly Readable<any>[]> extends LazyReadable<T> {
	constructor(
		private readonly signals: readonly [...Signals],
		private readonly getter: Getter<T, Signals>,
	) {
		super();
		this.value = this.read();
	}

	protected read(): T {
		const values = this.signals.map((signal) => signal.get()) as SignalValues<Signals>;
		return this.getter(...values);
	}

	protected watch(onValue: (value: T) => void): Unsubscribe {
		return subscribe(this.signals, (...values) => onValue(this.getter(...values)));
	}
}
