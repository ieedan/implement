import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CreateOptions, runCreate } from "@/commands/create";
import type { AbsolutePath } from "@/utils/types";
import { unwrap, unwrapErr } from "./utils";

let cwd: AbsolutePath;

/** A stand-in for a local clone of the implement repo. */
function fakeRepo(packages: string[], { at = "implement" } = {}): string {
	for (const name of packages) {
		const dir = join(cwd, at, "packages", name);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `@implementjs/${name}` }));
	}
	return at;
}

function deps(app: string): Record<string, string> {
	const pkg = JSON.parse(readFileSync(join(cwd, app, "package.json"), "utf8"));
	return { ...pkg.dependencies, ...pkg.devDependencies };
}

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
		yes: true,
		verbose: false,
		packageManager: "pnpm",
		...overrides,
	};
}

describe("--link", () => {
	it("points every implement package the app needs at the local repo", async () => {
		const repo = fakeRepo(["core", "kit", "router", "primitives", "lucide"]);

		const result = await runCreate(
			"my-app",
			options({ link: repo, primitives: true, icons: true }),
		);

		expect(unwrap(result).linked).toMatchObject({ "@implementjs/core": expect.any(String) });
		expect(deps("my-app")).toMatchObject({
			"@implementjs/core": "link:../implement/packages/core",
			"@implementjs/kit": "link:../implement/packages/kit",
			"@implementjs/router": "link:../implement/packages/router",
			"@implementjs/primitives": "link:../implement/packages/primitives",
			"@implementjs/lucide": "link:../implement/packages/lucide",
		});
	});

	it("leaves everything else on a version", async () => {
		const repo = fakeRepo(["core", "kit", "router"]);

		await runCreate("my-app", options({ link: repo }));

		expect(deps("my-app").vite).toMatch(/^\^/);
	});

	it("only links the packages the app actually depends on", async () => {
		const repo = fakeRepo(["core", "kit", "router", "primitives", "lucide"]);

		await runCreate("my-app", options({ link: repo, template: "csr" }));

		expect(Object.keys(deps("my-app"))).toEqual(
			expect.not.arrayContaining(["@implementjs/kit", "@implementjs/lucide"]),
		);
	});

	it("skips a private package, which npm never has", async () => {
		const repo = fakeRepo(["core", "kit", "router"]);
		// `@implementjs/ui` is a jsrepo registry — a package in the workspace so changesets can
		// version it, and nothing a scaffolded app could ever install
		const dir = join(cwd, repo, "packages", "ui");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "@implementjs/ui", private: true }),
		);

		const result = await runCreate("my-app", options({ link: repo }));

		expect(Object.keys(unwrap(result).linked ?? {})).not.toContain("@implementjs/ui");
	});

	it("spells the link the way npm and bun understand it", async () => {
		const repo = fakeRepo(["core", "kit", "router"]);

		await runCreate("my-app", options({ link: repo, packageManager: "npm" }));

		expect(deps("my-app")["@implementjs/core"]).toBe("file:../implement/packages/core");
	});

	it("links a repo given by an absolute path", async () => {
		fakeRepo(["core", "kit", "router"]);

		await runCreate("my-app", options({ link: join(cwd, "implement") }));

		expect(deps("my-app")["@implementjs/core"]).toContain("packages/core");
	});

	it("points the ui registry at the clone, through jsrepo's fs provider", async () => {
		const repo = fakeRepo(["core", "kit", "router", "primitives"]);
		// the registry is built from the docs app, not the repository root
		mkdirSync(join(cwd, repo, "apps/docs"), { recursive: true });
		writeFileSync(
			join(cwd, repo, "apps/docs/registry.json"),
			JSON.stringify({ name: "@implementjs/ui" }),
		);

		await runCreate("my-app", options({ link: repo, ui: true }));

		const config = readFileSync(join(cwd, "my-app/jsrepo.config.ts"), "utf8");
		expect(config).toContain('registries: ["fs://../implement/apps/docs"]');
		expect(config).toContain("providers: [...DEFAULT_PROVIDERS, fs()]");
	});

	it("errors when the linked repo has no built registry", async () => {
		const repo = fakeRepo(["core", "kit", "router", "primitives"]);

		const result = await runCreate("my-app", options({ link: repo, ui: true }));

		expect(unwrapErr(result).toString()).toContain("no built registry.json");
	});

	it("errors when the path holds no implement packages", async () => {
		const result = await runCreate("my-app", options({ link: "./nowhere" }));

		expect(unwrapErr(result).toString()).toContain("No implement packages found");
	});

	it("errors when the repo is missing a package the app needs", async () => {
		const repo = fakeRepo(["core", "kit", "router"]);

		const result = await runCreate("my-app", options({ link: repo, primitives: true }));

		expect(unwrapErr(result).toString()).toContain("no @implementjs/primitives");
	});

	it("errors when combined with --workspace", async () => {
		const repo = fakeRepo(["core", "kit", "router"]);

		const result = await runCreate("my-app", options({ link: repo, workspace: true }));

		expect(unwrapErr(result).toString()).toContain("--link and --workspace");
	});
});
