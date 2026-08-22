import fs from "node:fs";
import { err, ok, type Result } from "nevereverthrow";
import { CreateImplementAppError } from "@/utils/errors";
import { dirname } from "@/utils/path";
import type { AbsolutePath } from "@/utils/types";

/**
 * Write to a file. Automatically creates the directory recursively if it doesn't exist.
 *
 * @param p
 * @param data
 * @returns
 */
export function writeFileSync(
	p: AbsolutePath,
	data: string,
): Result<void, CreateImplementAppError> {
	try {
		const res = mkdirSync(dirname(p));
		if (res.isErr()) return err(res.error);
		fs.writeFileSync(p, data);
		return ok();
	} catch (e) {
		return err(
			new CreateImplementAppError(
				`Failed to write file ${p}: ${e instanceof Error ? e.message : String(e)}`,
				{ suggestion: "Please try again." },
			),
		);
	}
}

export function mkdirSync(p: AbsolutePath): Result<void, CreateImplementAppError> {
	try {
		fs.mkdirSync(p, { recursive: true });
		return ok();
	} catch (e) {
		return err(
			new CreateImplementAppError(
				`Failed to create directory ${p}: ${e instanceof Error ? e.message : String(e)}`,
				{ suggestion: "Please try again." },
			),
		);
	}
}

export function readFileSync(p: AbsolutePath): Result<string, CreateImplementAppError> {
	try {
		return ok(fs.readFileSync(p, "utf8"));
	} catch (e) {
		return err(
			new CreateImplementAppError(
				`Failed to read file ${p}: ${e instanceof Error ? e.message : String(e)}`,
				{ suggestion: "Please try again." },
			),
		);
	}
}

export function readdirSync(p: AbsolutePath): Result<string[], CreateImplementAppError> {
	try {
		return ok(fs.readdirSync(p));
	} catch (e) {
		return err(
			new CreateImplementAppError(
				`Failed to read directory ${p}: ${e instanceof Error ? e.message : String(e)}`,
				{ suggestion: "Please try again." },
			),
		);
	}
}

export function exists(p: AbsolutePath): boolean {
	return fs.existsSync(p);
}

/** Every entry in the directory, ignoring the entries `git init` and editors leave behind. */
export function meaningfulEntries(p: AbsolutePath): Result<string[], CreateImplementAppError> {
	if (!exists(p)) return ok([]);
	const entries = readdirSync(p);
	if (entries.isErr()) return err(entries.error);
	return ok(entries.value.filter((entry) => entry !== ".git" && entry !== ".DS_Store"));
}
