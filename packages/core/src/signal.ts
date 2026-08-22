import equal from "fast-deep-equal";
import type { Unsubscribe } from "./types";

export type Callback<T> = (value: T) => void;

/** Shared do-nothing unsubscribe, so the dead cases allocate nothing. */
const noop = (): void => {};

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
	// One source is the shape of every binding and most deriveds, and it needs
	// neither of the arrays the general path keeps nor a closure to unsubscribe
	// through — at eight bindings a row, those are the allocations that add up.
	if (signals.length === 1) {
		/* oxlint-disable typescript/no-unsafe-type-assertion -- A one-source getter takes one value; the tuple types cannot express that narrowing. */
		const source = signals[0] as ReadableSource;
		const call = getter as unknown as (value: unknown) => T;
		/* oxlint-enable typescript/no-unsafe-type-assertion */
		let value = source.get();
		const unsubscribe = source.subscribe((next: unknown) => {
			if (next === value) return;
			value = next;
			call(value);
		});
		call(value);
		return unsubscribe;
	}

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

/**
 * Subscriber storage shared by every readable in core. A signal in a mounted
 * tree almost always has exactly one subscriber — one DOM node watching one
 * value — so the single case is held in a field and a `Map` is only allocated
 * once a second subscriber arrives. At ten thousand rows that is tens of
 * thousands of maps never created, and an unsubscribe that is a field write
 * rather than a hash delete.
 */
/**
 * What a notifier hands a value to. A plain callback is the public shape; a
 * `Binding` is the internal one, and it keeps its state in fields so a
 * subscription costs one object rather than a chain of closures.
 */
type Subscriber<T> = Callback<T> | Binding<T>;

abstract class Notifier<T> {
	private single: Subscriber<T> | null = null;
	private singleId = 0;
	private many: Map<number, Subscriber<T>> | null = null;
	private nextId = 0;

	protected get subscriberCount(): number {
		if (this.many !== null) return this.many.size;
		return this.single === null ? 0 : 1;
	}

	/**
	 * Returns the subscription's id rather than a closure to cancel it, so a
	 * caller that has cleanup of its own wraps one closure instead of two. Every
	 * subscription carries an id so one held past a promotion still cancels.
	 */
	/**
	 * Registers a binding without the wrapper closure `subscribe` would add.
	 * Only ever reached through `takesBindings`, which checks that this
	 * notifier's own subscriber table is the one its `subscribe` feeds.
	 */
	attachBinding(binding: Binding<T>): number {
		return this.addSubscriber(binding);
	}

	/** Cancels an `attachBinding` registration by its id. */
	detachBinding(id: number): void {
		this.removeSubscriber(id);
	}

	protected addSubscriber(callback: Subscriber<T>): number {
		const id = ++this.nextId;
		if (this.many === null && this.single === null) {
			this.single = callback;
			this.singleId = id;
		} else {
			if (this.many === null) {
				this.many = new Map();
				if (this.single !== null) this.many.set(this.singleId, this.single);
				this.single = null;
				this.singleId = 0;
			}
			this.many.set(id, callback);
		}
		return id;
	}

	protected removeSubscriber(id: number): void {
		if (this.singleId === id) {
			this.single = null;
			this.singleId = 0;
			return;
		}
		this.many?.delete(id);
	}

	protected clearSubscribers(): void {
		this.single = null;
		this.singleId = 0;
		this.many = null;
	}

	protected notifySubscribers(value: T): void {
		if (this.many === null) {
			const only = this.single;
			if (only !== null) deliver(only, value);
			return;
		}
		// A copy, because a subscriber may unsubscribe while this iterates.
		// oxlint-disable-next-line unicorn/no-useless-spread -- The copy is the point: iterating the live map would skip a subscriber removed mid-notify.
		for (const subscriber of [...this.many.values()]) deliver(subscriber, value);
	}
}

/**
 * Whether a source's own subscriber table is the one its `subscribe` feeds, so
 * a binding registered there will actually be notified. `BoundPath` and
 * `BoundSelector` extend `Signal` but forward `subscribe` to another signal
 * and never notify their own table, so an `instanceof` test would silently
 * drop their updates. Comparing the method itself cannot go stale: a subclass
 * that overrides `subscribe` fails this and takes the callback path.
 */
function takesBindings<T>(source: ReadableSource<T>): source is Notifier<T> & ReadableSource<T> {
	if (!(source instanceof Notifier)) return false;
	// oxlint-disable-next-line typescript/unbound-method -- Compared by identity, never called; that is the whole point of the check.
	const method: unknown = source.subscribe;
	return (
		method === Signal.prototype.subscribe ||
		method === LazyReadable.prototype.subscribe ||
		method === ForwardedSignal.prototype.subscribe
	);
}

function deliver<T>(subscriber: Subscriber<T>, value: T): void {
	if (typeof subscriber === "function") subscriber(value);
	else subscriber.receive(value);
}

/**
 * A subscription that is its own teardown. Going through `subscribe` leaves a
 * getter closure, a change-filtering wrapper, and an unsubscribe closure —
 * three closures and their contexts for every bound prop, which at six
 * bindings a row is most of what a long list retains. A binding keeps the
 * same state in fields on one object instead, and cancels by id.
 */
export abstract class Binding<T> {
	/** Set only when the source could not take a binding directly. */
	private cancel: Unsubscribe | null = null;
	private notifier: Notifier<T> | null = null;
	private id = 0;
	private value!: T;

	/** Reads the source, applies the value, and subscribes for later ones. */
	protected start(source: ReadableSource<T>): void {
		this.value = source.get();
		if (takesBindings(source)) {
			this.notifier = source;
			this.id = source.attachBinding(this);
		} else {
			// Sources outside the notifier hierarchy (reactive collections, views)
			// still take a plain callback; one closure here beats none of the rest.
			this.cancel = source.subscribe((next: T) => this.receive(next));
		}
		this.apply(this.value);
	}

	/** Called by the notifier. Filters unchanged values the way `subscribe` does. */
	receive(next: T): void {
		if (next === this.value) return;
		this.value = next;
		this.apply(next);
	}

	/** Ends the subscription. Safe to call more than once. */
	stop(): void {
		this.notifier?.detachBinding(this.id);
		this.notifier = null;
		this.cancel?.();
		this.cancel = null;
	}

	/** Writes the value wherever this binding points. */
	protected abstract apply(value: T): void;
}

export class Signal<T> extends Notifier<T> implements Writable<T> {
	private value: T;

	constructor(initialValue: T) {
		super();
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
		this.notifySubscribers(value);
	}

	subscribe(callback: Callback<T>): Unsubscribe {
		const id = this.addSubscriber(callback);
		return () => this.removeSubscriber(id);
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
 * `ImplementSet(...)`. Mutators (`add`, `delete`, `clear`, `toggle`) notify
 * subscribers with an immutable snapshot, so it plugs into `derived`, `watch`,
 * bindings, and props like any other readable. Reads on the set itself
 * (`has`, `size`, iteration) are plain non-reactive reads; reactive reads go
 * through `get()` or `bind`.
 *
 * ```ts
 * const selected = ImplementSet<string>();
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
			return new SelectorView(this, keyOrSelector);
		}
		const path = String(keyOrSelector);
		return new Derived([this], (value) => getAtPath(value, path));
	}
}

/**
 * A `Map` that is also a `Readable<ReadonlyMap<K, V>>`, created via
 * `ImplementMap(...)`. Mutators (`set`, `delete`, `clear`) notify subscribers
 * with an immutable snapshot, so it plugs into `derived`, `watch`, bindings,
 * and props like any other readable. `get(key)` is the plain non-reactive
 * `Map` read; `get()` with no arguments is the readable's snapshot read.
 *
 * ```ts
 * const drafts = ImplementMap<string, string>();
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
			return new SelectorView(this, keyOrSelector);
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
abstract class LazyReadable<T> extends Notifier<T> implements Readable<T> {
	protected value!: T;
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
		this.notifySubscribers(value);
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
		if (this.disposed) return noop;
		this.activate();
		const id = this.addSubscriber(callback);
		return () => {
			this.removeSubscriber(id);
			if (this.subscriberCount === 0) this.deactivate();
		};
	}

	// A lazy source only watches its own sources while something is listening,
	// and a binding counts the same as a callback.
	override attachBinding(binding: Binding<T>): number {
		if (this.disposed) return 0;
		this.activate();
		return this.addSubscriber(binding);
	}

	override detachBinding(id: number): void {
		this.removeSubscriber(id);
		if (this.subscriberCount === 0) this.deactivate();
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
		this.clearSubscribers();
	}
}

export class Derived<T, Signals extends readonly Readable<any>[]> extends LazyReadable<T> {
	/**
	 * The lone source when there is one, which is the shape of every binding and
	 * most deriveds. Held here so reading does not walk the tuple, and typed
	 * loosely because the tuple cannot express "exactly one".
	 */
	private readonly only: ReadableSource | null;

	constructor(
		private readonly signals: readonly [...Signals],
		private readonly getter: Getter<T, Signals>,
	) {
		super();
		this.only = signals.length === 1 ? (signals[0] ?? null) : null;
		this.value = this.read();
	}

	/* oxlint-disable typescript/no-unsafe-type-assertion -- Tuple typing cannot express "this getter takes exactly one value". */
	protected read(): T {
		if (this.only !== null) {
			return (this.getter as unknown as (value: unknown) => T)(this.only.get());
		}
		const values = this.signals.map((signal) => signal.get()) as SignalValues<Signals>;
		return this.getter(...values);
	}

	protected watch(onValue: (value: T) => void): Unsubscribe {
		if (this.only !== null) {
			const call = this.getter as unknown as (value: unknown) => T;
			// `this.signals` as-is: wrapping the one source in a fresh array would
			// allocate once per derived, which is the opposite of the point.
			const forward = ((value: unknown) => onValue(call(value))) as unknown as Getter<
				void,
				Signals
			>;
			return subscribe(this.signals, forward);
		}
		return subscribe(this.signals, (...values) => onValue(this.getter(...values)));
	}
	/* oxlint-enable typescript/no-unsafe-type-assertion */
}

/**
 * A selector view of a readable, computed on demand instead of cached behind a
 * subscription of its own. Where a `Derived` carries a cached value, a notifier,
 * activate/deactivate machinery and a forwarding closure per subscriber, this
 * carries a source and a selector — the same shape `BoundPath` uses for path
 * binds, which measures at roughly a third of a derived's retained bytes. It
 * matters because a list row builds one of these per reactive position.
 *
 * A selector result that is itself a readable is followed and unwrapped, the
 * same as before, but nothing for following is allocated unless one turns up.
 */
/**
 * `bind(selector)` without a write-back. Lazy like any other derived: it
 * watches its source once, for as long as something is listening, and
 * notifies its own subscribers — so a selector read by several bindings holds
 * one subscription rather than one per reader, and bound props can register
 * directly instead of through a callback.
 */
class SelectorView<T, U> extends LazyReadable<Unwrapped<U>> {
	/** Subscriptions to readables the selector returned, allocated only if the
	 * selector ever returns one. */
	private inner: Unsubscribe[] | null = null;

	constructor(
		private readonly source: ReadableSource<T>,
		private readonly selector: (value: T) => U,
	) {
		super();
	}

	protected read(): Unwrapped<U> {
		let value: unknown = this.selector(this.source.get());
		while (isReadable(value)) value = value.get();
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Unwrapping stops at the innermost plain value.
		return value as Unwrapped<U>;
	}

	private clearFrom(depth: number): void {
		const list = this.inner;
		if (list === null) return;
		while (list.length > depth) list.pop()!();
	}

	/**
	 * `value` came from the readable at `depth - 1` (or the selector when depth
	 * is 0), so every subscription at or below `depth` is stale.
	 */
	private follow(value: unknown, depth: number, onValue: (value: Unwrapped<U>) => void): unknown {
		this.clearFrom(depth);
		while (isReadable(value)) {
			const readable = value;
			const list = (this.inner ??= []);
			const nextDepth = list.length + 1;
			list.push(
				readable.subscribe((next) => {
					const settled = this.follow(next, nextDepth, onValue);
					// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- follow() terminates at a plain value.
					onValue(settled as Unwrapped<U>);
				}),
			);
			value = readable.get();
		}
		return value;
	}

	protected watch(onValue: (value: Unwrapped<U>) => void): Unsubscribe {
		const raw: unknown = this.selector(this.source.get());
		// A selector returning a plain value — nearly all of them — needs none of
		// the nesting bookkeeping, so it never allocates the list.
		if (isReadable(raw)) this.follow(raw, 0, onValue);

		const unsubscribe = this.source.subscribe(() => {
			const next: unknown = this.selector(this.source.get());
			const settled =
				this.inner === null && !isReadable(next) ? next : this.follow(next, 0, onValue);
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- follow() terminates at a plain value.
			onValue(settled as Unwrapped<U>);
		});

		return () => {
			unsubscribe();
			this.clearFrom(0);
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
/**
 * A writable that reads through to another signal: `bind(path)` and
 * `bind(selector, update)`. Each one used to give every subscriber its own
 * upstream subscription and its own change filter, so a row with three bound
 * texts held three chains into the same source. This watches the source once,
 * for as long as anything is listening, and notifies its own subscribers —
 * which also lets bound props register directly instead of through a callback.
 */
abstract class ForwardedSignal<T> extends Signal<T> {
	private sourceUnsubscribe: Unsubscribe | null = null;
	private current!: T;

	/** The upstream signal this reads through to. */
	protected abstract origin(): ReadableSource;

	private activate(): void {
		if (this.sourceUnsubscribe !== null) return;
		this.current = this.get();
		this.sourceUnsubscribe = this.origin().subscribe(() => {
			const next = this.get();
			if (!hasChanged(this.current, next)) return;
			this.current = next;
			this.notifySubscribers(next);
		});
	}

	private deactivate(): void {
		this.sourceUnsubscribe?.();
		this.sourceUnsubscribe = null;
	}

	override subscribe(callback: Callback<T>): Unsubscribe {
		this.activate();
		const id = this.addSubscriber(callback);
		return () => {
			this.removeSubscriber(id);
			if (this.subscriberCount === 0) this.deactivate();
		};
	}

	override attachBinding(binding: Binding<T>): number {
		this.activate();
		return this.addSubscriber(binding);
	}

	override detachBinding(id: number): void {
		this.removeSubscriber(id);
		if (this.subscriberCount === 0) this.deactivate();
	}
}

class BoundPath<T> extends ForwardedSignal<unknown> {
	constructor(
		private readonly source: Writable<T>,
		private readonly path: string,
	) {
		super(getAtPath(source.get(), path));
	}

	protected origin(): ReadableSource {
		return this.source;
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

	onChange(callback: ChangeCallback<unknown>): Unsubscribe {
		return bindOnChange(this.get(), (cb) => this.subscribe(cb), callback);
	}
}

class BoundSelector<T, U> extends ForwardedSignal<U> {
	constructor(
		private readonly source: Writable<T>,
		private readonly selector: (value: T) => U,
		private readonly writeBack: BindUpdate<T, U>,
	) {
		super(selector(source.get()));
	}

	protected origin(): ReadableSource {
		return this.source;
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
		return new SelectorView(source, keyOrSelector);
	}
	const path = String(keyOrSelector);
	if (isWritable<T>(source)) {
		return new BoundPath(source, path);
	}
	return new Derived([source], (value) => getAtPath(value, path));
}
