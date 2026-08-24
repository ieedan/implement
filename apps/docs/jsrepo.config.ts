import fs from "node:fs";
import path from "node:path";
import { pnpm } from "@jsrepo/pnpm";
import { defineConfig, DEFAULT_PROVIDERS, type RegistryItem } from "jsrepo";
import { repository } from "jsrepo/outputs";
import { fs as filesystem } from "jsrepo/providers";

/**
 * The registry is configured from inside the docs app rather than the workspace root so that it
 * resolves against this project: the `@/` alias its components import `cn` through, and the
 * `package.json` the versions of what they pull in come from, are both here.
 */
const UI_DIR = "src/lib/components/ui";

/** `cn`, the one thing every component shares. A `lib` item, so it lands next to a project's own. */
const LIB_FILE = "src/lib/utils.ts";

/** Where `jsrepo add` puts each type of item, unless the consuming project's config says otherwise. */
const DEFAULT_PATHS = { ui: UI_DIR, lib: "src/lib" };

/**
 * `packages/ui`, which holds no code — only the version line and changelog changesets keeps for
 * this registry, so that `pnpm changeset` lists `@implementjs/ui` under its own name rather than
 * the app that happens to build it.
 */
const VERSION_PACKAGE = "../../packages/ui/package.json";

/**
 * The registry's version, read from {@link VERSION_PACKAGE}.
 *
 * jsrepo.com holds a published version forever, so this is also what decides whether a release has
 * anything to publish: the `Registry` job in `release.yml` publishes when there is no tag for the
 * version found here.
 *
 * jsrepo has a `version: "package"` shorthand for reading a package.json, but it resolves at publish
 * time and lands in the built `registry.json` verbatim — the manifest a checkout is read through
 * would carry the literal string `package` as its version. Reading it here keeps both honest, and
 * it is the wrong package.json anyway: the nearest one is the docs app's.
 */
function registryVersion(cwd: string): string {
	const manifest = path.resolve(cwd, VERSION_PACKAGE);
	const parsed: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
	const { version } = (typeof parsed === "object" && parsed !== null ? parsed : {}) as {
		version?: unknown;
	};
	// a registry without one cannot be published at all, and a build that quietly produced a
	// versionless manifest would only say so on the next release
	if (typeof version !== "string") {
		throw new Error(`No version in ${manifest} to publish the registry as.`);
	}
	return version;
}

/**
 * One item per file in {@link UI_DIR}, plus the `utils` they all import. jsrepo reads the imports
 * itself, so `select` pulling in `dropdown-menu`, `button` pulling in `utils`, and `accordion`
 * installing `@implementjs/lucide`, all fall out of the source rather than being listed here.
 *
 * `utils` is `when-needed`: nobody adds `cn` on purpose, it arrives with the first component that
 * imports it.
 */
function items(cwd: string): RegistryItem[] {
	const components = fs
		.readdirSync(path.join(cwd, UI_DIR))
		.filter((file) => file.endsWith(".ts"))
		.toSorted()
		.map<RegistryItem>((file) => ({
			name: file.slice(0, -".ts".length),
			type: "ui",
			files: [{ path: `${UI_DIR}/${file}` }],
		}));

	return [
		...components,
		{ name: "utils", type: "lib", add: "when-needed", files: [{ path: LIB_FILE }] },
	];
}

export default defineConfig({
	registry: ({ cwd }) => ({
		name: "@implementjs/ui",
		version: registryVersion(cwd),
		description: "Styled components built on @implementjs/primitives.",
		homepage: "https://github.com/ieedan/implement",
		repository: "https://github.com/ieedan/implement",
		bugs: "https://github.com/ieedan/implement/issues",
		// who can read the registry once it is on jsrepo.com. Public is the default, but it is the one
		// field here that a wrong default would quietly get wrong, so it says so
		access: "public",
		// the framework itself — the registry docs list these under "what you need first", so asking
		// for a button should not drag them in behind the user's back
		excludeDeps: ["@implementjs/core", "@implementjs/primitives"],
		defaultPaths: DEFAULT_PATHS,
		items: items(cwd),
		outputs: [repository()],
	}),
	// `fs://.` resolves this checkout, which is how `create-implement-app --link` reads the registry
	providers: [...DEFAULT_PROVIDERS, filesystem()],
	build: {
		/*
		 * A `workspace:` range means nothing outside this repo, so every implement package a
		 * component imports has to be rewritten before it is published. `@jsrepo/pnpm` walks up to
		 * `pnpm-workspace.yaml` and reads the version off the package the range points at, which is
		 * the version the components here were built against — and, because the `Registry` job runs
		 * after the one that publishes to npm, one that exists by the time anyone installs it.
		 *
		 * It carries the sigil across rather than picking one, so the range a consumer gets is the
		 * range the `package.json` beside this file asks for: `workspace:~` becomes `~0.0.6`. The
		 * tilde is deliberate on this version line, for the reason `create-implement-app` spells out
		 * in `templates/versions.ts` — `^0.0.6` is an exact pin, while a tilde is a floor a patch
		 * release moves past on its own.
		 *
		 * Everything not on the `workspace:` protocol is already a real range and passes through.
		 */
		remoteDependencyResolver: pnpm(),
	},
});
