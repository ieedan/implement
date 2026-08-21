import fs from "node:fs";
import path from "node:path";
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
 * implement isn't published to a registry yet, so the packages a component pulls in ask for the
 * latest tag — the same thing `create-implement-app` writes into a scaffolded `package.json`.
 */
const IMPLEMENT_VERSION = "latest";

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
		description: "Styled components built on @implementjs/primitives.",
		homepage: "https://github.com/ieedan/implement",
		repository: "https://github.com/ieedan/implement",
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
		// a workspace: range means nothing outside this repo; everything else is already the version
		// the components are built against, read from the package.json beside this file
		remoteDependencyResolver: (dep) =>
			dep.version?.startsWith("workspace:") ? { ...dep, version: IMPLEMENT_VERSION } : dep,
	},
});
