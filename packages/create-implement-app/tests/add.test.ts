import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AddOptions, runAdd } from "@/commands/add";
import { runCreate } from "@/commands/create";
import type { AbsolutePath } from "@/utils/types";
import { unwrap, unwrapErr } from "./utils";

const prompts = vi.hoisted(() => ({ multiselect: vi.fn() }));

vi.mock("@clack/prompts", async (importOriginal) => ({
	...(await importOriginal<typeof import("@clack/prompts")>()),
	...prompts,
}));

let cwd: AbsolutePath;
const wasTTY = process.stdout.isTTY;

beforeEach(() => {
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Branded path: temp dir from mkdtempSync is absolute.
	cwd = mkdtempSync(join(tmpdir(), "create-implement-app-")) as AbsolutePath;
	prompts.multiselect.mockResolvedValue(["oxlint"]);
});

afterEach(() => {
	rmSync(cwd, { recursive: true, force: true });
	process.stdout.isTTY = wasTTY;
	vi.clearAllMocks();
});

function options(overrides: Partial<AddOptions> = {}): AddOptions {
	return {
		cwd,
		install: false,
		workspace: false,
		overwrite: false,
		// every test runs the non-interactive path, the same one an agent gets
		yes: true,
		verbose: false,
		...overrides,
	};
}

/** An app to add to — scaffolded the same way a user would have. */
async function scaffold(overrides: Partial<Parameters<typeof runCreate>[1]> = {}) {
	const app = join(cwd, "my-app");
	unwrap(
		await runCreate("my-app", {
			cwd,
			template: "csr",
			install: false,
			git: false,
			workspace: false,
			overwrite: false,
			yes: true,
			verbose: false,
			...overrides,
		}),
	);
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Branded path: joined onto an absolute temp dir.
	return app as AbsolutePath;
}

function pkg(app: string): {
	scripts: Record<string, string>;
	devDependencies: Record<string, string>;
} {
	return JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
}

describe("runAdd", () => {
	it("adds the adder's files, scripts, and dependencies to an app that already exists", async () => {
		const app = await scaffold();

		const result = unwrap(await runAdd(["oxlint"], options({ cwd: app })));

		expect(result.adders).toEqual(["oxlint"]);
		expect(result.files).toEqual(["oxlint.config.ts", "oxfmt.config.ts"]);
		expect(readFileSync(join(app, "oxlint.config.ts"), "utf8")).toContain("defineConfig");
		expect(pkg(app).scripts.lint).toBe("oxlint");
		expect(pkg(app).devDependencies.oxlint).toBeDefined();
		expect(result.installed).toBe(false);
	});

	it("leaves an app scaffolded with the adder exactly as it was", async () => {
		const app = await scaffold({ oxlint: true });
		const before = readFileSync(join(app, "package.json"), "utf8");

		const result = unwrap(await runAdd(["oxlint"], options({ cwd: app })));

		expect(readFileSync(join(app, "package.json"), "utf8")).toBe(before);
		// the config was already there and already said this, so nothing was written or reported
		expect(result.files).toEqual([]);
		expect(result.skippedFiles).toEqual([]);
		expect(result.scripts).toEqual([]);
	});

	it("keeps a config file that has been edited since", async () => {
		const app = await scaffold();
		unwrap(await runAdd(["oxlint"], options({ cwd: app })));
		writeFileSync(join(app, "oxlint.config.ts"), "// mine\n");

		const result = unwrap(await runAdd(["oxlint"], options({ cwd: app })));

		expect(result.skippedFiles).toEqual(["oxlint.config.ts"]);
		expect(readFileSync(join(app, "oxlint.config.ts"), "utf8")).toBe("// mine\n");
	});

	it("replaces an edited config file with --overwrite", async () => {
		const app = await scaffold();
		unwrap(await runAdd(["oxlint"], options({ cwd: app })));
		writeFileSync(join(app, "oxlint.config.ts"), "// mine\n");

		const result = unwrap(await runAdd(["oxlint"], options({ cwd: app, overwrite: true })));

		expect(result.files).toContain("oxlint.config.ts");
		expect(readFileSync(join(app, "oxlint.config.ts"), "utf8")).toContain("defineConfig");
	});

	it("depends on the implement packages with workspace:* when asked", async () => {
		const app = await scaffold();

		unwrap(await runAdd(["oxlint"], options({ cwd: app, workspace: true })));

		expect(pkg(app).devDependencies["@implementjs/eslint"]).toBe("workspace:*");
	});

	it("refuses --link and --workspace together", async () => {
		const app = await scaffold();

		const result = await runAdd(
			["oxlint"],
			options({ cwd: app, workspace: true, link: "../repo" }),
		);

		expect(unwrapErr(result).toString()).toContain("--link and --workspace");
	});

	it("errors on a directory that isn't an app", async () => {
		const result = await runAdd(["oxlint"], options());

		expect(unwrapErr(result).toString()).toContain("has no package.json");
	});

	it("errors on an adder it doesn't know", async () => {
		const app = await scaffold();

		const result = await runAdd(["prettier"], options({ cwd: app }));

		expect(unwrapErr(result).toString()).toContain("is not a valid adder");
	});

	it("errors when nothing was named and there is no one to ask", async () => {
		const app = await scaffold();

		const result = await runAdd([], options({ cwd: app }));

		expect(unwrapErr(result).toString()).toContain("No adders were named");
	});

	it("asks which adders to apply when none were named", async () => {
		const app = await scaffold();
		process.stdout.isTTY = true;

		const result = unwrap(await runAdd([], options({ cwd: app, yes: false })));

		expect(prompts.multiselect).toHaveBeenCalled();
		expect(result.adders).toEqual(["oxlint"]);
	});
});
