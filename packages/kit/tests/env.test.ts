import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { afterAll, describe, expect, it } from "vitest";
import {
	assertSerializable,
	defineEnv,
	evaluateEnvFile,
	exportNames,
	loadRawEnv,
	serializeEnvModule,
	serverStubModule,
	validateEnv,
	type EnvFileInfo,
} from "../src/env.ts";

/** A Standard Schema with no dependencies, so these tests need nothing installed. */
function schema<T>(
	check: (value: unknown) => T | null,
	message: string,
): StandardSchemaV1<unknown, T> {
	return {
		"~standard": {
			version: 1,
			vendor: "kit-tests",
			validate: (value) => {
				const parsed = check(value);
				return parsed === null ? { issues: [{ message }] } : { value: parsed };
			},
		},
	};
}

const string = schema((value) => (typeof value === "string" ? value : null), "expected a string");
const port = schema((value) => {
	const parsed = Number(value);
	return typeof value === "string" && Number.isInteger(parsed) ? parsed : null;
}, "expected an integer");

const PUBLIC: EnvFileInfo = {
	kind: "public",
	file: "src/lib/env.public.ts",
	counterpart: "src/lib/env.server.ts",
};
const SERVER: EnvFileInfo = {
	...PUBLIC,
	kind: "server",
	file: PUBLIC.counterpart,
	counterpart: PUBLIC.file,
};

const temps: string[] = [];

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "implement-env-"));
	temps.push(dir);
	return dir;
}

/**
 * An env file whose schemas are written inline — the evaluator aliases
 * `@implementjs/kit` to a shim, so these need no node_modules next to them.
 */
function writeEnvFile(dir: string, name: string, body: string): string {
	const file = join(dir, name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		file,
		`import { defineEnv } from "@implementjs/kit";

const string = {
	"~standard": {
		version: 1,
		vendor: "kit-tests",
		validate: (value: unknown) =>
			typeof value === "string" ? { value } : { issues: [{ message: "expected a string" }] },
	},
} as const;

${body}
`,
	);
	return file;
}

afterAll(() => {
	for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe("defineEnv", () => {
	it("validates against process.env when it runs untransformed", () => {
		process.env.KIT_TEST_UNTRANSFORMED = "from-process";
		try {
			const env = defineEnv({ KIT_TEST_UNTRANSFORMED: string });
			expect(env.KIT_TEST_UNTRANSFORMED).toBe("from-process");
			// the output type is the schema's, not `string | undefined`
			const value: string = env.KIT_TEST_UNTRANSFORMED;
			expect(value).toBe("from-process");
		} finally {
			delete process.env.KIT_TEST_UNTRANSFORMED;
		}
	});

	it("infers each key's type from its schema's output", () => {
		process.env.KIT_TEST_PORT = "8080";
		try {
			const env = defineEnv({ KIT_TEST_PORT: port });
			const value: number = env.KIT_TEST_PORT;
			expect(value).toBe(8080);
		} finally {
			delete process.env.KIT_TEST_PORT;
		}
	});

	it("enforces no prefix rule without a file to attribute a key to", () => {
		process.env.KIT_TEST_ANY = "fine";
		try {
			expect(() => defineEnv({ KIT_TEST_ANY: string })).not.toThrow();
		} finally {
			delete process.env.KIT_TEST_ANY;
		}
	});
});

describe("validateEnv", () => {
	it("returns the parsed output of every schema", () => {
		expect(validateEnv({ PORT: port }, { PORT: "3000" }, null)).toEqual({ PORT: 3000 });
	});

	it("reports every failing key at once, not just the first", () => {
		let message = "";
		try {
			validateEnv({ A: string, B: port, C: string }, { C: "ok" }, SERVER);
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain("src/lib/env.server.ts");
		expect(message).toContain("2 variables failed validation");
		expect(message).toContain("A — not set");
		expect(message).toContain("B — not set");
		expect(message).not.toContain("C —");
	});

	it("distinguishes a missing value from a malformed one", () => {
		let message = "";
		try {
			validateEnv({ PORT: port }, { PORT: "not-a-number" }, SERVER);
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain("PORT — expected an integer");
	});

	it("rejects an unprefixed key in the public file and points at the server file", () => {
		let message = "";
		try {
			validateEnv({ DATABASE_URL: string }, { DATABASE_URL: "x" }, PUBLIC);
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain('src/lib/env.public.ts: "DATABASE_URL" must start with PUBLIC_');
		expect(message).toContain("src/lib/env.server.ts");
	});

	it("rejects a PUBLIC_ key in the server file and points at the public file", () => {
		let message = "";
		try {
			validateEnv({ PUBLIC_DOCS_URL: string }, { PUBLIC_DOCS_URL: "x" }, SERVER);
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain(
			'src/lib/env.server.ts: "PUBLIC_DOCS_URL" must not start with PUBLIC_',
		);
		expect(message).toContain("src/lib/env.public.ts");
	});

	it("names every misplaced key in one error", () => {
		expect(() => validateEnv({ A: string, B: string }, {}, PUBLIC)).toThrow(/"A" and "B"/);
	});

	it("checks prefixes before running any schema", () => {
		// DATABASE_URL is also unset — the prefix is the error worth reporting
		expect(() => validateEnv({ DATABASE_URL: string }, {}, PUBLIC)).toThrow(/must start with/);
	});
});

describe("loadRawEnv", () => {
	it("layers .env files in vite's order and lets process.env win", () => {
		const dir = tempDir();
		writeFileSync(join(dir, ".env"), "BASE=base\nOVERRIDDEN=from-env\nFROM_PROCESS=from-env\n");
		writeFileSync(join(dir, ".env.local"), "OVERRIDDEN=from-env-local\n");
		writeFileSync(join(dir, ".env.staging"), "MODE_ONLY=staging\n");

		process.env.FROM_PROCESS = "from-process";
		try {
			const values = loadRawEnv("staging", dir);
			expect(values.BASE).toBe("base");
			expect(values.OVERRIDDEN).toBe("from-env-local");
			expect(values.MODE_ONLY).toBe("staging");
			expect(values.FROM_PROCESS).toBe("from-process");
		} finally {
			delete process.env.FROM_PROCESS;
		}
	});

	it("sees unprefixed keys, not just VITE_ ones", () => {
		const dir = tempDir();
		writeFileSync(join(dir, ".env"), "DATABASE_URL=postgres://localhost/db\n");
		expect(loadRawEnv("development", dir).DATABASE_URL).toBe("postgres://localhost/db");
	});
});

describe("assertSerializable", () => {
	it("accepts json values, nested", () => {
		expect(() =>
			assertSerializable(
				{ env: { A: "a", n: 1, ok: true, list: [1, "2", null] } },
				"env.public.ts",
			),
		).not.toThrow();
	});

	it("names a function export and what it is", () => {
		expect(() => assertSerializable({ formatUrl: () => "" }, "src/lib/env.public.ts")).toThrow(
			/"formatUrl" is a function and cannot be inlined/,
		);
	});

	it("names the path to a nested offender", () => {
		expect(() => assertSerializable({ env: { parse: () => "" } }, "env.public.ts")).toThrow(
			/"env\.parse" is a function/,
		);
		expect(() => assertSerializable({ list: [1, undefined] }, "env.public.ts")).toThrow(
			/"list\[1\]" is undefined/,
		);
	});

	it("rejects values that only look serializable", () => {
		expect(() => assertSerializable({ at: new Date(0) }, "env.public.ts")).toThrow(
			/"at" is a Date/,
		);
		expect(() => assertSerializable({ n: Number.NaN }, "env.public.ts")).toThrow(/"n" is NaN/);
	});
});

describe("module emission", () => {
	it("re-emits every export as a literal", () => {
		const code = serializeEnvModule({ env: { PUBLIC_A: "a" }, label: "public" }, "env.public.ts");
		expect(code).toContain('const __env_0 = {"PUBLIC_A":"a"};');
		expect(code).toContain("export { __env_0 as env, __env_1 as label };");
	});

	it("quotes export names that are not identifiers", () => {
		expect(serializeEnvModule({ "not-an-identifier": 1 }, "env.public.ts")).toContain(
			'export { __env_0 as "not-an-identifier" };',
		);
	});

	it("emits a throwing body that keeps the module's shape and none of its values", () => {
		const code = serverStubModule(["env", "default"], "src/lib/env.server.ts");
		expect(code).toContain("throw new Error(");
		expect(code).toContain("src/lib/env.server.ts is a server file");
		expect(code).toContain("export { __server_0 as env, __server_1 as default };");
		expect(code).not.toMatch(/DATABASE_URL|postgres/);
	});

	it("reads a module's export names without running it", async () => {
		const dir = tempDir();
		const file = join(dir, "db.server.ts");
		writeFileSync(
			file,
			`import { boom } from "./missing";\nexport const a = boom;\nexport default 1;\n`,
		);
		expect([...(await exportNames(file))].sort()).toEqual(["a", "default"]);
	});
});

describe("evaluateEnvFile", () => {
	const values = { PUBLIC_SITE: "https://example.test", DATABASE_URL: "postgres://secret" };

	it("evaluates the file and returns every export", async () => {
		const dir = tempDir();
		const file = writeEnvFile(
			dir,
			"env.public.ts",
			`export const env = defineEnv({ PUBLIC_SITE: string });\nexport const label = "public";`,
		);
		expect(await evaluateEnvFile({ path: file, info: PUBLIC, values, root: dir })).toEqual({
			env: { PUBLIC_SITE: "https://example.test" },
			label: "public",
		});
	});

	it("memoizes on the bundled source and the values", async () => {
		const dir = tempDir();
		const file = writeEnvFile(
			dir,
			"env.public.ts",
			`export const env = defineEnv({ PUBLIC_SITE: string });`,
		);
		const first = await evaluateEnvFile({ path: file, info: PUBLIC, values, root: dir });
		const second = await evaluateEnvFile({ path: file, info: PUBLIC, values, root: dir });
		expect(second).toBe(first);

		const changed = await evaluateEnvFile({
			path: file,
			info: PUBLIC,
			values: { ...values, PUBLIC_SITE: "https://other.test" },
			root: dir,
		});
		expect(changed).not.toBe(first);
		expect(changed).toEqual({ env: { PUBLIC_SITE: "https://other.test" } });
	});

	it("enforces the prefix rules through the evaluated file", async () => {
		const dir = tempDir();
		const file = writeEnvFile(
			dir,
			"env.public.ts",
			`export const env = defineEnv({ DATABASE_URL: string });`,
		);
		await expect(evaluateEnvFile({ path: file, info: PUBLIC, values, root: dir })).rejects.toThrow(
			/must start with PUBLIC_/,
		);
	});

	it("fails on a non-serializable export rather than silently dropping it", async () => {
		const dir = tempDir();
		const file = writeEnvFile(
			dir,
			"env.public.ts",
			`export const env = defineEnv({ PUBLIC_SITE: string });\nexport const formatUrl = (path: string) => path;`,
		);
		await expect(evaluateEnvFile({ path: file, info: PUBLIC, values, root: dir })).rejects.toThrow(
			/"formatUrl" is a function and cannot be inlined/,
		);
	});

	it("does not remember a failed evaluation", async () => {
		const dir = tempDir();
		const file = writeEnvFile(
			dir,
			"env.server.ts",
			`export const env = defineEnv({ DATABASE_URL: string });`,
		);
		await expect(
			evaluateEnvFile({ path: file, info: SERVER, values: {}, root: dir }),
		).rejects.toThrow(/DATABASE_URL — not set/);
		expect(await evaluateEnvFile({ path: file, info: SERVER, values, root: dir })).toEqual({
			env: { DATABASE_URL: "postgres://secret" },
		});
	});
});
