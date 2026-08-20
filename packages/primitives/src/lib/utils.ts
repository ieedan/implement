import { isReadable, type Readable } from "@implementjs/core";
import { nanoid } from "nanoid";

export type MaybeReadable<T> = T | Readable<T>;

export function getReadableValue<T>(value: MaybeReadable<T>): T {
	if (isReadable(value)) {
		return value.get();
	}
	return value;
}

export const LIB_PREFIX = "ip";

/** Generate a unique ID */
export function getId() {
	return nanoid(4);
}

export function noop() {}
