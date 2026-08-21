import { err, ok, type Result } from "nevereverthrow";
import {
	AGENTS,
	type Agent,
	detect,
	getUserAgent,
	resolveCommand,
	type ResolvedCommand,
} from "package-manager-detector";
import { InvalidPackageNameError } from "@/utils/errors";
import type { AbsolutePath } from "@/utils/types";

/** Package managers we know how to scaffold for. */
export const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun", "deno"] as const satisfies Agent[];

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const INVALID_NAME_CHARS = /[^a-z0-9\-._~]/;

/**
 * Validate a name for a `package.json`. This is the subset of the npm rules that a scaffolded
 * package can actually break — most of the time the name comes from a directory name.
 *
 * @param name
 * @returns
 */
export function validatePackageName(name: string): Result<string, InvalidPackageNameError> {
	if (name.length === 0) return err(new InvalidPackageNameError(name, "it is empty"));
	if (name.length > 214) return err(new InvalidPackageNameError(name, "it is over 214 characters"));
	if (name.trim() !== name)
		return err(new InvalidPackageNameError(name, "it has leading or trailing whitespace"));

	const scoped = name.startsWith("@");
	const parts = scoped ? name.slice(1).split("/") : [name];
	if (scoped && parts.length !== 2)
		return err(new InvalidPackageNameError(name, "a scoped name looks like @scope/name"));

	for (const part of parts) {
		if (part.length === 0) return err(new InvalidPackageNameError(name, "it has an empty segment"));
		if (part.startsWith(".") || part.startsWith("_"))
			return err(new InvalidPackageNameError(name, "segments cannot start with . or _"));
		if (part !== part.toLowerCase())
			return err(new InvalidPackageNameError(name, "it cannot have capital letters"));
		if (INVALID_NAME_CHARS.test(part))
			return err(new InvalidPackageNameError(name, "it can only contain a-z, 0-9, and - . _ ~"));
	}

	return ok(name);
}

/**
 * Turn a directory name into something a `package.json` will accept, so `create-implement-app "My App"`
 * doesn't dead end on a name the user never typed.
 *
 * @param dir
 * @returns
 */
export function toPackageName(dir: string): string {
	const name = dir
		.trim()
		.toLowerCase()
		.replace(/^[._]+/, "")
		.replace(/[^a-z0-9\-._~]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return name.length > 0 ? name : "implement-app";
}

export async function detectPackageManager(cwd: AbsolutePath): Promise<PackageManager> {
	const detected = (await detect({ cwd }))?.agent;
	const agent = detected ?? AGENTS.find((a) => a === getUserAgent());
	return PACKAGE_MANAGERS.find((pm) => pm === agent) ?? "npm";
}

export function installCommand(pm: PackageManager): ResolvedCommand {
	// every agent we support resolves `install`, the fallback is only here to satisfy the types
	return resolveCommand(pm, "install", []) ?? { command: pm, args: ["install"] };
}

/**
 * Run one of the app's own scripts. Anything after the name is passed through to it, which every
 * agent spells differently — npm needs the `--` separator, deno runs scripts as tasks.
 */
export function runCommand(
	pm: PackageManager,
	script: string,
	args: string[] = [],
): ResolvedCommand {
	return (
		resolveCommand(pm, "run", [script, ...args]) ?? { command: pm, args: ["run", script, ...args] }
	);
}

/** The command a user types to run a script, e.g. `pnpm run dev`. */
export function runCommandString(pm: PackageManager, script: string, args: string[] = []): string {
	const { command, args: resolved } = runCommand(pm, script, args);
	return [command, ...resolved].join(" ");
}
