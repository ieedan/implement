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

/** Writable that starts as `null`, for binding a component's element without an initial value. */
export class Ref<T> extends Signal<T | null> {
	constructor() {
		super(null);
	}
}

/**
 * A `Readable` computed from whatever its getter reads — Signals, other
 * Computeds, and `Store` properties are captured automatically, no dependency
 * list needed. The getter re-runs when any dependency changes, and subscribers
 * are notified only when the computed value actually changed (same equality
 * guard as `Derived`).
 *
 * ```ts
 * const open = new Computed(() => store.issues.filter((issue) => issue.status !== "done"));
 * ```
 *
 * Like `Derived`, a Computed stays subscribed to its dependencies for as long
 * as they live.
 */
export class Computed<T> implements Readable<T> {
	private value!: T;
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<T>> = new Map();

	constructor(getter: () => T) {
		let first = true;
		subscribeTracked(getter, (value) => {
			if (!first && !hasChanged(this.value, value)) return;
			first = false;
			this.value = value;
			this.notify(value);
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

// ---------------------------------------------------------------------------
// Reactive stores
// ---------------------------------------------------------------------------

/**
 * One property of one reactive target, as a `Readable` over its live value.
 * These are what tracked reads of store properties register as dependencies.
 */
class PropertyDep implements Readable<unknown> {
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<unknown>> = new Map();
	private target: object;
	private key: PropertyKey;

	constructor(target: object, key: PropertyKey) {
		this.target = target;
		this.key = key;
	}

	get(): unknown {
		return Reflect.get(this.target, this.key);
	}

	notify() {
		const value = this.get();
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(value);
		}
	}

	subscribe(callback: Callback<unknown>): Unsubscribe {
		const id = ++this.subscriberId;
		this.subscribers.set(id, callback);
		return () => this.subscribers.delete(id);
	}
}

const propertyDeps = new WeakMap<object, Map<PropertyKey, PropertyDep>>();
const rawToProxy = new WeakMap<object, object>();
const reactiveProxies = new WeakSet<object>();

function trackedDep(target: object, key: PropertyKey): PropertyDep {
	let deps = propertyDeps.get(target);
	if (!deps) {
		deps = new Map();
		propertyDeps.set(target, deps);
	}
	let dep = deps.get(key);
	if (!dep) {
		dep = new PropertyDep(target, key);
		deps.set(key, dep);
	}
	return dep;
}

function notifyDep(target: object, key: PropertyKey) {
	propertyDeps.get(target)?.get(key)?.notify();
}

/** Only plain objects and arrays are wrapped; Maps, Sets, Dates, DOM nodes, and other class instances pass through untracked. */
function isWrappable(value: object): boolean {
	if (Array.isArray(value)) return true;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function toReactive(value: unknown): unknown {
	if (typeof value !== "object" || value === null) return value;
	if (reactiveProxies.has(value) || !isWrappable(value)) return value;
	return createReactiveProxy(value);
}

const reactiveHandlers: ProxyHandler<object> = {
	get(target, key, receiver) {
		const value = Reflect.get(target, key, receiver);
		if (typeof key === "symbol" || typeof value === "function") return value;
		if (activeTracker) activeTracker.add(trackedDep(target, key));
		return toReactive(value);
	},
	set(target, key, value, receiver) {
		const prev = Reflect.get(target, key, receiver);
		const prevLength = Array.isArray(target) ? target.length : -1;
		const result = Reflect.set(target, key, value, receiver);
		if (!result) return result;
		if (typeof key !== "symbol" && hasChanged(prev, value)) {
			notifyDep(target, key);
		}
		// setting an index past the end grows an array without an explicit
		// length assignment, so length subscribers are notified here
		if (Array.isArray(target) && key !== "length" && target.length !== prevLength) {
			notifyDep(target, "length");
		}
		return result;
	},
	deleteProperty(target, key) {
		const had = Reflect.has(target, key);
		const result = Reflect.deleteProperty(target, key);
		if (result && had && typeof key !== "symbol") {
			notifyDep(target, key);
		}
		return result;
	},
};

function createReactiveProxy<T extends object>(target: T): T {
	const existing = rawToProxy.get(target);
	if (existing) return existing as T;
	const proxy = new Proxy(target, reactiveHandlers);
	rawToProxy.set(target, proxy);
	reactiveProxies.add(proxy);
	return proxy as T;
}

/**
 * Base class for reactive state. An instance of a `Store` subclass is a deep
 * proxy over itself: reading a property inside a tracked context (`Computed`,
 * `subscribeTracked`, or any component binding that takes a plain function)
 * registers a dependency on exactly that property, and assigning to it
 * notifies exactly those dependents. Plain objects and arrays read out of a
 * store are reactive too, so an item pulled from `store.issues` keeps
 * `issue.status` live wherever it's read — no Signals at the call sites.
 *
 * ```ts
 * class AppStore extends Store {
 * 	issues: Issue[] = [];
 * 	get openCount() {
 * 		return this.issues.filter((issue) => issue.status !== "done").length;
 * 	}
 * }
 * const store = new AppStore();
 *
 * Span().content(() => `${store.openCount} open`);
 * store.issues[0].status = "done"; // notifies only what read that field
 * ```
 *
 * Getters compose: reading `store.openCount` tracks the fields the getter
 * itself reads. Mutate nested objects freely — but for structural array
 * changes prefer assigning a new array (`store.issues = [issue, ...store.issues]`)
 * over `unshift`/`splice`, which notify subscribers mid-shift while the array
 * holds intermediate duplicates.
 */
export class Store {
	constructor() {
		// subclass field initializers run against the returned proxy, so every
		// declared field lands on the tracked target
		return createReactiveProxy(this);
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
