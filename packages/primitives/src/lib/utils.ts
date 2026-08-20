import { nanoid } from "nanoid";

export const LIB_PREFIX = "ip";

/** Generate a unique ID */
export function getId() {
	return nanoid(4);
}

export function noop() {}
