import { program } from "commander";
import pkg from "../package.json" with { type: "json" };
import { addAddCommand, addCreateCommand } from "@/commands";

// `create` is the root command, so `create-implement-app my-app` needs no subcommand — `add` is
// registered on top of it, and commander hands it the run whenever it is the first argument.
//
// Positional options are what keep `--cwd` (and everything else both commands take) attached to the
// command it was typed after. Without it commander reads an option the root also declares as the
// root's, wherever it appeared, and `add --cwd ./app` would run against the current directory.
const cli = addAddCommand(
	addCreateCommand(
		program
			.name(pkg.name)
			.description(pkg.description)
			.version(pkg.version)
			.enablePositionalOptions(),
	),
);

export { cli };
