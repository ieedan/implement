#!/usr/bin/env node

/**
 * The `implement-kit` CLI. It has one command, `sync`, which writes the
 * generated `.implement/` directory (the entries, the tsconfig apps extend, and
 * a `./$types` per route) without running Vite, for `check` scripts, editors,
 * and the `prepare` lifecycle of a fresh clone, where `tsc` needs the generated
 * files but no dev server or build has produced them.
 *
 * The work itself is {@link sync}, the same function the package exports. What
 * the CLI adds is where the options come from: they live in `vite.config.ts`,
 * inside the `kit()` call, so it loads that config and takes them off the
 * plugin it finds there. Nothing is copied into a second file for the two to
 * fall out of step with.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import type { Plugin, PluginOption, UserConfig } from "vite";
import { sync, type KitPluginApi } from "./sync.ts";

const help = `
  Usage: implement-kit <command> [options]

  Commands:
    sync             Write the generated .implement/ directory

  Options:
    --version, -v    Show version number
    --help, -h       Show this help message

  Sync options:
    --config <file>  Use this vite config instead of the one vite would find
    --mode <mode>    Mode to load the vite config with (default: development)
`;

/**
 * Reports what went wrong the way a CLI should: the message, not a stack out of
 * node's internals.
 */
function fail(message: string): never {
	console.error(`> ${message}`);
	process.exit(1);
}

/**
 * Vite's `plugins` is a tree: arrays nest, entries may be promises, and
 * `false`/`null`/`undefined` are how a config turns one off. `kit()` is itself
 * an array of plugins, so flattening is not optional here.
 */
async function flattenPlugins(option: PluginOption | PluginOption[]): Promise<Plugin[]> {
	const resolved = await option;
	if (resolved === false || resolved === null || resolved === undefined) return [];
	if (Array.isArray(resolved)) {
		return (await Promise.all(resolved.map(flattenPlugins))).flat();
	}
	return [resolved];
}

/** The options the kit plugin published for this CLI, or `null` if it is not one. */
function kitOptions(plugins: Plugin[]): KitPluginApi["options"] | null {
	const api: unknown = plugins.find((plugin) => plugin.name === "implement-kit")?.api;
	if (typeof api !== "object" || api === null || !("options" in api)) return null;
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The plugin publishes its own KitPluginApi on `api`, which vite types as `any`.
	return (api as KitPluginApi).options;
}

/**
 * A `.implement/tsconfig.json` the app can extend, written only when there
 * isn't one yet.
 *
 * Loading the vite config compiles it, which reads the app's `tsconfig.json`,
 * which extends the generated one, so on a fresh clone the run that exists to
 * write that file warns that it is missing. This is the same placeholder dance
 * SvelteKit does: an empty config squelches the warning, and it is swept back
 * up afterwards if it is still empty, which it is whenever the sync failed
 * before writing the real one.
 *
 * It is written relative to the working directory rather than the vite root,
 * because the root is only known once the config it is squelching has loaded.
 * That is right for every invocation from an app directory, and a stray empty
 * file is not something the cleanup can leave behind anyway.
 *
 * @returns the cleanup, a no-op when nothing was written
 */
function placeholderTsconfig(): () => void {
	const dir = ".implement";
	const file = join(dir, "tsconfig.json");
	const placeholder = "{}";
	if (existsSync(file)) return () => {};

	const dirExisted = existsSync(dir);
	mkdirSync(dir, { recursive: true });
	writeFileSync(file, placeholder);

	return () => {
		if (!existsSync(file) || readFileSync(file, "utf8") !== placeholder) return;
		rmSync(file);
		if (!dirExisted && readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
	};
}

async function runSync(options: { config?: string; mode: string }): Promise<void> {
	// vite is a peer dependency, so it is the app's copy that loads the app's config
	const vite = await import("vite").catch(() =>
		fail("Could not load vite. implement-kit reads the kit() options out of your vite config."),
	);

	const cleanup = placeholderTsconfig();
	let loaded: { path: string; config: UserConfig } | null;
	try {
		loaded = await vite.loadConfigFromFile(
			{ command: "serve", mode: options.mode, isSsrBuild: false, isPreview: false },
			options.config,
			undefined,
			"warn",
		);
	} finally {
		cleanup();
	}
	if (loaded === null) {
		fail(
			`No vite config found in ${process.cwd()}. implement-kit reads the kit() options out of it.`,
		);
	}

	const generated = kitOptions(await flattenPlugins(loaded.config.plugins ?? []));
	if (generated === null) {
		fail(
			`${relative(process.cwd(), loaded.path)} does not use the kit() plugin, so there is nothing to sync.`,
		);
	}

	// vite resolves a relative root against the working directory rather than
	// the config file, so this has to as well or the two disagree about where
	// `.implement/` and the routes directory are
	sync(resolve(loaded.config.root ?? "."), generated);
}

const parsed = (() => {
	try {
		return parseArgs({
			options: {
				version: { type: "boolean", short: "v" },
				help: { type: "boolean", short: "h" },
				config: { type: "string" },
				mode: { type: "string", default: "development" },
			},
			allowPositionals: true,
			strict: true,
		});
	} catch (error) {
		console.error(`> ${error instanceof Error ? error.message : String(error)}`);
		console.log(help);
		return process.exit(1);
	}
})();

const { values, positionals } = parsed;
const command = positionals[0];

if (values.version === true) {
	const pkg: unknown = JSON.parse(
		readFileSync(new URL("../package.json", import.meta.url), "utf8"),
	);
	console.log(
		typeof pkg === "object" && pkg !== null && "version" in pkg ? pkg.version : "unknown",
	);
} else if (values.help === true || command === undefined) {
	console.log(help);
} else if (command === "sync") {
	try {
		await runSync({ config: values.config, mode: values.mode });
	} catch (error) {
		if (!(error instanceof Error)) fail(String(error));
		console.error(`> ${error.message}`);
		// the message is the useful part, but the stack is where a config that
		// threw on load actually threw, which is worth keeping
		if (error.stack !== undefined) console.error(error.stack.split("\n").slice(1).join("\n"));
		process.exit(1);
	}
} else {
	console.error(`> Unknown command: ${command}`);
	console.log(help);
	process.exit(1);
}
