/** A single segment of a {@link Path}: an object key or an array index. */
export type PathKey = string | number;

/** Where a field lives in the form input, e.g. `["todos", 0, "label"]`. */
export type Path = readonly PathKey[];

/** A path with at least one segment — every field except the form root. */
export type RequiredPath = readonly [PathKey, ...Path];

/**
 * Paths by the name they were rendered under. A name only has to be turned
 * back into a path for a field the form itself named, so the paths are kept
 * rather than guessed at — `"items.0"` is unambiguous, but an object key that
 * looks like a number would not be.
 */
const pathsByName = new Map<string, Path>();

/**
 * The name a field is addressed by, in the store and as the `name` attribute
 * of its elements — which is also what ties a radio or checkbox group
 * together. Dotted, like `todos.0.label`, so it is a name the DOM, CSS
 * selectors and a form post all handle.
 */
export function pathName(path: Path): string {
	const name = path.join(".");
	if (!pathsByName.has(name)) pathsByName.set(name, path);
	return name;
}

/** The path behind a name, whether the form named it or something else did. */
export function namePath(name: string): Path {
	const known = pathsByName.get(name);
	if (known) return known;
	if (name === "") return [];
	return name.split(".").map((key) => (/^\d+$/.test(key) ? Number(key) : key));
}

/** The name of the form root, whose path is empty. */
export const ROOT_NAME = pathName([]);

/** True when `prefix` is `path` or an ancestor of it. */
export function isPrefix(prefix: Path, path: Path): boolean {
	if (prefix.length > path.length) return false;
	return prefix.every((key, index) => key === path[index]);
}

/** True when either path contains the other, so a field and its ancestors match. */
export function isRelated(a: Path, b: Path): boolean {
	return isPrefix(a, b) || isPrefix(b, a);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads the value at `path`, or `undefined` when any segment is missing. */
export function getAtPath(value: unknown, path: Path): unknown {
	let current = value;
	for (const key of path) {
		if (current == null) return undefined;
		if (Array.isArray(current)) {
			if (typeof key !== "number") return undefined;
			current = current[key];
			continue;
		}
		if (!isPlainObject(current)) return undefined;
		current = current[String(key)];
	}
	return current;
}

/**
 * Returns a copy of `value` with `next` written at `path`. Containers along
 * the way are cloned (never mutated) and created when missing — a numeric key
 * makes an array, anything else an object — so setting a field of an
 * `undefined` object works the same as setting one that is already there.
 */
export function setAtPath(value: unknown, path: Path, next: unknown): unknown {
	if (path.length === 0) return next;
	const [key, ...rest] = path as readonly [PathKey, ...Path];

	if (typeof key === "number") {
		const array = Array.isArray(value) ? [...(value as unknown[])] : [];
		array[key] = setAtPath(array[key], rest, next);
		return array;
	}

	const object = isPlainObject(value) ? { ...value } : {};
	object[key] = setAtPath(object[key], rest, next);
	return object;
}

/**
 * True when a value counts as "not filled in". An untouched text input reads
 * back as `""` and an untouched number input as `NaN`, so neither may look
 * different from the `undefined` a field starts at — otherwise every empty
 * form would report itself dirty.
 */
function isEmptyish(value: unknown): boolean {
	return value == null || value === "" || (typeof value === "number" && Number.isNaN(value));
}

/**
 * Whether `current` differs from the baseline `start`. Objects and arrays are
 * compared field by field so a container reports the state of its subtree.
 */
export function isDirtyInput(start: unknown, current: unknown): boolean {
	if (start === current) return false;
	if (isEmptyish(start) && isEmptyish(current)) return false;
	if (start instanceof Date && current instanceof Date) {
		return start.getTime() !== current.getTime();
	}
	if (Array.isArray(start) && Array.isArray(current)) {
		if (start.length !== current.length) return true;
		return start.some((item, index) => isDirtyInput(item, current[index]));
	}
	if (isPlainObject(start) && isPlainObject(current)) {
		const keys = new Set([...Object.keys(start), ...Object.keys(current)]);
		for (const key of keys) {
			if (isDirtyInput(start[key], current[key])) return true;
		}
		return false;
	}
	return true;
}
