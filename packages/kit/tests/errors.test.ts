import { describe, expect, it } from "vitest";
import {
	errorSource,
	formatServerError,
	markErrorSource,
	type ServerErrorReport,
} from "../src/errors.ts";
import type { RequestEvent } from "../src/match.ts";

const ROOT = "/app";
const OPTIONS = { root: ROOT, routes: "src/routes" };

function event(path = "/docs/install", routeId: string | null = "/docs/[...slug]"): RequestEvent {
	const url = new URL(`http://localhost${path}`);
	return {
		request: new Request(url),
		url,
		params: {},
		route: { id: routeId },
		locals: {},
		fetch: globalThis.fetch,
		api: {},
		isDataRequest: false,
		platform: undefined,
		setHeaders: () => {},
		getClientAddress: () => "",
	};
}

/** An error with a stack written by hand, so the assertions do not depend on this file's layout. */
function thrownAt(message: string, frames: string[]): Error {
	const error = new Error(message);
	error.stack = [`Error: ${message}`, ...frames].join("\n");
	return error;
}

const APP_FRAME = `    at readDoc (${ROOT}/src/lib/docs.ts:14:9)`;
const LOAD_FRAME = `    at load (${ROOT}/src/routes/docs/[...slug]/page.server.ts:6:10)`;
const KIT_FRAME = "    at runLoads (/packages/kit/src/match.ts:149:9)";
const DEP_FRAME = `    at read (${ROOT}/node_modules/fs-extra/lib/index.js:3:1)`;

const report = (overrides: Partial<ServerErrorReport> = {}): ServerErrorReport => ({
	error: thrownAt("no such file", [APP_FRAME, LOAD_FRAME, KIT_FRAME, DEP_FRAME]),
	event: event(),
	status: 500,
	source: { kind: "load", file: "docs/[...slug]/page.server.ts" },
	...overrides,
});

describe("error sources", () => {
	it("records where a thrown error came from", () => {
		const error = new Error("boom");
		expect(errorSource(error)).toBeNull();
		expect(markErrorSource(error, { kind: "render" })).toBe(error);
		expect(errorSource(error)).toEqual({ kind: "render" });
	});

	it("keeps the innermost attribution as the error travels out", () => {
		const error = new Error("boom");
		markErrorSource(error, { kind: "load", file: "docs/page.server.ts" });
		markErrorSource(error, { kind: "render" });
		expect(errorSource(error)).toEqual({ kind: "load", file: "docs/page.server.ts" });
	});

	it("does not choke on a thrown primitive", () => {
		expect(markErrorSource("boom", { kind: "render" })).toBe("boom");
		expect(errorSource("boom")).toBeNull();
		expect(errorSource(undefined)).toBeNull();
	});
});

describe("formatServerError", () => {
	it("names the request, the status, and the server file that threw", () => {
		expect(formatServerError(report(), OPTIONS)).toContain(
			"GET /docs/install → 500 — load in src/routes/docs/[...slug]/page.server.ts",
		);
	});

	it("keeps the app's own frames, relative to the root, and counts the rest", () => {
		const output = formatServerError(report(), OPTIONS);
		expect(output).toContain("Error: no such file");
		expect(output).toContain("    at readDoc (src/lib/docs.ts:14:9)");
		expect(output).toContain("    at load (src/routes/docs/[...slug]/page.server.ts:6:10)");
		// kit's pipeline and the app's dependencies are never where the bug is
		expect(output).not.toContain("match.ts");
		expect(output).not.toContain("node_modules");
		expect(output).toContain("… 2 frames outside your app");
	});

	it("keeps the whole trace when none of it is the app's own", () => {
		const output = formatServerError(
			report({ error: thrownAt("deep", [KIT_FRAME, DEP_FRAME]) }),
			OPTIONS,
		);
		expect(output).toContain(KIT_FRAME);
		expect(output).toContain(DEP_FRAME);
		expect(output).not.toContain("outside your app");
	});

	it("resolves file:// frames the module runner writes", () => {
		const output = formatServerError(
			report({
				error: thrownAt("boom", [`    at load (file://${ROOT}/src/routes/page.server.ts:2:1)`]),
			}),
			OPTIONS,
		);
		expect(output).toContain("    at load (src/routes/page.server.ts:2:1)");
	});

	it("describes each kind of source", () => {
		const headline = (source: ServerErrorReport["source"]) =>
			formatServerError(report({ source }), OPTIONS).split("\n")[0];

		expect(headline({ kind: "endpoint", file: "api/server.ts", method: "POST" })).toContain(
			"POST handler in src/routes/api/server.ts",
		);
		expect(headline({ kind: "render" })).toContain("the page render for /docs/[...slug]");
		expect(headline({ kind: "error-page" })).toContain("the error page (src/routes/error.ts)");
		// nothing attributed it, so it came out of the hooks — the route is all kit knows
		expect(headline(null)).toContain("route /docs/[...slug]");
	});

	it("marks a client navigation's data request, which carries the page's url", () => {
		const data = { ...event(), isDataRequest: true };
		expect(formatServerError(report({ event: data }), OPTIONS)).toContain(
			"GET /docs/install (__data.json) → 500",
		);
	});

	it("falls back to the request alone when there is no route either", () => {
		expect(
			formatServerError(report({ source: null, event: event("/nope", null) }), OPTIONS),
		).toContain("GET /nope → 500\n");
	});

	it("prints the cause chain", () => {
		const cause = thrownAt("connect ECONNREFUSED", [
			`    at fetchDoc (${ROOT}/src/lib/api.ts:9:3)`,
		]);
		const error = thrownAt("could not load the doc", [LOAD_FRAME]);
		error.cause = cause;
		const output = formatServerError(report({ error }), OPTIONS);
		expect(output).toContain("caused by: Error: connect ECONNREFUSED");
		expect(output).toContain("    at fetchDoc (src/lib/api.ts:9:3)");
	});

	it("says what a non-error throw was", () => {
		expect(formatServerError(report({ error: { code: 42 } }), OPTIONS)).toContain(
			'thrown value (not an Error): {"code":42}',
		);
		expect(formatServerError(report({ error: "nope" }), OPTIONS)).toContain(
			'thrown value (not an Error): "nope"',
		);
	});
});
