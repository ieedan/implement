import { log, multiselect } from "@clack/prompts";
import { type Command, Option } from "commander";
import { err, ok, type Result } from "nevereverthrow";
import pc from "picocolors";
import * as v from "valibot";
import { adders, type AdderId, ADDERS, applyAdders, parseAdders } from "@/adders";
import { commonOptions, defaultCommandOptions, parseOptions, tryCommand } from "@/commands/utils";
import type { CLIError } from "@/utils/errors";
import { MissingPackageJsonError, NoAddersSelectedError } from "@/utils/errors";
import { exists, readFileSync, writeFileSync } from "@/utils/fs";
import { resolveLink } from "@/utils/link";
import {
	detectPackageManager,
	installCommand,
	type PackageManager,
	PACKAGE_MANAGERS,
	runCommandString,
} from "@/utils/package";
import { joinAbsolute } from "@/utils/path";
import { initLogging, intro, isTTY, outro, runCommands, unwrapPrompt } from "@/utils/prompts";
import type { AbsolutePath } from "@/utils/types";

export const schema = v.object({
	...defaultCommandOptions,
	packageManager: v.optional(v.picklist(PACKAGE_MANAGERS)),
	link: v.optional(v.string()),
	install: v.boolean(),
	workspace: v.boolean(),
	overwrite: v.boolean(),
	yes: v.boolean(),
	verbose: v.boolean(),
});

export type AddOptions = v.InferOutput<typeof schema>;

export type AddCommandResult = {
	/** The app the adders were applied to. */
	directory: AbsolutePath;
	adders: AdderId[];
	/** The config files that were written. */
	files: string[];
	/** The config files that were already there, and so were left alone. */
	skippedFiles: string[];
	/** The scripts that were added to `package.json`. */
	scripts: string[];
	/** The dependencies that were added to `package.json`. */
	dependencies: string[];
	packageManager: PackageManager;
	installed: boolean;
};

/**
 * `add` applies an adder to an app that already exists — the same config, dependencies, and
 * scripts `create` would have written, minus the app.
 */
export function addAddCommand(cmd: Command): Command {
	cmd
		.command("add")
		.description("Add an adder to an app that already exists.")
		.argument("[adders...]", `The adders to add. One of: ${ADDERS.join(", ")}.`)
		.addOption(
			new Option("--package-manager <pm>", "The package manager to install with.").choices(
				PACKAGE_MANAGERS,
			),
		)
		.option(
			"--link <path>",
			"Link every implement package the adders need to a local clone of the implement repo.",
		)
		.option("--install", "Install dependencies after adding.", false)
		.option(
			"--workspace",
			"Depend on the implement packages with workspace:* (for apps inside the implement monorepo).",
			false,
		)
		.option("--overwrite", "Overwrite config files and scripts the app already has.", false)
		.addOption(commonOptions.yes)
		.addOption(commonOptions.verbose)
		.addOption(commonOptions.cwd)
		.action(async (adderArgs: string[], rawOptions) => {
			const options = parseOptions(schema, rawOptions);

			intro();

			const result = await tryCommand(runAdd(adderArgs, options));

			outro(pc.green(`Added ${result.adders.join(", ")}!`));
		});

	return cmd;
}

export async function runAdd(
	adderArgs: string[],
	options: AddOptions,
): Promise<Result<AddCommandResult, CLIError>> {
	const { verbose, spinner } = initLogging({ options });

	const interactive = isTTY() && !options.yes;

	const directory = options.cwd;
	const packagePath = joinAbsolute(directory, "package.json");
	if (!exists(packagePath)) return err(new MissingPackageJsonError(directory));

	const selectedResult = await resolveAdders(adderArgs, { interactive });
	if (selectedResult.isErr()) return err(selectedResult.error);
	const selected = selectedResult.value;

	verbose(`Adding ${selected.join(", ")} to ${directory}`);

	const packageManager = options.packageManager ?? (await detectPackageManager(directory));

	const linkResult = resolveLink({
		cwd: options.cwd,
		directory,
		link: options.link,
		workspace: options.workspace,
		packageManager,
		verbose,
	});
	if (linkResult.isErr()) return err(linkResult.error);

	const contents = readFileSync(packagePath);
	if (contents.isErr()) return err(contents.error);

	const changesResult = applyAdders(
		selected,
		{
			workspace: options.workspace,
			link: linkResult.value?.specifiers,
			packageManager,
		},
		contents.value,
		{ overwrite: options.overwrite },
	);
	if (changesResult.isErr()) return err(changesResult.error);
	const changes = changesResult.value;

	spinner.start(`Adding ${pc.cyan(selected.join(", "))}`);

	// a config file the app already has is a config file someone has since edited, so it stays as
	// it is unless the run says otherwise
	const written: string[] = [];
	const skippedFiles: string[] = [];
	for (const file of changes.files) {
		const path = joinAbsolute(directory, file.path);
		if (exists(path) && !options.overwrite) {
			// a file that already says what the adder would say is the adder, already added — only a
			// file someone has since edited is worth mentioning
			const current = readFileSync(path);
			if (current.isErr()) return err(current.error);
			verbose(`Skipping ${file.path}, it already exists`);
			if (current.value !== file.contents) skippedFiles.push(file.path);
			continue;
		}
		verbose(`Writing ${file.path}`);
		const writeResult = writeFileSync(path, file.contents);
		if (writeResult.isErr()) {
			spinner.stop(pc.red(`Failed to add ${pc.cyan(selected.join(", "))}`));
			return err(writeResult.error);
		}
		written.push(file.path);
	}

	const packageResult = writeFileSync(packagePath, changes.packageJson);
	if (packageResult.isErr()) {
		spinner.stop(pc.red(`Failed to add ${pc.cyan(selected.join(", "))}`));
		return err(packageResult.error);
	}

	spinner.stop(`Added ${pc.cyan(selected.join(", "))}`);

	for (const path of skippedFiles) {
		log.warn(`Kept the ${pc.cyan(path)} that was already there. --overwrite replaces it.`);
	}
	for (const script of changes.skippedScripts) {
		log.warn(`Kept the ${pc.cyan(script)} script that was already there. --overwrite replaces it.`);
	}

	if (options.install && changes.dependencies.length > 0) {
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
		packageManager,
		installed: options.install,
		scripts: primaryScripts(selected),
	});

	return ok({
		directory,
		adders: selected,
		files: written,
		skippedFiles,
		scripts: changes.scripts,
		dependencies: changes.dependencies,
		packageManager,
		installed: options.install,
	});
}

/**
 * What the run points at when it is done. The first script an adder declares is the one it exists
 * for — the rest are there for CI and for editors, and naming all of them would bury it.
 */
function primaryScripts(ids: AdderId[]): string[] {
	return ids.flatMap((id) => Object.keys(adders[id].scripts ?? {}).slice(0, 1));
}

/** The adders named on the command line, or the ones picked out of the prompt when none were. */
async function resolveAdders(
	adderArgs: string[],
	{ interactive }: { interactive: boolean },
): Promise<Result<AdderId[], CLIError>> {
	if (adderArgs.length > 0) return parseAdders(adderArgs);
	if (!interactive) return err(new NoAddersSelectedError([...ADDERS]));

	const selected = unwrapPrompt(
		await multiselect<AdderId>({
			message: "What would you like to add?",
			required: true,
			options: ADDERS.map((id) => ({
				value: id,
				label: adders[id].label,
				hint: adders[id].hint,
			})),
		}),
	);

	// the canonical order, so applying two adders doesn't depend on the order they were clicked
	return ok(ADDERS.filter((id) => selected.includes(id)));
}

function logNextSteps({
	packageManager,
	installed,
	scripts,
}: {
	packageManager: PackageManager;
	installed: boolean;
	scripts: string[];
}) {
	const steps: string[] = [];

	if (!installed) steps.push(`${packageManager} install`);
	for (const script of scripts) steps.push(runCommandString(packageManager, script));

	if (steps.length === 0) return;

	log.message(
		["Next steps:", ...steps.map((step, i) => `${pc.gray(`${i + 1}.`)} ${pc.cyan(step)}`)].join(
			"\n",
		),
	);
}
