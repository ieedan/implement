/**
 * What the generated declarations do to a real `tsc`.
 *
 * The bug this guards against is invisible to a string assertion: emitting the
 * `ParamTypes` augmentation into `$implement.d.ts` — a script — declared an
 * *ambient* `@implementjs/router` that took the package's name over, so every
 * type the app reached through it silently became `any`. Nothing errored
 * anywhere. Only compiling the app says so, which is what this file does: one
 * generated app, one probe, and `tsc` over it.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanRoutes } from "../src/scan.ts";
import { writeGenerated } from "../src/typegen.ts";

/** Compiling a whole app, once. */
const TIMEOUT = 60_000;

const TSCONFIG = {
	extends: "./.implement/tsconfig.json",
	compilerOptions: {
		target: "ES2022",
		lib: ["ES2022", "ES2023", "DOM", "DOM.Iterable"],
		module: "ESNext",
		moduleResolution: "bundler",
		strict: true,
		noEmit: true,
		skipLibCheck: true,
		allowImportingTsExtensions: true,
		// `import.meta.env`/`hot`, which the generated entries and kit's own
		// sources read — a real app declares the same
		types: ["vite/client"],
	},
	include: ["src/**/*.ts", ".implement/**/*.ts", ".implement/types/**/*.d.ts"],
};

/**
 * Everything the app is supposed to be able to say about its own router. As in
 * `src/type-test.ts`, the compile is the assertion: a `@ts-expect-error` that
 * stops erroring fails as loudly as a check that starts.
 */
const PROBE = `import { router } from "$implement/router";
import { Router, type ParamTypes, type RouterError, type RouterHelper } from "@implementjs/router";

// the package's own exports, which an ambient redeclaration would have taken
// with it — and \`router\`, which resolves through \`RouterHelper\`
type IsAny<T> = 0 extends 1 & T ? true : false;
const routerIsAny: IsAny<typeof router> = false;
const helper: RouterHelper<{}> | null = null;
const build: typeof Router | null = null;
const failure: RouterError | null = null;

// \`to\` is checked against this app's own patterns
router.Link({ to: "/" }, "home");
router.Link({ to: "/issues/:id=issue-id", params: { id: 42 } }, "open");
// @ts-expect-error there is no such route
router.Link({ to: "/nope" }, "nowhere");

// and the app's matchers reached the registry the router reads them from.
// \`Link\` itself still takes anything stringifiable — a URL is a string, and
// the matcher runs on the way back in — so the registry is what to ask
const parsed: ParamTypes["issue-id"] = 42;
// @ts-expect-error the matcher parses to a number, so this param is not a string
const unparsed: ParamTypes["issue-id"] = "42";

void [routerIsAny, helper, build, failure, parsed, unparsed];
`;

/**
 * A kit app with one plain route and one behind a parsing matcher. Built under
 * `fixtures/` rather than a temp dir so `@implementjs/router` and the rest
 * resolve the way they would from a real app.
 */
function makeApp(): string {
	const dir = mkdtempSync(join(import.meta.dirname, "fixtures/router-types-"));
	mkdirSync(join(dir, "src/routes/issues/[id=issue-id]"), { recursive: true });
	mkdirSync(join(dir, "src/params"), { recursive: true });
	writeFileSync(join(dir, "tsconfig.json"), `${JSON.stringify(TSCONFIG, null, "\t")}\n`);
	writeFileSync(
		join(dir, "src/params/issue-id.ts"),
		[
			'import { matcher } from "@implementjs/kit/params";',
			'import * as v from "valibot";',
			"",
			"export default matcher(v.pipe(v.string(), v.regex(/^\\d+$/), v.transform(Number)));",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(dir, "src/routes/page.ts"),
		'import { H1 } from "@implementjs/core";\n\nexport default () => H1("home");\n',
	);
	writeFileSync(
		join(dir, "src/routes/issues/[id=issue-id]/page.ts"),
		'import { H1 } from "@implementjs/core";\n\nexport default () => H1("issue");\n',
	);
	writeFileSync(join(dir, "src/probe.ts"), PROBE);
	writeGenerated(dir, scanRoutes(join(dir, "src/routes"), join(dir, "src/params")));
	return dir;
}

/** The workspace's own `tsc`, which nothing puts on this process's PATH. */
function findTsc(): string {
	let dir = import.meta.dirname;
	for (;;) {
		for (const name of ["tsc", "tsc.cmd"]) {
			const bin = join(dir, "node_modules", ".bin", name);
			if (existsSync(bin)) return bin;
		}
		const parent = dirname(dir);
		if (parent === dir) throw new Error("no tsc on the way up from the tests directory");
		dir = parent;
	}
}

/** What `tsc` says about the app, as the lines it printed. */
function compile(dir: string): string[] {
	const tsc = spawnSync(findTsc(), ["--noEmit", "-p", join(dir, "tsconfig.json")], {
		encoding: "utf8",
	});
	if (tsc.error !== undefined) throw tsc.error;
	return `${tsc.stdout}${tsc.stderr}`.split("\n").filter((line) => line.trim() !== "");
}

describe("the app's own types, through tsc", () => {
	let root: string | null = null;
	let output: string[] = [];

	beforeAll(() => {
		root = makeApp();
		output = compile(root);
	}, TIMEOUT);

	afterAll(() => {
		if (root !== null) rmSync(root, { recursive: true, force: true });
	});

	it("compiles an app that has a matcher", () => {
		expect(output).toEqual([]);
	});
});
