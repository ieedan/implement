import type { Unsubscribe } from "./types";

export type Callback<T> = (value: T) => void;

export type Getter<T, Signals extends readonly Signal<any>[]> = (...values: SignalValues<Signals>) => T;

export type SignalValues<Signals extends readonly Signal<any>[]> = {
    -readonly [K in keyof Signals]: ReturnType<Signals[K]['get']>
}

export function useSubscribe<T, Signals extends readonly Signal<any>[]>(
    signals: readonly [...Signals],
    getter: Getter<T, Signals>
) {
    const values = signals.map((signal) => signal.get()) as SignalValues<Signals>;
    const unsubscribers = signals.map((signal, i) => signal.subscribe((newValue) => {
        const changed = values[i] !== newValue;
        if (!changed) return;
        values[i] = newValue;
        getter(...values)
    }))
    // populate initial value
    getter(...values);

    // unsubscribe
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export class Signal<T> {
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

    notify(value: T) {
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
