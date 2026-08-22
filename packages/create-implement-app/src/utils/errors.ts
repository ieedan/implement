import pc from "picocolors";
import type { z } from "zod";

export type CLIError =
	| CreateImplementAppError
	| DirectoryNotEmptyError
	| InvalidOptionsError
	| InvalidPackageNameError
	| InvalidTemplateError
	| InvalidAddonError
	| NoLinkedPackagesError
	| MissingLinkedPackageError
	| MissingLinkedRegistryError
	| ConflictingLinkOptionsError;

export class CreateImplementAppError extends Error {
	private readonly suggestion: string;
	private readonly docsLink?: string;

	constructor(
		message: string,
		options: {
			suggestion: string;
			docsLink?: string;
		},
	) {
		super(message);

		this.suggestion = options.suggestion;
		this.docsLink = options.docsLink;
	}

	toString() {
		return `${this.message} ${this.suggestion}${pc.gray(this.docsLink ? `\n   See: ${this.docsLink}` : "")}`;
	}
}

export class DirectoryNotEmptyError extends CreateImplementAppError {
	constructor(dir: string) {
		super(`${pc.bold(dir)} is not empty.`, {
			suggestion: "Pass --overwrite to scaffold into it anyways.",
		});
	}
}

export class InvalidOptionsError extends CreateImplementAppError {
	constructor(error: z.ZodError) {
		super(
			`Invalid options provided: ${error.issues
				.map((issue) => `${issue.path.join(".")} (${issue.message})`)
				.join(", ")}`,
			{ suggestion: "Please check the options and try again." },
		);
	}
}

export class InvalidPackageNameError extends CreateImplementAppError {
	constructor(name: string, reason: string) {
		super(`${pc.bold(name)} is not a valid package name: ${reason}.`, {
			suggestion: "Pass a valid name with --name.",
		});
	}
}

export class InvalidTemplateError extends CreateImplementAppError {
	constructor(template: string, templates: string[]) {
		super(`${pc.bold(template)} is not a valid template.`, {
			suggestion: `Expected one of: ${templates.map((t) => pc.cyan(t)).join(", ")}.`,
		});
	}
}

export class InvalidAddonError extends CreateImplementAppError {
	constructor(addon: string, addons: string[]) {
		super(`${pc.bold(addon)} is not a valid addon.`, {
			suggestion: `Expected one of: ${addons.map((a) => pc.cyan(a)).join(", ")}.`,
		});
	}
}

export class NoLinkedPackagesError extends CreateImplementAppError {
	constructor(path: string) {
		super(`No implement packages found in ${pc.bold(path)}.`, {
			suggestion: "Point --link at a clone of the implement repo, the one holding packages/core.",
		});
	}
}

export class MissingLinkedPackageError extends CreateImplementAppError {
	constructor(dependency: string) {
		super(`The linked repository has no ${pc.bold(dependency)}.`, {
			suggestion: "Update the clone --link points at, or drop the addon that needs it.",
		});
	}
}

export class MissingLinkedRegistryError extends CreateImplementAppError {
	constructor(path: string) {
		super(`The linked repository has no built ${pc.bold("registry.json")}.`, {
			suggestion: `Run ${pc.cyan("pnpm registry")} in ${pc.bold(path)}, or drop the ui addon.`,
		});
	}
}

export class ConflictingLinkOptionsError extends CreateImplementAppError {
	constructor() {
		super("--link and --workspace both decide how the implement packages resolve.", {
			suggestion: "Pass one or the other.",
		});
	}
}
