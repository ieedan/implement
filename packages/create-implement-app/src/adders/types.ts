import type { TemplateFile } from "@/templates/types";
import type { Dependency, VersionContext } from "@/templates/versions";
import type { PackageManager } from "@/utils/package";

/**
 * The layers that can be added to an app at any point, rather than only while it is being
 * scaffolded.
 *
 * An addon shapes the app the templates write — tailwind swaps the stylesheet, icons change what
 * the counter renders — so it only means something during `create`. An adder is self contained:
 * config files of its own, dependencies, and scripts. That is what lets `add` apply one to an app
 * that already exists.
 */
export const ADDERS = ["oxlint"] as const;

export type AdderId = (typeof ADDERS)[number];

/**
 * What an adder is applied against. `create` fills it in from the run that is scaffolding the app;
 * `add` reads what it can out of the app's own `package.json`.
 */
export type AdderContext = VersionContext & {
	/** The package manager the app is installed with — how the adder spells a command it prints. */
	packageManager: PackageManager;
};

export type Adder = {
	id: AdderId;
	label: string;
	hint: string;
	/** Added to the app's `dependencies`. */
	dependencies?: Dependency[];
	/** Added to the app's `devDependencies`. */
	devDependencies?: Dependency[];
	/** Added to the app's `scripts`, keyed by name. */
	scripts?: Record<string, string>;
	/**
	 * One of the adder's own scripts to run once its dependencies are on disk. `create --install`
	 * uses it to leave the app in the state the adder promises — nothing else runs it, because in an
	 * app that already exists it would reach code the adder was never asked about.
	 */
	postInstallScript?: string;
	/** The config files the adder writes, relative to the app directory. */
	files?: (ctx: AdderContext) => TemplateFile[];
};
