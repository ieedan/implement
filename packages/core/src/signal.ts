import equal from "fast-deep-equal";
import type { Unsubscribe } from "./types";

export type Callback<T> = (value: T) => void;

/** Called when a signal's value changes. Does not run with the current value. */
export type ChangeCallback<T> = (value: T, previous: T) => void;

function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		"then" in value &&
		typeof value.then === "function"
	);
}

/** True when `next` should replace `prev` and notify subscribers. */
function hasChanged<T>(prev: T, next: T): boolean {
	if (prev === next) return false;
	// fast-deep-equal treats Map/Set as empty objects, so a new collection is always a change
	if (prev instanceof Map || prev instanceof Set || next instanceof Map || next instanceof Set) {
		return true;
	}
	// promises also deep-equal as empty objects; a distinct promise is always a
	// change or Await could never re-follow a readable promise source
	if (isThenable(prev) || isThenable(next)) {
		return true;
	}
	return !equal(prev, next);
}

/**
 * get/subscribe surface of a readable. `Readable` is invariant because of its
 * `bind` overloads; this shape is covariant, so a readable of a subset still fits.
 */
export type ReadableSource<T = unknown> = {
	get(): T;
	subscribe(callback: (value: any) => void): Unsubscribe;
};

export type Getter<T, Signals extends readonly ReadableSource<any>[]> = (
	...values: SignalValues<Signals>
) => T;

export type SignalValues<Signals extends readonly ReadableSource<any>[]> = {
	-readonly [K in keyof Signals]: ReturnType<Signals[K]["get"]>;
};

export function subscribe<T, Signals extends readonly ReadableSource<any>[]>(
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

export function watch<Signals extends readonly ReadableSource<any>[]>(
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

/** True when `T` should not be walked for dotted bind paths. */
type PathLeaf<T> = T extends
	| string
	| number
	| boolean
	| bigint
	| symbol
	| null
	| undefined
	| Date
	| Map<unknown, unknown>
	| Set<unknown>
	| ((...args: never[]) => unknown)
	| readonly unknown[]
	? true
	: false;

type PathsOf<T> = T extends object
	? {
			[K in keyof T & string]: PathLeaf<NonNullable<T[K]>> extends true
				? K
				: K | `${K}.${PathsOf<NonNullable<T[K]>>}`;
		}[keyof T & string]
	: never;

/** Dotted paths into a plain object, e.g. `"title"` or `"author.name"`. */
export type BindableKeys<T> =
	NonNullable<T> extends readonly unknown[] ? never : PathsOf<NonNullable<T>>;

/** Value at a {@link BindableKeys} path. */
export type BindPathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
	? K extends keyof NonNullable<T>
		? BindPathValue<NonNullable<T>[K], Rest>
		: never
	: P extends keyof NonNullable<T>
		? NonNullable<T>[P]
		: never;

export type BindUpdate<T, U> = (prev: T, next: U) => T | void;

export interface Readable<T> {
	get(): T;
	subscribe(callback: Callback<T>): Unsubscribe;
	/** Subscribe to later updates. Unlike `watch`, this does not run with the current value. */
	onChange(callback: ChangeCallback<T>): Unsubscribe;
	/**
	 * One-way binding of a (possibly dotted) path.
	 * @example
	 * todo.bind("author.name")
	 * // same as: todo.bind((value) => value.author.name)
	 */
	bind<P extends BindableKeys<T>>(path: P): Readable<BindPathValue<T, P>>;
	/**
	 * One-way derived value.
	 * @example
	 * todo.bind((value) => value.title.toUpperCase())
	 */
	bind<U>(selector: (value: T) => U): Readable<U>;
}

export interface Writable<T> extends Readable<T> {
	set(value: T): void;
	/** Notify subscribers of the current value. Used after in-place mutation. */
	flush(): void;
	/**
	 * Two-way binding of a (possibly dotted) path.
	 * @example
	 * todo.bind("author.name")
	 * // same as:
	 * todo.bind(
	 *   (value) => value.author.name,
	 *   (prev, next) => ({ ...prev, author: { ...prev.author, name: next } }),
	 * )
	 */
	bind<P extends BindableKeys<T>>(path: P): Writable<BindPathValue<T, P>>;
	/**
	 * One-way derived value.
	 * @example
	 * todo.bind((value) => value.title.toUpperCase())
	 */
	bind<U>(selector: (value: T) => U): Readable<U>;
	/**
	 * Two-way derived value. `update` writes `next` back into `prev`.
	 * Return a new parent, or mutate `prev` in place and return nothing.
	 * @example
	 * todo.bind((value) => value.title, (prev, next) => ({ ...prev, title: next }))
	 * @example
	 * todo.bind((value) => value.title, (prev, next) => { prev.title = next })
	 */
	bind<U>(selector: (value: T) => U, update: BindUpdate<T, U>): Writable<U>;
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

	flush() {
		this.notify(this.value);
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

	bind<P extends BindableKeys<T>>(path: P): Writable<BindPathValue<T, P>>;
	bind<U>(selector: (value: T) => U): Readable<U>;
	bind<U>(selector: (value: T) => U, update: BindUpdate<T, U>): Writable<U>;
	bind(
		keyOrSelector: PropertyKey | ((value: T) => unknown),
		update?: BindUpdate<T, unknown>,
	): Readable<unknown> | Writable<unknown> {
		return createBinding(this, keyOrSelector, update);
	}
}

/** Create a writable signal. */
export function signal<T>(initialValue: T): Signal<T> {
	return new Signal(initialValue);
}

/**
 * Writable that starts as `null`. Pass to an element's `this` prop to bind
 * the DOM node (`Div({ this: el })`); unmount writes `null` back.
 */
export class Ref<T> extends Signal<T | null> {
	constructor() {
		super(null);
	}
}

/**
 * A `Set` that is also a `Readable<ReadonlySet<T>>`, created via
 * `Implement.Set(...)`. Mutators (`add`, `delete`, `clear`, `toggle`) notify
 * subscribers with an immutable snapshot, so it plugs into `derived`, `watch`,
 * bindings, and props like any other readable. Reads on the set itself
 * (`has`, `size`, iteration) are plain non-reactive reads; reactive reads go
 * through `get()` or `bind`.
 *
 * ```ts
 * const selected = Implement.Set<string>();
 * Button({ onClick: () => selected.toggle(id) });
 * If(selected.bind((s) => s.has(id))).Then(...);
 * ```
 */
export class ReactiveSet<T> extends Set<T> implements Readable<ReadonlySet<T>> {
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<ReadonlySet<T>>> = new Map();
	private snapshot: ReadonlySet<T> | null = null;

	constructor(values?: Iterable<T> | null) {
		// seed through super.add: the overridden add must not run before field
		// initializers have
		super();
		if (values) for (const value of values) super.add(value);
	}

	get(): ReadonlySet<T> {
		return (this.snapshot ??= new Set(this));
	}

	private notify() {
		this.snapshot = null;
		if (this.subscribers.size === 0) return;
		const snapshot = this.get();
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(snapshot);
		}
	}

	add(value: T): this {
		if (super.has(value)) return this;
		super.add(value);
		this.notify();
		return this;
	}

	delete(value: T): boolean {
		const deleted = super.delete(value);
		if (deleted) this.notify();
		return deleted;
	}

	clear(): void {
		if (this.size === 0) return;
		super.clear();
		this.notify();
	}

	/** Adds `value` when absent, deletes it when present. Returns `true` when it ended up in the set. */
	toggle(value: T): boolean {
		if (this.delete(value)) return false;
		this.add(value);
		return true;
	}

	/** Notify subscribers with a fresh snapshot. Used after in-place mutation of a stored object. */
	flush() {
		this.notify();
	}

	subscribe(callback: Callback<ReadonlySet<T>>): Unsubscribe {
		const id = ++this.subscriberId;
		this.subscribers.set(id, callback);
		return () => this.subscribers.delete(id);
	}

	onChange(callback: ChangeCallback<ReadonlySet<T>>): Unsubscribe {
		return bindOnChange(this.get(), (cb) => this.subscribe(cb), callback);
	}

	bind<P extends BindableKeys<ReadonlySet<T>>>(path: P): Readable<BindPathValue<ReadonlySet<T>, P>>;
	bind<U>(selector: (value: ReadonlySet<T>) => U): Readable<U>;
	bind(keyOrSelector: PropertyKey | ((value: ReadonlySet<T>) => unknown)): Readable<unknown> {
		if (typeof keyOrSelector === "function") return new Derived([this], keyOrSelector);
		const path = String(keyOrSelector);
		return new Derived([this], (value) => getAtPath(value, path));
	}
}

/**
 * A `Map` that is also a `Readable<ReadonlyMap<K, V>>`, created via
 * `Implement.Map(...)`. Mutators (`set`, `delete`, `clear`) notify subscribers
 * with an immutable snapshot, so it plugs into `derived`, `watch`, bindings,
 * and props like any other readable. `get(key)` is the plain non-reactive
 * `Map` read; `get()` with no arguments is the readable's snapshot read.
 *
 * ```ts
 * const drafts = Implement.Map<string, string>();
 * Input({ onInput: (ev) => drafts.set(id, ev.currentTarget.value) });
 * Span(drafts.bind((d) => d.get(id) ?? ""));
 * ```
 */
export class ReactiveMap<K, V> extends Map<K, V> implements Readable<ReadonlyMap<K, V>> {
	private subscriberId: number = 0;
	private subscribers: Map<number, Callback<ReadonlyMap<K, V>>> = new Map();
	private snapshot: ReadonlyMap<K, V> | null = null;

	constructor(entries?: Iterable<readonly [K, V]> | null) {
		// seed through super.set: the overridden set must not run before field
		// initializers have
		super();
		if (entries) for (const [key, value] of entries) super.set(key, value);
	}

	// the no-arg overload is last so `ReturnType<this["get"]>` (what
	// `derived`/`subscribe` infer values from) is the snapshot type
	get(key: K): V | undefined;
	get(): ReadonlyMap<K, V>;
	get(...args: [] | [key: K]): ReadonlyMap<K, V> | V | undefined {
		if (args.length === 0) return (this.snapshot ??= new Map(this));
		return super.get(args[0]);
	}

	private notify() {
		this.snapshot = null;
		if (this.subscribers.size === 0) return;
		const snapshot = this.get();
		for (const [_, notifyCallback] of this.subscribers) {
			notifyCallback(snapshot);
		}
	}

	set(key: K, value: V): this {
		if (super.has(key) && Object.is(super.get(key), value)) return this;
		super.set(key, value);
		this.notify();
		return this;
	}

	delete(key: K): boolean {
		const deleted = super.delete(key);
		if (deleted) this.notify();
		return deleted;
	}

	clear(): void {
		if (this.size === 0) return;
		super.clear();
		this.notify();
	}

	/** Notify subscribers with a fresh snapshot. Used after in-place mutation of a stored value. */
	flush() {
		this.notify();
	}

	subscribe(callback: Callback<ReadonlyMap<K, V>>): Unsubscribe {
		const id = ++this.subscriberId;
		this.subscribers.set(id, callback);
		return () => this.subscribers.delete(id);
	}

	onChange(callback: ChangeCallback<ReadonlyMap<K, V>>): Unsubscribe {
		return bindOnChange(this.get(), (cb) => this.subscribe(cb), callback);
	}

	bind<P extends BindableKeys<ReadonlyMap<K, V>>>(
		path: P,
	): Readable<BindPathValue<ReadonlyMap<K, V>, P>>;
	bind<U>(selector: (value: ReadonlyMap<K, V>) => U): Readable<U>;
	bind(keyOrSelector: PropertyKey | ((value: ReadonlyMap<K, V>) => unknown)): Readable<unknown> {
		// never route through createBinding: `set(key, value)` duck-types as
		// Writable but is not `Writable.set`
		if (typeof keyOrSelector === "function") return new Derived([this], keyOrSelector);
		const path = String(keyOrSelector);
		return new Derived([this], (value) => getAtPath(value, path));
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

	bind<P extends BindableKeys<T>>(path: P): Readable<BindPathValue<T, P>>;
	bind<U>(selector: (value: T) => U): Readable<U>;
	bind(keyOrSelector: PropertyKey | ((value: T) => unknown)): Readable<unknown> {
		return createBinding(this, keyOrSelector) as Readable<unknown>;
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

/** Create a readable derived from other signals. */
export function derived<T, Signals extends readonly Readable<any>[]>(
	signals: readonly [...Signals],
	getter: Getter<T, Signals>,
): Derived<T, Signals> {
	return new Derived(signals, getter);
}

function getAtPath(obj: unknown, path: string): unknown {
	let current = obj;
	for (const key of path.split(".")) {
		if (current == null) {
			throw new Error(`Cannot read "${path}" from ${String(current)}`);
		}
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

function setAtPath(obj: unknown, path: string, value: unknown): unknown {
	const keys = path.split(".");
	return setAtKeys(obj, keys, value, path);
}

function setAtKeys(obj: unknown, keys: readonly string[], value: unknown, path: string): unknown {
	if (obj == null || typeof obj !== "object") {
		throw new Error(`Cannot set "${path}" on ${String(obj)}`);
	}
	const head = keys[0];
	if (head === undefined) return value;
	const rest = keys.slice(1);
	if (Array.isArray(obj)) {
		const next = obj.slice();
		const index = Number(head);
		next[index] = rest.length === 0 ? value : setAtKeys(obj[index], rest, value, path);
		return next;
	}
	return {
		...(obj as object),
		[head]:
			rest.length === 0
				? value
				: setAtKeys((obj as Record<string, unknown>)[head], rest, value, path),
	};
}

/**
 * Two-way view of a (possibly dotted) path. `set` writes an updated parent
 * object so `todo.bind("author.name")` updates the nested field.
 */
class BoundPath<T> implements Writable<unknown> {
	constructor(
		private readonly source: Writable<T>,
		private readonly path: string,
	) {}

	get(): unknown {
		return getAtPath(this.source.get(), this.path);
	}

	set(value: unknown) {
		const parent = this.source.get();
		if (Object.is(getAtPath(parent, this.path), value)) return;
		this.source.set(setAtPath(parent, this.path, value) as T);
	}

	flush() {
		this.source.flush();
	}

	subscribe(callback: Callback<unknown>): Unsubscribe {
		let current = this.get();
		return this.source.subscribe(() => {
			const next = this.get();
			if (!hasChanged(current, next)) return;
			current = next;
			callback(next);
		});
	}

	onChange(callback: ChangeCallback<unknown>): Unsubscribe {
		return bindOnChange(this.get(), (cb) => this.subscribe(cb), callback);
	}

	bind<P extends BindableKeys<unknown>>(path: P): Writable<BindPathValue<unknown, P>>;
	bind<U>(selector: (value: unknown) => U): Readable<U>;
	bind<U>(selector: (value: unknown) => U, update: BindUpdate<unknown, U>): Writable<U>;
	bind(
		keyOrSelector: PropertyKey | ((value: unknown) => unknown),
		update?: BindUpdate<unknown, unknown>,
	): Readable<unknown> | Writable<unknown> {
		return createBinding(this, keyOrSelector, update);
	}
}

class BoundSelector<T, U> implements Writable<U> {
	constructor(
		private readonly source: Writable<T>,
		private readonly selector: (value: T) => U,
		private readonly update: BindUpdate<T, U>,
	) {}

	get(): U {
		return this.selector(this.source.get());
	}

	set(next: U) {
		const prev = this.source.get();
		const result = this.update(prev, next);
		if (result !== undefined) {
			this.source.set(result);
			return;
		}
		this.source.flush();
	}

	flush() {
		this.source.flush();
	}

	subscribe(callback: Callback<U>): Unsubscribe {
		let current = this.get();
		return this.source.subscribe(() => {
			const next = this.get();
			if (!hasChanged(current, next)) return;
			current = next;
			callback(next);
		});
	}

	onChange(callback: ChangeCallback<U>): Unsubscribe {
		return bindOnChange(this.get(), (cb) => this.subscribe(cb), callback);
	}

	bind<P extends BindableKeys<U>>(path: P): Writable<BindPathValue<U, P>>;
	bind<V>(selector: (value: U) => V): Readable<V>;
	bind<V>(selector: (value: U) => V, update: BindUpdate<U, V>): Writable<V>;
	bind(
		keyOrSelector: PropertyKey | ((value: U) => unknown),
		update?: BindUpdate<U, unknown>,
	): Readable<unknown> | Writable<unknown> {
		return createBinding(this, keyOrSelector, update);
	}
}

function createBinding<T>(
	source: Readable<T>,
	keyOrSelector: PropertyKey | ((value: T) => unknown),
	update?: BindUpdate<T, unknown>,
): Readable<unknown> | Writable<unknown> {
	if (typeof keyOrSelector === "function") {
		if (update) {
			if (!isWritable<T>(source)) {
				throw new Error("bind(selector, update) requires a writable source");
			}
			return new BoundSelector(source, keyOrSelector, update);
		}
		return new Derived([source], keyOrSelector);
	}
	const path = String(keyOrSelector);
	if (isWritable<T>(source)) {
		return new BoundPath(source, path);
	}
	return new Derived([source], (value) => getAtPath(value, path));
}
