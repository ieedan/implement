import { isReadable, type Bindable, type Readable } from "@implementjs/core";
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
	return `${LIB_PREFIX}-${nanoid(4)}`;
}

export function noop() {}

/** Resolve a `Bindable` id prop to its current string value. */
export function resolveId(id: Bindable<string>): string | null {
	return typeof id === "string" ? id : (id.get() ?? null);
}
