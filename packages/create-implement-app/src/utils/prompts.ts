import {
	intro as _intro,
	spinner as _spinner,
	cancel,
	isCancel,
	log,
	taskLog,
} from "@clack/prompts";
import pc from "picocolors";
import { x } from "tinyexec";
import type { ResolvedCommand } from "package-manager-detector";
import pkg from "../../package.json" with { type: "json" };

/** Read at call time so a run without a terminal — an agent, CI — is always detected correctly. */
export function isTTY(): boolean {
	return process.stdout.isTTY;
}

export function intro() {
	_intro(`${pc.bgYellow(pc.black(` ${pkg.name} `))}${pc.gray(` v${pkg.version} `)}`);
}

export { outro } from "@clack/prompts";

function createVerboseLogger({
	options,
}: {
	options: { verbose: boolean };
}): (msg: string) => void {
	return (msg: string) => {
		if (!options.verbose) return;
		log.info(msg);
	};
}

export type Spinner = ReturnType<typeof spinner>;

/**
 * Creates a verbose logger and a spinner. We don't want to use a spinner in verbose mode because we
 * often want to log within spinners and maintain the logs.
 *
 * @param param0
 * @returns
 */
export function initLogging({ options }: { options: { verbose: boolean } }) {
	const verbose = createVerboseLogger({ options });
	return {
		verbose,
		spinner: spinner({ verbose: options.verbose ? verbose : undefined }),
	};
}

/** A spinner compatible with verbose logging.
 *
 * @param param0
 * @returns
 */
function spinner({ verbose }: { verbose?: (msg: string) => void } = {}): ReturnType<
	typeof _spinner
> {
	const loading = _spinner();

	return {
		message: (msg) => (verbose ? verbose(msg ?? "") : loading.message(msg)),
		stop: (msg) => (verbose ? verbose(msg ?? "") : loading.stop(msg)),
		start: (msg) => (verbose ? verbose(msg ?? "") : loading.start(msg)),
		error: (msg) => (verbose ? verbose(msg ?? "") : loading.start(msg)),
		cancel: () => loading.cancel(),
		clear: () => loading.clear(),
		get isCancelled() {
			return loading.isCancelled;
		},
	};
}

/** Exits the program when a prompt is canceled, otherwise narrows the value. */
export function unwrapPrompt<T>(value: T | symbol): T {
	if (isCancel(value)) {
		cancel("Canceled!");
		process.exit(0);
	}

	return value;
}

export async function runCommands({
	title,
	commands,
	cwd,
	messages,
}: {
	title: string;
	commands: ResolvedCommand[];
	cwd: string;
	messages: {
		success: () => string;
		error: (err: unknown) => string;
	};
}) {
	const task = taskLog({
		title,
		limit: Math.ceil(process.stdout.rows / 2),
		spacing: 0,
		retainLog: true,
	});

	const runCmd = async (cmd: ResolvedCommand) => {
		const proc = x(cmd.command, [...cmd.args], { nodeOptions: { cwd }, throwOnError: true });

		for await (const line of proc) {
			task.message(line);
		}
	};

	try {
		for (const command of commands) {
			await runCmd(command);
		}

		task.success(messages.success());
	} catch (err) {
		task.error(messages.error(err));
		process.exit(1);
	}
}
