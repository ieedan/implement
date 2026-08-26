import type { StandardSchemaV1 } from "@standard-schema/spec";
/* oxlint-disable typescript/no-unsafe-type-assertion -- Reading the message off a caught error is how these assertions read the whole report. */
import { afterEach, describe, expect, it } from "vitest";
import {
	defineDynamicEnv,
	defineDynamicPublicEnv,
	injectPublicEnvBoot,
	publicEnvBootModule,
	publicEnvSnapshot,
	setDynamicEnv,
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

/** The slot `setDynamicEnv` writes, so a test can put it back the way it found it. */
const SOURCE_KEY = Symbol.for("@implementjs/kit:dynamic-env-source");

afterEach(() => {
	// oxlint-disable-next-line typescript/no-explicit-any -- reaching the well-known slot to restore it
	delete (globalThis as any)[SOURCE_KEY];
});

describe("defineDynamicEnv", () => {
	it("validates against the source it was pointed at", () => {
		setDynamicEnv({ TOKEN: "abc", PORT: "8080" });
		const env = defineDynamicEnv({ TOKEN: string, PORT: port });
		expect(env.TOKEN).toBe("abc");
		expect(env.PORT).toBe(8080);
	});

	it("types each key by its schema's output", () => {
		setDynamicEnv({ TOKEN: "abc", PORT: "8080" });
		const env = defineDynamicEnv({ TOKEN: string, PORT: port });
		const token: string = env.TOKEN;
		const parsed: number = env.PORT;
		expect(typeof token).toBe("string");
		expect(typeof parsed).toBe("number");
	});

	it("picks up a replaced source — the whole point", () => {
		setDynamicEnv({ TOKEN: "before" });
		const env = defineDynamicEnv({ TOKEN: string });
		expect(env.TOKEN).toBe("before");
		setDynamicEnv({ TOKEN: "after" });
		expect(env.TOKEN).toBe("after");
	});

	it("validates once per source, not once per read", () => {
		let reads = 0;
		const counted = schema((value) => {
			reads += 1;
			return typeof value === "string" ? value : null;
		}, "expected a string");
		const source = { TOKEN: "abc" };
		setDynamicEnv(source);
		const env = defineDynamicEnv({ TOKEN: counted });
		expect(env.TOKEN).toBe("abc");
		expect(env.TOKEN).toBe("abc");
		expect(reads).toBe(1);
		setDynamicEnv({ ...source });
		expect(env.TOKEN).toBe("abc");
		expect(reads).toBe(2);
	});

	it("does not validate at declaration — there may be no environment yet", () => {
		setDynamicEnv({});
		expect(() => defineDynamicEnv({ TOKEN: string })).not.toThrow();
	});

	it("reports every failing key on the first read", () => {
		setDynamicEnv({ PORT: "not-a-number" });
		const env = defineDynamicEnv({ TOKEN: string, PORT: port });
		let message = "";
		try {
			void env.TOKEN;
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain("defineDynamicEnv: 2 variables failed validation.");
		expect(message).toContain("TOKEN - not set");
		expect(message).toContain("PORT - expected an integer");
	});

	it("refuses a PUBLIC_ key at declaration, where the mistake is", () => {
		expect(() => defineDynamicEnv({ PUBLIC_TOKEN: string })).toThrow(
			/"PUBLIC_TOKEN" must not start with PUBLIC_/,
		);
	});

	it("names the public file generically — a runtime read has no build-time view of it", () => {
		expect(() => defineDynamicEnv({ PUBLIC_TOKEN: string })).toThrow(
			/reserved for the public env file/,
		);
	});

	it("spreads and enumerates like an ordinary object", () => {
		setDynamicEnv({ TOKEN: "abc", PORT: "8080" });
		const env = defineDynamicEnv({ TOKEN: string, PORT: port });
		expect(Object.keys(env)).toEqual(["TOKEN", "PORT"]);
		expect({ ...env }).toEqual({ TOKEN: "abc", PORT: 8080 });
		expect(JSON.parse(JSON.stringify(env))).toEqual({ TOKEN: "abc", PORT: 8080 });
		expect("TOKEN" in env).toBe(true);
		expect("NOPE" in env).toBe(false);
	});

	it("is read-only", () => {
		setDynamicEnv({ TOKEN: "abc" });
		const env = defineDynamicEnv({ TOKEN: string });
		// oxlint-disable-next-line typescript/no-explicit-any -- the assignment is the thing under test
		expect(() => ((env as any).TOKEN = "nope")).toThrow(/read-only/);
		// oxlint-disable-next-line typescript/no-explicit-any -- likewise
		expect(() => delete (env as any).TOKEN).toThrow(/read-only/);
	});

	it("falls back to process.env when nothing pointed it anywhere", () => {
		process.env.KIT_DYNAMIC_FALLBACK = "from-process";
		try {
			const env = defineDynamicEnv({ KIT_DYNAMIC_FALLBACK: string });
			expect(env.KIT_DYNAMIC_FALLBACK).toBe("from-process");
		} finally {
			delete process.env.KIT_DYNAMIC_FALLBACK;
		}
	});
});

describe("defineDynamicPublicEnv", () => {
	it("reads the same environment the private one does", () => {
		setDynamicEnv({ PUBLIC_API: "https://api.test" });
		const env = defineDynamicPublicEnv({ PUBLIC_API: string });
		expect(env.PUBLIC_API).toBe("https://api.test");
	});

	it("requires the PUBLIC_ prefix — these values ship to every visitor", () => {
		expect(() => defineDynamicPublicEnv({ TOKEN: string })).toThrow(
			/"TOKEN" must start with PUBLIC_/,
		);
	});

	it("names a server file as where an unprefixed key belongs", () => {
		expect(() => defineDynamicPublicEnv({ TOKEN: string })).toThrow(/Move it to a server env file/);
	});
});

describe("what a page carries", () => {
	it("snapshots the module's exports, proxies flattened to values", () => {
		setDynamicEnv({ PUBLIC_API: "https://api.test", PUBLIC_LIMIT: "25" });
		const env = defineDynamicPublicEnv({ PUBLIC_API: string, PUBLIC_LIMIT: port });
		expect(publicEnvSnapshot({ env })).toEqual({
			env: { PUBLIC_API: "https://api.test", PUBLIC_LIMIT: 25 },
		});
	});

	it("serves the same snapshot as an assignment the browser can run", () => {
		const code = publicEnvBootModule({ env: { PUBLIC_API: "https://api.test" } });
		expect(code).toBe(
			'globalThis["__implement_public_env"] = {"env":{"PUBLIC_API":"https://api.test"}};\n',
		);
	});

	it("puts the boot module first in head, ahead of the app's entry", () => {
		const html = injectPublicEnvBoot(
			'<html><head><script type="module" src="/entry.js"></script></head>',
			"/",
		);
		expect(html).toBe(
			'<html><head><script type="module" src="/_implement/env.js"></script><script type="module" src="/entry.js"></script></head>',
		);
	});

	it("honours a base path", () => {
		expect(injectPublicEnvBoot("<head>", "/app")).toContain('src="/app/_implement/env.js"');
		expect(injectPublicEnvBoot("<head>", "/app/")).toContain('src="/app/_implement/env.js"');
	});
});
