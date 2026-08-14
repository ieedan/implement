import type { Unsubscribe } from "./types";

export type Callback<T> = (value: T) => void;

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
		const changed = this.value !== value;
		if (!changed) return;
		this.value = value;
		this.notify(value);
	}

	toggle(this: Signal<boolean>) {
		this.set(!this.get());
	}

	increment(this: Signal<number>, step = 1) {
		this.set(this.get() + step);
	}

	decrement(this: Signal<number>, step = 1) {
		this.set(this.get() - step);
	}

	private notify(value: T) {
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(value);
		}
	}

	subscribe(callback: Callback<T>): Unsubscribe {
		this.subscriberId++;

		this.subscribers.set(this.subscriberId, callback);

		// unsubscribe
		return () => this.subscribers.delete(this.subscriberId);
	}
}

export class Derived<T, Signals extends readonly Signal<any>[]> implements Readable<T> {
	private value: T;
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<T>> = new Map();

	constructor(signals: readonly [...Signals], getter: Getter<T, Signals>) {
		this.value = getter(...(signals.map((signal) => signal.get()) as SignalValues<Signals>));
		subscribe(signals, (...values) => {
			const next = getter(...values);
			if (this.value === next) return;
			this.value = next;
			this.notify(next);
		});
	}

	get() {
		return this.value;
	}

	private notify(value: T) {
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(value);
		}
	}

	subscribe(callback: Callback<T>): Unsubscribe {
		this.subscriberId++;

		this.subscribers.set(this.subscriberId, callback);

		// unsubscribe
		return () => this.subscribers.delete(this.subscriberId);
	}
}
