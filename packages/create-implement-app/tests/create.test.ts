import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CreateOptions, runCreate } from "@/commands/create";
import type { AbsolutePath } from "@/utils/types";
import { unwrap, unwrapErr } from "./utils";

let cwd: AbsolutePath;

beforeEach(() => {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Branded path: temp dir from mkdtempSync is absolute.
	cwd = mkdtempSync(join(tmpdir(), "create-implement-app-")) as AbsolutePath;
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
});

function options(overrides: Partial<CreateOptions> = {}): CreateOptions {
	return {
		cwd,
		install: false,
		git: false,
		workspace: false,
		overwrite: false,
		// every test runs the non-interactive path, the same one an agent gets
		yes: true,
		verbose: false,
		...overrides,
	};
}

describe("runCreate", () => {
	it("scaffolds the default template into the given directory", async () => {
		const result = await runCreate("my-app", options());

		const value = unwrap(result);
		expect(value.template).toBe("kit");
		expect(value.addons).toEqual(["tailwind"]);
		expect(value.name).toBe("my-app");
		expect(value.installed).toBe(false);
		expect(readFileSync(join(cwd, "my-app/package.json"), "utf8")).toContain('"name": "my-app"');
		expect(readFileSync(join(cwd, "my-app/src/routes/index.ts"), "utf8")).toContain("Page");
	});

	it("writes every file the template lists", async () => {
		const result = await runCreate("my-app", options({ template: "csr" }));

		const value = unwrap(result);
		for (const file of value.files) {
			expect(readFileSync(join(cwd, "my-app", file), "utf8").length).toBeGreaterThan(0);
		}
	});

	it("takes the addons from the flags", async () => {
		const result = await runCreate(
			"my-app",
			options({ tailwind: false, primitives: true, icons: true }),
		);

		expect(unwrap(result).addons).toEqual(["primitives", "icons"]);
	});

	it("wires up mode-watcher from the flag", async () => {
		const result = await runCreate("my-app", options({ modeWatcher: true }));

		expect(unwrap(result).addons).toEqual(["tailwind", "modeWatcher"]);
		expect(readFileSync(join(cwd, "my-app/src/routes/layout.ts"), "utf8")).toContain(
			"ModeWatcher({ manager: mode })",
		);
		expect(readFileSync(join(cwd, "my-app/src/lib/mode.ts"), "utf8")).toContain(
			"createModeManager()",
		);
	});

	it("derives a valid package name from the directory", async () => {
		const result = await runCreate("./Some Dir", options());

		expect(unwrap(result).name).toBe("some-dir");
	});

	it("prefers an explicit name over the directory", async () => {
		const result = await runCreate("my-app", options({ name: "@scope/app" }));

		expect(unwrap(result).name).toBe("@scope/app");
	});

	it("errors on a name package.json would reject", async () => {
		const result = await runCreate("my-app", options({ name: "Not Valid" }));

		expect(unwrapErr(result).toString()).toContain("is not a valid package name");
	});

	it("refuses a directory that isn't empty", async () => {
		writeFileSync(join(cwd, "taken.txt"), "");

		const result = await runCreate(".", options());

		expect(unwrapErr(result).toString()).toContain("is not empty");
	});

	it("scaffolds into a directory that isn't empty with --overwrite", async () => {
		writeFileSync(join(cwd, "taken.txt"), "");

		const result = await runCreate(".", options({ overwrite: true }));

		expect(result.isOk()).toBe(true);
		expect(readFileSync(join(cwd, "taken.txt"), "utf8")).toBe("");
	});

	it("ignores a git repository when deciding whether a directory is empty", async () => {
		writeFileSync(join(cwd, ".DS_Store"), "");

		const result = await runCreate(".", options());

		expect(result.isOk()).toBe(true);
	});

	it("depends on the implement packages with workspace:* when asked", async () => {
		await runCreate("my-app", options({ workspace: true }));

		expect(readFileSync(join(cwd, "my-app/package.json"), "utf8")).toContain(
			'"@implementjs/core": "workspace:*"',
		);
	});
});
