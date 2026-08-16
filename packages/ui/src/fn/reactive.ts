/**
 * Function-based reactivity: `signal()` / `computed()` / `effect()` replacing
 * `new Signal()` / `new Derived()` / `watch()`.
 *
 * State lives in closures instead of class fields, dependencies are discovered
 * by running the getter under `subscribeTracked` instead of being listed as a
 * `[signals, getter]` tuple, and anything created during a realization scope
 * (see scope.ts) is disposed automatically when that scope unmounts — which
 * fixes the "Derived subscribes to its sources forever" leak (MISSING.md #10).
 */

import equal from "fast-deep-equal";
import { noteRead, subscribeTracked, type Callback, type Readable, type Writable } from "../signal";
import type { Unsubscribe } from "../types";
import { onCleanup } from "./scope";

/** Same change semantics as `Signal.set` (deep equality; collections by identity). */
function hasChanged<T>(prev: T, next: T): boolean {
	if (prev === next) return false;
	if (prev instanceof Map || prev instanceof Set || next instanceof Map || next instanceof Set) {
		return true;
	}
	return !equal(prev, next);
}

function createSubscribers<T>() {
	let nextId = 0;
	const callbacks = new Map<number, Callback<T>>();
	const notify = (value: T): void => {
		for (const callback of callbacks.values()) callback(value);
	};
	const subscribe = (callback: Callback<T>): Unsubscribe => {
		const id = ++nextId;
		callbacks.set(id, callback);
		return () => callbacks.delete(id);
	};
	return { notify, subscribe };
}

export interface WritableSignal<T> extends Writable<T> {
	update(fn: (current: T) => T): void;
}

/**
 * Closure-based `Signal`. Note what the class version's `this`-typed helpers
 * (`toggle`, `increment`, `push`, …) become in this world: standalone
 * functions over `Writable<T>` (see `toggle` below) — an object literal cannot
 * constrain `this` per method the way a class can.
 */
export function signal<T>(initial: T): WritableSignal<T> {
	let value = initial;
	const subscribers = createSubscribers<T>();

	const self: WritableSignal<T> = {
		get() {
			noteRead(self);
			return value;
		},
		set(next) {
			if (!hasChanged(value, next)) return;
			value = next;
			subscribers.notify(next);
		},
		update(fn) {
			self.set(fn(self.get()));
		},
		subscribe: subscribers.subscribe,
	};
	return self;
}

export function toggle(target: Writable<boolean>): void {
	target.set(!target.get());
}

export function increment(target: Writable<number>, step = 1): void {
	target.set(target.get() + step);
}

/**
 * Auto-tracked derived value: dependencies are whatever the getter reads via
 * `.get()`, re-discovered on every run. Created inside a realization scope it
 * is disposed when that scope unmounts; created at module level it lives
 * forever, exactly like today's `Derived`.
 */
export function computed<T>(getter: () => T): Readable<T> {
	let value!: T;
	let first = true;
	const subscribers = createSubscribers<T>();

	const unsubscribe = subscribeTracked(getter, (next) => {
		if (first) {
			first = false;
			value = next;
			return;
		}
		if (!hasChanged(value, next)) return;
		value = next;
		subscribers.notify(next);
	});
	onCleanup(unsubscribe);

	const self: Readable<T> = {
		get() {
			noteRead(self);
			return value;
		},
		subscribe: subscribers.subscribe,
	};
	return self;
}

/**
 * Auto-tracked side effect; re-runs when anything it read changes. Scope-bound
 * like `computed`, and also returns its disposer for manual control.
 */
export function effect(fn: () => void): Unsubscribe {
	const unsubscribe = subscribeTracked(fn, () => {});
	onCleanup(unsubscribe);
	return unsubscribe;
}
