import { isReadable, signal, type Bindable, type Readable, type Signal } from "@implementjs/core";

export type MaybeReadable<T> = T | Readable<T>;

export function getReadableValue<T>(value: MaybeReadable<T>): T {
	if (isReadable(value)) {
		return value.get();
	}
	return value;
}

/**
 * Hold a prop the component only ever reads. `signal()` is the wrong tool for
 * that job: it passes writables through but wraps everything else, so a
 * `derived` or a `.bind()` would end up buried inside a signal rather than
 * being the signal. Anything already readable is kept as it is, and a plain
 * value gets a signal to sit in.
 */
export function toReadable<T>(value: MaybeReadable<T>): Readable<T> {
	return isReadable(value) ? value : signal(value);
}

/**
 * The value bound to a select or menu item. Numbers keep their type on the way
 * in and back out; only the DOM's `data-value` sees their string form.
 */
export type ItemValue = string | number;

/**
 * A signal holding the one value a select or radio group has chosen.
 *
 * `Signal` is invariant in its value, so `Signal<ItemValue | null>` on its own
 * would turn away the `signal<string | null>(…)` callers already hold. Naming
 * each shape keeps those working and adds the number ones beside them.
 */
export type ItemValueSignal =
	| Signal<string | null>
	| Signal<number | null>
	| Signal<ItemValue | null>;

/** The many-values counterpart of {@link ItemValueSignal}, for multi-select and checkbox groups. */
export type ItemValuesSignal = Signal<string[]> | Signal<number[]> | Signal<ItemValue[]>;

export const LIB_PREFIX = "ip";

/** 64 URL safe characters so a byte can be masked into an index without bias. */
const ID_ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

const ID_LENGTH = 4;

/** Generate a unique ID */
export function getId() {
	const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));

	let id = "";
	for (const byte of bytes) {
		id += ID_ALPHABET.charAt(byte & 63);
	}

	return `${LIB_PREFIX}-${id}`;
}

export function noop() {}

/** Resolve a `Bindable` id prop to its current string value. */
export function resolveId(id: Bindable<string>): string | null {
	return typeof id === "string" ? id : (id.get() ?? null);
}
