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
	// readables compare by identity: two distinct signals may deep-equal now but
	// diverge later, and a flattened bind must re-follow the new instance
	if (isReadable(prev) || isReadable(next)) {
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
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tuple typing: mapped signal values align with getter rest args.
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

/**
 * True when `T` should not be walked for dotted bind paths. Host objects
 * (`EventTarget` covers elements, documents, windows; the CSS object model
 * types are not event targets) are leaves because their types are circular —
 * element → ownerDocument → defaultView → … never terminates.
 */
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
	| EventTarget
	| CSSStyleDeclaration
	| CSSRule
	| StyleSheet
	? true
	: false;

/** `PrevDepth[N]` counts `PathsOf` recursion down toward `never`. */
type PrevDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Depth-bounded so self-referential types (linked lists, trees) terminate
 * instead of overflowing the checker; paths deeper than the bound fall off
 * the union.
 */
type PathsOf<T, Depth extends PrevDepth[number] = 9> = [Depth] extends [never]
	? never
	: T extends object
		? {
				[K in keyof T & string]: PathLeaf<NonNullable<T[K]>> extends true
					? K
					: K | `${K}.${PathsOf<NonNullable<T[K]>, PrevDepth[Depth]>}`;
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

/**
 * Value type of a one-way selector bind after unwrapping nested readables:
 * `Readable<T>` becomes `T` (up to three levels deep — bounded so the checker
 * terminates on self-referential types); plain values pass through.
 * Distributes over unions, so `T | Readable<T>` also becomes `T`.
 */
export type Unwrapped<U> =
	U extends ReadableSource<infer V>
		? V extends ReadableSource<infer W>
			? W extends ReadableSource<infer X>
				? X
				: W
			: V
		: U;

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
	 * One-way derived value. A selector result that is itself a readable is
	 * followed and unwrapped, so selecting a nested signal surfaces its value.
	 * @example
	 * todo.bind((value) => value.title.toUpperCase())
	 */
	bind<U>(selector: (value: T) => U): Readable<Unwrapped<U>>;
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
	bind<P extends BindableKeys<T>>(path: P): Signal<BindPathValue<T, P>>;
	/**
	 * One-way derived value. A selector result that is itself a readable is
	 * followed and unwrapped, so selecting a nested signal surfaces its value.
	 * @example
	 * todo.bind((value) => value.title.toUpperCase())
	 */
	bind<U>(selector: (value: T) => U): Readable<Unwrapped<U>>;
	/**
	 * Two-way derived value. `update` writes `next` back into `prev`.
	 * Return a new parent, or mutate `prev` in place and return nothing.
	 * @example
	 * todo.bind((value) => value.title, (prev, next) => ({ ...prev, title: next }))
	 * @example
	 * todo.bind((value) => value.title, (prev, next) => { prev.title = next })
	 */
	bind<U>(selector: (value: T) => U, update: BindUpdate<T, U>): Signal<U>;
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

	bind<P extends BindableKeys<T>>(path: P): Signal<BindPathValue<T, P>>;
	bind<U>(selector: (value: T) => U): Readable<Unwrapped<U>>;
	bind<U>(selector: (value: T) => U, update: BindUpdate<T, U>): Signal<U>;
	bind(
		keyOrSelector: PropertyKey | ((value: T) => unknown),
		update?: BindUpdate<T, unknown>,
	): Readable<any> | Signal<any> {
		return createBinding(this, keyOrSelector, update);
	}
}

type ExistingWritable<T> = Extract<T, Writable<any>>;
type PlainForSignal<T> = Exclude<T, Writable<any>>;

/**
 * If `T` is already writable, keep those members; wrap everything else in a
 * {@link Signal}. `boolean | Writable<boolean>` becomes `Signal<boolean> |
 * Writable<boolean>`, not `Signal<boolean | Writable<boolean>>`.
 */
type CoercedSignal<T> =
	| ExistingWritable<T>
	| ([PlainForSignal<T>] extends [never] ? never : Signal<PlainForSignal<T>>);

/**
 * Create a writable signal. If `initialValue` is already writable it is
 * returned as-is, so `signal(props.open ?? false)` accepts a boolean or a signal.
 */
export function signal<T>(initialValue: T): CoercedSignal<T> {
	/* oxlint-disable typescript/no-unsafe-type-assertion -- Writable passthrough and plain-value wrapping share one entry point. */
	if (isWritable(initialValue)) return initialValue as CoercedSignal<T>;
	return new Signal(initialValue as PlainForSignal<T>) as CoercedSignal<T>;
	/* oxlint-enable typescript/no-unsafe-type-assertion */
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

/** Create a ref that starts as `null`. Pass to an element's `this` prop. */
export function ref<T>(): Ref<T> {
	return new Ref();
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
	bind<U>(selector: (value: ReadonlySet<T>) => U): Readable<Unwrapped<U>>;
	bind(keyOrSelector: PropertyKey | ((value: ReadonlySet<T>) => unknown)): Readable<unknown> {
		if (typeof keyOrSelector === "function") {
			return new Flattened(new Derived([this], keyOrSelector));
		}
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
	bind<U>(selector: (value: ReadonlyMap<K, V>) => U): Readable<Unwrapped<U>>;
	bind(keyOrSelector: PropertyKey | ((value: ReadonlyMap<K, V>) => unknown)): Readable<unknown> {
		// never route through createBinding: `set(key, value)` duck-types as
		// Writable but is not `Writable.set`
		if (typeof keyOrSelector === "function") {
			return new Flattened(new Derived([this], keyOrSelector));
		}
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
	bind<U>(selector: (value: T) => U): Readable<Unwrapped<U>>;
	bind(keyOrSelector: PropertyKey | ((value: T) => unknown)): Readable<unknown> {
		return createBinding(this, keyOrSelector);
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
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Tuple typing for derived getter inputs.
		const values = this.signals.map((signal) => signal.get()) as SignalValues<Signals>;
		return this.getter(...values);
	}

	protected watch(onValue: (value: T) => void): Unsubscribe {
		return subscribe(this.signals, (...values) => onValue(this.getter(...values)));
	}
}

/**
 * Readable view of `source` with nested readables unwrapped: when the source's
 * value is itself a readable, this follows it (recursively) and surfaces the
 * innermost plain value. Selector binds route through this so
 * `content.bind((c) => c.opts.behavior)` works when `behavior` is a signal.
 */
class Flattened<U> extends LazyReadable<Unwrapped<U>> {
	constructor(private readonly source: ReadableSource<U>) {
		super();
		this.value = this.read();
	}

	protected read(): Unwrapped<U> {
		let value: unknown = this.source.get();
		while (isReadable(value)) value = value.get();
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Unwrapping stops at the innermost plain value.
		return value as Unwrapped<U>;
	}

	protected watch(onValue: (value: Unwrapped<U>) => void): Unsubscribe {
		// one unsubscriber per nested readable; index 0 is the source's own value
		const inner: Unsubscribe[] = [];

		const clearFrom = (depth: number) => {
			while (inner.length > depth) inner.pop()!();
		};

		// `value` was emitted by the readable at `depth - 1` (or the source when
		// depth is 0), so every subscription at or below `depth` is stale
		const follow = (value: unknown, depth: number) => {
			clearFrom(depth);
			while (isReadable(value)) {
				const readable = value;
				const nextDepth = inner.length + 1;
				inner.push(readable.subscribe((next) => follow(next, nextDepth)));
				value = readable.get();
			}
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- follow() terminates when nested readables are exhausted.
			onValue(value as Unwrapped<U>);
		};

		const unsubscribe = this.source.subscribe((value) => follow(value, 0));
		follow(this.source.get(), 0);
		return () => {
			unsubscribe();
			clearFrom(0);
		};
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
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Dotted paths walk plain object keys.
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
		...obj,
		[head]:
			rest.length === 0
				? value
				: // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Immutable update recurses into nested object fields.
					setAtKeys((obj as Record<string, unknown>)[head], rest, value, path),
	};
}

/**
 * Two-way view of a (possibly dotted) path. Extends {@link Signal} so helpers
 * like `toggle` / `push` work; `set` writes an updated parent object so
 * `todo.bind("author.name")` updates the nested field.
 */
class BoundPath<T> extends Signal<unknown> {
	constructor(
		private readonly source: Writable<T>,
		private readonly path: string,
	) {
		super(getAtPath(source.get(), path));
	}

	get(): unknown {
		return getAtPath(this.source.get(), this.path);
	}

	set(value: unknown) {
		const parent = this.source.get();
		if (Object.is(getAtPath(parent, this.path), value)) return;
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- setAtPath preserves the parent object's shape.
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
}

class BoundSelector<T, U> extends Signal<U> {
	constructor(
		private readonly source: Writable<T>,
		private readonly selector: (value: T) => U,
		private readonly writeBack: BindUpdate<T, U>,
	) {
		super(selector(source.get()));
	}

	get(): U {
		return this.selector(this.source.get());
	}

	set(next: U) {
		const prev = this.source.get();
		const result = this.writeBack(prev, next);
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
}

function createBinding<T>(
	source: Readable<T>,
	keyOrSelector: PropertyKey | ((value: T) => unknown),
	update?: BindUpdate<T, unknown>,
): Readable<unknown> | Signal<unknown> {
	if (typeof keyOrSelector === "function") {
		if (update) {
			if (!isWritable<T>(source)) {
				throw new Error("bind(selector, update) requires a writable source");
			}
			return new BoundSelector(source, keyOrSelector, update);
		}
		return new Flattened(new Derived([source], keyOrSelector));
	}
	const path = String(keyOrSelector);
	if (isWritable<T>(source)) {
		return new BoundPath(source, path);
	}
	return new Derived([source], (value) => getAtPath(value, path));
}
