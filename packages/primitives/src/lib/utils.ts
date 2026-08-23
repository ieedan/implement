import { isReadable, type Bindable, type Readable } from "@implementjs/core";

export type MaybeReadable<T> = T | Readable<T>;

export function getReadableValue<T>(value: MaybeReadable<T>): T {
	if (isReadable(value)) {
		return value.get();
	}
	return value;
}

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
