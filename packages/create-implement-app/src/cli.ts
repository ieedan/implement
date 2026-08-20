import { program } from "commander";
import pkg from "../package.json" with { type: "json" };
import { addCreateCommand } from "@/commands";

const cli = addCreateCommand(
	program.name(pkg.name).description(pkg.description).version(pkg.version),
);

export { cli };
