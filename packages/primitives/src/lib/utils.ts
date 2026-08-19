import { nanoid } from "nanoid";

/** Generate a unique ID */
export function getId() {
	return nanoid(4);
}
