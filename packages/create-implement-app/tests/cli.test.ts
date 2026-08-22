import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cli } from "@/cli";

let cwd: string;

beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), "create-implement-app-"));
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

/** The arguments as they would be typed, minus the program name. */
function run(args: string[]): Promise<unknown> {
	return cli.parseAsync(args, { from: "user" });
}

describe("cli", () => {
	it("creates an app from the root command", async () => {
		await run(["my-app", "--cwd", cwd, "--template", "csr", "--oxlint", "--yes"]);

		expect(existsSync(join(cwd, "my-app/oxlint.config.ts"))).toBe(true);
	});

	// `add` and `create` both take --cwd, and commander reads an option the root also declares as
	// the root's unless the program enables positional options — which would run `add` against the
	// directory the CLI was started in rather than the one it was pointed at
	it("gives the add command the options typed after it", async () => {
		await run(["my-app", "--cwd", cwd, "--template", "csr", "--no-oxlint", "--yes"]);
		const app = join(cwd, "my-app");

		await run(["add", "oxlint", "--cwd", app, "--yes"]);

		expect(existsSync(join(app, "oxlint.config.ts"))).toBe(true);
		expect(readFileSync(join(app, "package.json"), "utf8")).toContain('"lint": "oxlint"');
	});
});
