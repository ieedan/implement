import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyAdders, getAdder } from "@/adders";
import { getTemplate } from "@/templates";
import {
	ADDONS,
	type Addon,
	TEMPLATES,
	type TemplateContext,
	type TemplateFile,
	type TemplateId,
} from "@/templates/types";
import { unwrap } from "./utils";

/**
 * oxfmt is a devDependency of the monorepo rather than of this package — the templates only name
 * it, they never load it — so the binary a scaffolded app would run is the one at the root, and so
 * is the `oxfmt` the generated config imports `defineConfig` from.
 */
const NODE_MODULES = resolve(import.meta.dirname, "../../../node_modules");
const OXFMT = join(NODE_MODULES, ".bin/oxfmt");

const ADDER_CONTEXT = { workspace: false, packageManager: "pnpm" } as const;

/** Every combination of addons, which is every shape of app either template can be asked for. */
function addonCombinations(): Addon[][] {
	return ADDONS.reduce<Addon[][]>(
		(combinations, addon) => [...combinations, ...combinations.map((set) => [...set, addon])],
		[[]],
	);
}

type Variant = { id: TemplateId; label: string; ctx: TemplateContext };

function variants(): Variant[] {
	return TEMPLATES.flatMap((id) => [
		...addonCombinations().map((addons) => ({
			id,
			label: `${id} [${addons.join(", ")}]`,
			ctx: { name: "my-app", addons, workspace: false, packageManager: "pnpm" as const },
		})),
		// the two contexts that change files rather than just their contents: an app inside the
		// monorepo skips `pnpm-workspace.yaml`, and `--link` rewrites the jsrepo registry
		{
			id,
			label: `${id} --workspace`,
			ctx: { name: "my-app", addons: [...ADDONS], workspace: true },
		},
		{
			id,
			label: `${id} --link`,
			ctx: {
				name: "my-app",
				addons: [...ADDONS],
				workspace: false,
				linkRoot: "../implement",
			},
		},
	]);
}

/** The app as it reaches disk: the template's files, with the `oxlint` adder applied over them. */
function files(variant: Variant): TemplateFile[] {
	const template = getTemplate(variant.id).files(variant.ctx);
	const manifest = template.find((file) => file.path === "package.json")?.contents ?? "";
	// the adder rewrites the manifest as well as writing configs of its own, and what it writes
	// back is the package.json the app is left holding
	const changes = unwrap(applyAdders(["oxlint"], ADDER_CONTEXT, manifest));

	return [
		...template.filter((file) => file.path !== "package.json"),
		{ path: "package.json", contents: changes.packageJson },
		...changes.files,
	];
}

let root: string;
let unformatted: string[];

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "create-implement-app-format-"));
	// what `import { defineConfig } from "oxfmt"` at the top of the generated config resolves
	// through, the way it would in an app that has been installed
	symlinkSync(NODE_MODULES, join(root, "node_modules"));

	// every app below writes this exact file; putting a copy at the root is what makes one run of
	// oxfmt cover all of them, against the config they ship rather than some config of the test's
	const adder = getAdder("oxlint");
	const config = adder.files?.(ADDER_CONTEXT).find((file) => file.path === "oxfmt.config.ts");
	writeFileSync(join(root, "oxfmt.config.ts"), config?.contents ?? "");

	const directories = new Map<string, string>();
	for (const [index, variant] of variants().entries()) {
		const directory = `app-${index}`;
		directories.set(directory, variant.label);
		for (const file of files(variant)) {
			const path = join(root, directory, file.path);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, file.contents);
		}
	}

	unformatted = check(directories);
}, 120_000);

afterAll(() => {
	rmSync(root, { recursive: true, force: true });
});

/** The files oxfmt would rewrite, named by the app they belong to. */
function check(directories: Map<string, string>): string[] {
	let output: string;
	try {
		output = execFileSync(OXFMT, ["--check", "."], { cwd: root, encoding: "utf8" });
	} catch (e) {
		// `--check` exits non-zero the moment anything is misformatted, which is the case under test
		output = e instanceof Error && "stdout" in e && typeof e.stdout === "string" ? e.stdout : "";
	}

	// a config oxfmt could not load leaves nothing checked and nothing reported, which would read
	// as a pass — so the summary it prints on every real run is what says the run happened
	const summary = /Finished in .* on (\d+) files/.exec(output);
	expect(summary?.[1], output).toBeDefined();
	expect(Number(summary?.[1])).toBeGreaterThan(0);

	return [...output.matchAll(/^(\S+) \(\d+ms\)$/gm)].map((match) => {
		const path = match[1] ?? "";
		const [directory, ...rest] = path.split("/");
		return `${directories.get(directory ?? "") ?? path} → ${rest.join("/")}`;
	});
}

describe("the files a scaffolded app is born with", () => {
	it.each(TEMPLATES)("%s writes what its own oxfmt config would have written", (id) => {
		// the app's first `pnpm format` should be a no-op; anything here is editor config, a README
		// or a component the developer never opened being rewritten under them
		expect(unformatted.filter((file) => file.startsWith(id))).toEqual([]);
	});
});
