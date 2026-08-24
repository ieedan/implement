import * as p from "@clack/prompts";
import { Option } from "commander";
import type { Result } from "nevereverthrow";
import pc from "picocolors";
import * as v from "valibot";
import { CreateImplementAppError, InvalidOptionsError } from "@/utils/errors";
import { safeValidate } from "@/utils/schema";
import type { AbsolutePath } from "@/utils/types";

export const TRACE_ENV_VAR = "CREATE_IMPLEMENT_APP_TRACE";

export const defaultCommandOptions = {
	cwd: v.pipe(
		v.string(),
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Branded path: CLI cwd is normalized to absolute before use.
		v.transform((value) => value as AbsolutePath),
	),
};

export const commonOptions = {
	cwd: new Option("--cwd <path>", "The current working directory.").default(process.cwd()),
	yes: new Option(
		"-y, --yes",
		"Skip every prompt and use the defaults for anything not passed as a flag.",
	).default(false),
	verbose: new Option("--verbose", "Include debug logs.").default(false),
};

export function parseOptions<TSchema extends v.GenericSchema>(
	schema: TSchema,
	rawOptions: unknown,
): v.InferOutput<TSchema> {
	return safeValidate(schema, rawOptions).match(
		(options) => options,
		(e) => error(new InvalidOptionsError(e.issues)),
	);
}

/**
 * Tries to run the command. If the command fails, it will log the error and exit the program.
 *
 * @param command
 * @returns
 */
export async function tryCommand<T, E extends CreateImplementAppError>(
	command: Promise<Result<T, E>>,
): Promise<T> {
	try {
		const result = await command;
		if (result.isErr()) return error(result.error);
		return result.value;
	} catch (e) {
		if (e instanceof CreateImplementAppError) return error(e);
		return error(
			new CreateImplementAppError(e instanceof Error ? e.message : String(e), {
				suggestion: "Please try again.",
			}),
		);
	}
}

/**
 * Log error and exit the program.
 *
 * @param err - The error to print.
 */
export function error(err: Error): never {
	p.log.message();
	if (process.env[TRACE_ENV_VAR] === "1") {
		console.trace(err);
		process.exit(1);
	} else {
		p.cancel(pc.red(err.toString()));
		process.exit(1);
	}
}
