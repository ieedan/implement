import { confirm, log, multiselect, select, text } from "@clack/prompts";
import { type Command, Option } from "commander";
import { err, ok, type Result } from "nevereverthrow";
import pc from "picocolors";
import { z } from "zod";
import {
	commonOptions,
	defaultCommandOptionsSchema,
	parseOptions,
	tryCommand,
} from "@/commands/utils";
import { getTemplate } from "@/templates";
import { ADDON_META, ADDONS, type Addon, TEMPLATES, type TemplateId } from "@/templates/types";
import type { CLIError } from "@/utils/errors";
import { DirectoryNotEmptyError } from "@/utils/errors";
import { meaningfulEntries, writeFileSync } from "@/utils/fs";
import {
	detectPackageManager,
	installCommand,
	type PackageManager,
	PACKAGE_MANAGERS,
	runCommandString,
	toPackageName,
	validatePackageName,
} from "@/utils/package";
import { basename, joinAbsolute, relativeToCwd, resolveAbsolute } from "@/utils/path";
import { initLogging, intro, isTTY, outro, runCommands, unwrapPrompt } from "@/utils/prompts";
import type { AbsolutePath } from "@/utils/types";

/** Used when nothing else says where the app goes. */
export const DEFAULT_DIRECTORY = "implement-app";

export const DEFAULT_TEMPLATE: TemplateId = "kit";

/** The addons `--yes` (and any other non-interactive run) turns on. */
export const DEFAULT_ADDONS: Addon[] = ["tailwind"];

export const schema = defaultCommandOptionsSchema.extend({
	name: z.string().optional(),
	template: z.enum(TEMPLATES).optional(),
	tailwind: z.boolean().optional(),
	primitives: z.boolean().optional(),
	icons: z.boolean().optional(),
	packageManager: z.enum(PACKAGE_MANAGERS).optional(),
	install: z.boolean(),
	git: z.boolean(),
	workspace: z.boolean(),
	overwrite: z.boolean(),
	yes: z.boolean(),
	verbose: z.boolean(),
});

export type CreateOptions = z.infer<typeof schema>;

export type CreateCommandResult = {
	directory: AbsolutePath;
	name: string;
	template: TemplateId;
	addons: Addon[];
	files: string[];
	packageManager: PackageManager;
	installed: boolean;
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
		.option("--icons", "Add icons from @implementjs/lucide.")
		.option("--no-icons", "Don't add @implementjs/lucide.")
		.addOption(
			new Option("--package-manager <pm>", "The package manager to install with.").choices(
				PACKAGE_MANAGERS,
			),
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

	const addons = await resolveAddons(options, { interactive });

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

	spinner.start(`Creating ${pc.cyan(name)}`);

	const files = getTemplate(template).files({ name, addons, workspace: options.workspace });

	for (const file of files) {
		verbose(`Writing ${file.path}`);
		const writeResult = writeFileSync(joinAbsolute(directory, file.path), file.contents);
		if (writeResult.isErr()) {
			spinner.stop(pc.red(`Failed to create ${pc.cyan(name)}`));
			return err(writeResult.error);
		}
	}

	spinner.stop(`Created ${pc.cyan(name)} with ${files.length} files`);

	const packageManager = options.packageManager ?? (await detectPackageManager(options.cwd));

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

	logNextSteps({
		cwd: options.cwd,
		directory,
		packageManager,
		installed: options.install,
	});

	return ok({
		directory,
		name,
		template,
		addons,
		files: files.map((file) => file.path),
		packageManager,
		installed: options.install,
	});
}

/**
 * Flags win over prompts, and in a non-interactive run anything the flags didn't answer falls back
 * to {@link DEFAULT_ADDONS}.
 */
async function resolveAddons(
	options: CreateOptions,
	{ interactive }: { interactive: boolean },
): Promise<Addon[]> {
	const fromFlags = (addon: Addon): boolean | undefined => options[addon];

	if (!interactive) {
		return ADDONS.filter((addon) => fromFlags(addon) ?? DEFAULT_ADDONS.includes(addon));
	}

	const selected = unwrapPrompt(
		await multiselect<Addon>({
			message: "What else would you like to set up?",
			required: false,
			initialValues: ADDONS.filter((addon) => fromFlags(addon) ?? DEFAULT_ADDONS.includes(addon)),
			options: ADDONS.map((addon) => ({
				value: addon,
				label: ADDON_META[addon].label,
				hint: ADDON_META[addon].hint,
			})),
		}),
	);

	// keep the canonical order so the generated files don't depend on click order
	return ADDONS.filter((addon) => selected.includes(addon));
}

function logNextSteps({
	cwd,
	directory,
	packageManager,
	installed,
}: {
	cwd: AbsolutePath;
	directory: AbsolutePath;
	packageManager: PackageManager;
	installed: boolean;
}) {
	const relative = relativeToCwd(cwd, directory);
	const steps: string[] = [];

	if (relative !== "") steps.push(`cd ${relative}`);
	if (!installed) steps.push(`${packageManager} install`);
	steps.push(runCommandString(packageManager, "dev"));

	log.message(
		["Next steps:", ...steps.map((step, i) => `${pc.gray(`${i + 1}.`)} ${pc.cyan(step)}`)].join(
			"\n",
		),
	);
}
