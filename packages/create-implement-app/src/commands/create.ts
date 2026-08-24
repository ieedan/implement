import { confirm, log, multiselect, select, text } from "@clack/prompts";
import { type Command, Option } from "commander";
import { err, ok, type Result } from "nevereverthrow";
import pc from "picocolors";
import * as v from "valibot";
import { adders as ADDER_REGISTRY, applyAdders } from "@/adders";
import { type AdderContext, ADDERS, type AdderId } from "@/adders/types";
import { commonOptions, defaultCommandOptions, parseOptions, tryCommand } from "@/commands/utils";
import { getTemplate } from "@/templates";
import { UI_ITEMS, UI_REGISTRY, UI_REGISTRY_DIR, UI_SCRIPT } from "@/templates/shared";
import {
	ADDON_META,
	ADDONS,
	type Addon,
	TEMPLATES,
	type TemplateContext,
	type TemplateFile,
	type TemplateId,
} from "@/templates/types";
import type { CLIError } from "@/utils/errors";
import {
	CreateImplementAppError,
	DirectoryNotEmptyError,
	MissingLinkedRegistryError,
} from "@/utils/errors";
import { resolveLink } from "@/utils/link";
import { exists, meaningfulEntries, writeFileSync } from "@/utils/fs";
import {
	detectPackageManager,
	installCommand,
	type PackageManager,
	PACKAGE_MANAGERS,
	runCommand,
	runCommandString,
	toPackageName,
	validatePackageName,
} from "@/utils/package";
import { basename, joinAbsolute, relativeToCwd, resolveAbsolute, shortestPath } from "@/utils/path";
import { initLogging, intro, isTTY, outro, runCommands, unwrapPrompt } from "@/utils/prompts";
import type { AbsolutePath } from "@/utils/types";

/** The file the adders fold their dependencies and scripts into. */
const PACKAGE_JSON = "package.json";

/** Used when nothing else says where the app goes. */
export const DEFAULT_DIRECTORY = "implement-app";

export const DEFAULT_TEMPLATE: TemplateId = "kit";

/** The addons `--yes` (and any other non-interactive run) turns on. */
export const DEFAULT_ADDONS: Addon[] = ["tailwind"];

/** The adders `--yes` (and any other non-interactive run) turns on. */
export const DEFAULT_ADDERS: AdderId[] = [];

/**
 * The addons an addon cannot work without. The styled components are tailwind classes over the
 * primitives, so picking `ui` alone would scaffold an app whose first component doesn't render.
 */
const REQUIRES: Partial<Record<Addon, Addon[]>> = {
	ui: ["tailwind", "primitives"],
};

export const schema = v.object({
	...defaultCommandOptions,
	name: v.optional(v.string()),
	template: v.optional(v.picklist(TEMPLATES)),
	tailwind: v.optional(v.boolean()),
	primitives: v.optional(v.boolean()),
	ui: v.optional(v.boolean()),
	icons: v.optional(v.boolean()),
	forms: v.optional(v.boolean()),
	modeWatcher: v.optional(v.boolean()),
	oxlint: v.optional(v.boolean()),
	packageManager: v.optional(v.picklist(PACKAGE_MANAGERS)),
	link: v.optional(v.string()),
	install: v.boolean(),
	git: v.boolean(),
	workspace: v.boolean(),
	overwrite: v.boolean(),
	yes: v.boolean(),
	verbose: v.boolean(),
});

export type CreateOptions = v.InferOutput<typeof schema>;

export type CreateCommandResult = {
	directory: AbsolutePath;
	name: string;
	template: TemplateId;
	addons: Addon[];
	adders: AdderId[];
	files: string[];
	packageManager: PackageManager;
	installed: boolean;
	/** Whether kit's `.implement/` was generated as part of the run. */
	synced: boolean;
	/** The `@implementjs/ui` components jsrepo added, empty when the addon is off or nothing ran. */
	components: string[];
	/** The implement packages that were linked to a local repo, keyed by name. */
	linked: Record<string, string> | undefined;
};

/**
 * The one thing this CLI does, applied to the root program so `--help` lands on it and
 * `create-implement-app my-app` works without naming a subcommand.
 */
export function addCreateCommand(cmd: Command): Command {
	return cmd
		.argument("[directory]", "The directory to create the app in.")
		.option("--name <name>", "The name of the app. Defaults to the directory name.")
		.addOption(
			new Option("-t, --template <template>", "The template to start from.").choices(TEMPLATES),
		)
		.option("--tailwind", "Set up tailwindcss.")
		.option("--no-tailwind", "Don't set up tailwindcss.")
		.option("--primitives", "Add headless components from @implementjs/primitives.")
		.option("--no-primitives", "Don't add @implementjs/primitives.")
		.option("--ui", "Add styled components from the @implementjs/ui jsrepo registry.")
		.option("--no-ui", "Don't add @implementjs/ui.")
		.option("--icons", "Add icons from @implementjs/lucide.")
		.option("--no-icons", "Don't add @implementjs/lucide.")
		.option("--forms", "Add schema-first forms from @implementjs/formish.")
		.option("--no-forms", "Don't add @implementjs/formish.")
		.option("--mode-watcher", "Add dark mode from @implementjs/mode-watcher.")
		.option("--no-mode-watcher", "Don't add @implementjs/mode-watcher.")
		.option("--oxlint", "Set up linting and formatting with oxlint and oxfmt.")
		.option("--no-oxlint", "Don't set up oxlint and oxfmt.")
		.addOption(
			new Option("--package-manager <pm>", "The package manager to install with.").choices(
				PACKAGE_MANAGERS,
			),
		)
		.option(
			"--link <path>",
			"Link every implement package the app needs to a local clone of the implement repo.",
		)
		.option("--install", "Install dependencies after scaffolding.", false)
		.option("--git", "Initialize a git repository.", false)
		.option(
			"--workspace",
			"Depend on the implement packages with workspace:* (for apps inside the implement monorepo).",
			false,
		)
		.option("--overwrite", "Scaffold into the directory even if it isn't empty.", false)
		.addOption(commonOptions.yes)
		.addOption(commonOptions.verbose)
		.addOption(commonOptions.cwd)
		.action(async (directory, rawOptions) => {
			const options = parseOptions(schema, rawOptions);

			intro();

			await tryCommand(runCreate(directory, options));

			outro(pc.green("Your app is ready!"));
		});
}

export async function runCreate(
	directoryArg: string | undefined,
	options: CreateOptions,
): Promise<Result<CreateCommandResult, CLIError>> {
	const { verbose, spinner } = initLogging({ options });

	// every prompt is skipped when there is no one to answer it, so agents and CI can drive the CLI
	// entirely with flags
	const interactive = isTTY() && !options.yes;

	const directoryInput =
		directoryArg ??
		(interactive
			? unwrapPrompt(
					await text({
						message: "Where should we create your app?",
						placeholder: DEFAULT_DIRECTORY,
						defaultValue: DEFAULT_DIRECTORY,
					}),
				)
			: DEFAULT_DIRECTORY);

	const directory = resolveAbsolute(options.cwd, directoryInput);
	verbose(`Creating the app in ${directory}`);

	const nameResult = validatePackageName(options.name ?? toPackageName(basename(directory)));
	if (nameResult.isErr()) return err(nameResult.error);
	const name = nameResult.value;

	const template =
		options.template ??
		(interactive
			? unwrapPrompt(
					await select({
						message: "Which template would you like to use?",
						initialValue: DEFAULT_TEMPLATE,
						options: TEMPLATES.map((id) => {
							const { label, hint } = getTemplate(id);
							return { value: id, label, hint };
						}),
					}),
				)
			: DEFAULT_TEMPLATE);

	const { addons, adders } = await resolveExtras(options, { interactive });

	const emptyResult = meaningfulEntries(directory);
	if (emptyResult.isErr()) return err(emptyResult.error);
	if (emptyResult.value.length > 0 && !options.overwrite) {
		const relative = relativeToCwd(options.cwd, directory) || ".";
		if (!interactive) return err(new DirectoryNotEmptyError(relative));

		const proceed = unwrapPrompt(
			await confirm({
				message: `${pc.cyan(relative)} is not empty. Files may be overwritten, continue?`,
				initialValue: false,
			}),
		);
		if (!proceed) return err(new DirectoryNotEmptyError(relative));
	}

	// the package manager decides how a linked path is spelled, so it has to be settled before the
	// package.json is written
	const packageManager = options.packageManager ?? (await detectPackageManager(options.cwd));

	const linkResult = resolveLink({
		cwd: options.cwd,
		directory,
		link: options.link,
		workspace: options.workspace,
		packageManager,
		verbose,
	});
	if (linkResult.isErr()) return err(linkResult.error);
	const link = linkResult.value;

	const ui = addons.includes("ui");
	// jsrepo's fs provider reads the built manifest, so a clone that has never run `jsrepo build`
	// would only fail once the components are being added — after everything else succeeded
	if (ui && link && !exists(joinAbsolute(link.root, UI_REGISTRY_DIR, "registry.json"))) {
		return err(new MissingLinkedRegistryError(shortestPath(options.cwd, link.root)));
	}

	spinner.start(`Creating ${pc.cyan(name)}`);

	const filesResult = templateFiles(template, {
		name,
		addons,
		workspace: options.workspace,
		link: link?.specifiers,
		linkRoot: link?.path,
		packageManager,
	});
	if (filesResult.isErr()) {
		spinner.stop(pc.red(`Failed to create ${pc.cyan(name)}`));
		return err(filesResult.error);
	}
	// the adders layer onto what the template wrote: their own config files, and the dependencies
	// and scripts they need folded into the generated package.json
	const withAdders = addAdders(filesResult.value, adders, {
		workspace: options.workspace,
		link: link?.specifiers,
		packageManager,
	});
	if (withAdders.isErr()) {
		spinner.stop(pc.red(`Failed to create ${pc.cyan(name)}`));
		return err(withAdders.error);
	}
	const files = withAdders.value;

	for (const file of files) {
		verbose(`Writing ${file.path}`);
		const writeResult = writeFileSync(joinAbsolute(directory, file.path), file.contents);
		if (writeResult.isErr()) {
			spinner.stop(pc.red(`Failed to create ${pc.cyan(name)}`));
			return err(writeResult.error);
		}
	}

	spinner.stop(`Created ${pc.cyan(name)} with ${files.length} files`);

	if (link) {
		log.success(
			`Linked ${Object.keys(link.specifiers).length} implement packages to ${pc.cyan(
				shortestPath(options.cwd, link.root),
			)}`,
		);
	}

	if (options.git) {
		await runCommands({
			title: "Initializing a git repository",
			commands: [{ command: "git", args: ["init"] }],
			cwd: directory,
			messages: {
				success: () => "Initialized a git repository",
				error: (e) => `Failed to initialize a git repository: ${String(e)}`,
			},
		});
	}

	if (options.install) {
		await runCommands({
			title: `Installing dependencies with ${packageManager}`,
			commands: [installCommand(packageManager)],
			cwd: directory,
			messages: {
				success: () => "Installed dependencies",
				error: (e) => `Failed to install dependencies: ${String(e)}`,
			},
		});
	}

	// kit only typechecks once `.implement/` exists (generated entries, the tsconfig the app extends,
	// and a `./$types` per route) and nothing has run vite yet — sync now so the editor and `check`
	// work the moment the app is opened. It needs the deps, so it waits on the install.
	const synced = template === "kit" && options.install;
	if (synced) {
		await runCommands({
			title: "Syncing .implement/",
			commands: [runCommand(packageManager, "sync")],
			cwd: directory,
			messages: {
				success: () => "Synced .implement/",
				error: (e) => `Failed to sync .implement/: ${String(e)}`,
			},
		});
	}

	// jsrepo copies the components out of the registry, so it needs its own dependency on disk —
	// which means this waits on the install the same way the sync above does
	const components = ui && options.install ? UI_ITEMS : [];
	if (components.length > 0) {
		await runCommands({
			title: `Adding ${components.join(", ")} from ${UI_REGISTRY}`,
			commands: [runCommand(packageManager, UI_SCRIPT, [...components, "--yes"])],
			cwd: directory,
			messages: {
				success: () => `Added ${components.join(", ")} from ${UI_REGISTRY}`,
				error: (e) => `Failed to add components from ${UI_REGISTRY}: ${String(e)}`,
			},
		});
	}

	// an adder's dependencies only exist once the install has run, so anything it wants to run over
	// the app it was just added to waits for it the same way the sync above does
	if (options.install) {
		for (const id of adders) {
			const script = ADDER_REGISTRY[id].postInstallScript;
			if (script === undefined) continue;
			await runCommands({
				title: `Running ${runCommandString(packageManager, script)}`,
				commands: [runCommand(packageManager, script)],
				cwd: directory,
				messages: {
					success: () => `Ran ${runCommandString(packageManager, script)}`,
					error: (e) => `Failed to run ${runCommandString(packageManager, script)}: ${String(e)}`,
				},
			});
		}
	}

	logNextSteps({
		cwd: options.cwd,
		directory,
		packageManager,
		installed: options.install,
		// without an install the components were never fetched, and the counter imports one
		components: ui && !options.install ? UI_ITEMS : [],
	});

	return ok({
		directory,
		name,
		template,
		addons,
		adders,
		files: files.map((file) => file.path),
		packageManager,
		installed: options.install,
		synced,
		components,
		linked: link?.specifiers,
	});
}

/**
 * A template throws when it needs an implement package the linked repo doesn't have — the only way
 * generating files can fail — so it comes back as an error like everything else.
 */
function templateFiles(
	template: TemplateId,
	context: TemplateContext,
): Result<TemplateFile[], CLIError> {
	try {
		return ok(getTemplate(template).files(context));
	} catch (e) {
		if (e instanceof CreateImplementAppError) return err(e);
		throw e;
	}
}

/**
 * The addons and the adders come out of one question, because from the outside they are the same
 * choice — what else the app should have. They part ways after this: an addon changes what the
 * template writes, an adder layers config onto whatever it wrote.
 *
 * Flags win over prompts, and in a non-interactive run anything the flags didn't answer falls back
 * to {@link DEFAULT_ADDONS} and {@link DEFAULT_ADDERS}.
 */
async function resolveExtras(
	options: CreateOptions,
	{ interactive }: { interactive: boolean },
): Promise<{ addons: Addon[]; adders: AdderId[] }> {
	const wantsAddon = (addon: Addon): boolean => options[addon] ?? DEFAULT_ADDONS.includes(addon);
	// every adder answers to a flag of its own — an adder without one doesn't type check here
	const wantsAdder = (adder: AdderId): boolean => options[adder] ?? DEFAULT_ADDERS.includes(adder);

	const defaultAddons = ADDONS.filter(wantsAddon);
	const defaultAdders = ADDERS.filter(wantsAdder);

	if (!interactive) {
		return { addons: withRequired(defaultAddons), adders: defaultAdders };
	}

	const selected = unwrapPrompt(
		await multiselect<Addon | AdderId>({
			message: "What else would you like to set up?",
			required: false,
			initialValues: [...defaultAddons, ...defaultAdders],
			options: [
				...ADDONS.map((addon) => ({
					value: addon,
					label: ADDON_META[addon].label,
					hint: ADDON_META[addon].hint,
				})),
				...ADDERS.map((adder) => ({
					value: adder,
					label: ADDER_REGISTRY[adder].label,
					hint: ADDER_REGISTRY[adder].hint,
				})),
			],
		}),
	);

	// keep the canonical order so the generated files don't depend on click order
	return {
		addons: withRequired(ADDONS.filter((addon) => selected.includes(addon))),
		adders: ADDERS.filter((adder) => selected.includes(adder)),
	};
}

/**
 * The template's files with the adders applied: their config files appended, and the generated
 * `package.json` carrying the dependencies and scripts they need. Same code path `add` runs against
 * an app that already exists, so an app scaffolded with `--oxlint` and one that added it later end
 * up with the same files.
 */
function addAdders(
	files: TemplateFile[],
	ids: AdderId[],
	ctx: AdderContext,
): Result<TemplateFile[], CLIError> {
	if (ids.length === 0) return ok(files);

	const packageJson = files.find((file) => file.path === PACKAGE_JSON);
	if (packageJson === undefined) return ok(files);

	const changes = applyAdders(ids, ctx, packageJson.contents);
	if (changes.isErr()) return err(changes.error);

	return ok([
		...files.map((file) =>
			file.path === PACKAGE_JSON ? { ...file, contents: changes.value.packageJson } : file,
		),
		...changes.value.files,
	]);
}

/** Turns on whatever {@link REQUIRES} says the chosen addons need, even against a `--no-` flag. */
function withRequired(addons: Addon[]): Addon[] {
	const required = new Set(addons.flatMap((addon) => REQUIRES[addon] ?? []));
	return ADDONS.filter((addon) => addons.includes(addon) || required.has(addon));
}

function logNextSteps({
	cwd,
	directory,
	packageManager,
	installed,
	components,
}: {
	cwd: AbsolutePath;
	directory: AbsolutePath;
	packageManager: PackageManager;
	installed: boolean;
	components: string[];
}) {
	const relative = relativeToCwd(cwd, directory);
	const steps: string[] = [];

	if (relative !== "") steps.push(`cd ${relative}`);
	if (!installed) steps.push(`${packageManager} install`);
	if (components.length > 0) {
		steps.push(runCommandString(packageManager, UI_SCRIPT, components));
	}
	steps.push(runCommandString(packageManager, "dev"));

	log.message(
		["Next steps:", ...steps.map((step, i) => `${pc.gray(`${i + 1}.`)} ${pc.cyan(step)}`)].join(
			"\n",
		),
	);
}
