import { basename as _basename, dirname as _dirname, join, relative, resolve } from "pathe";
import type { AbsolutePath } from "@/utils/types";

/**
 * Join all arguments together and normalize the resulting path.
 *
 * @param p
 * @param paths
 * @returns
 */
export function joinAbsolute(p: AbsolutePath, ...paths: string[]): AbsolutePath {
	return join(p, ...paths) as AbsolutePath;
}

/**
 * Resolve a (possibly relative) path against `cwd`.
 *
 * @param cwd
 * @param p
 * @returns
 */
export function resolveAbsolute(cwd: AbsolutePath, p: string): AbsolutePath {
	return resolve(cwd, p) as AbsolutePath;
}

/**
 * Return the directory name of a path. Similar to the Unix dirname command.
 *
 * @param p
 * @returns
 */
export function dirname(p: AbsolutePath): AbsolutePath {
	return _dirname(p) as AbsolutePath;
}

export function basename(p: AbsolutePath): string {
	return _basename(p);
}

export function relativePath(from: AbsolutePath, to: AbsolutePath): string {
	return relative(from, to);
}

/**
 * The shorter of the two spellings of a path. A relative path reads best right up until it climbs
 * out of a deep directory, where `../../../../../..` helps nobody.
 */
export function shortestPath(from: AbsolutePath, to: AbsolutePath): string {
	const rel = relativePath(from, to);
	if (rel === "") return ".";
	const dotted = rel.startsWith(".") ? rel : `./${rel}`;
	return dotted.length <= to.length ? dotted : to;
}

export function relativeToCwd(cwd: AbsolutePath, p: AbsolutePath): string {
	return relativePath(cwd, p);
}
